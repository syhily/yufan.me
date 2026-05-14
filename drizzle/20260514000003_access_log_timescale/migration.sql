-- TimescaleDB conversion + policies for `access_log`.
--
-- Runs AFTER the Drizzle-generated `*_access_log` migration (which
-- only knows how to emit relational DDL). This file is hand-written
-- because Timescale's hypertable / compression / retention /
-- continuous-aggregate primitives are not modelled by drizzle-kit.
--
-- All operations are guarded with `if_not_exists` flags or wrapped in
-- DO blocks so a partial re-run never aborts on `duplicate_object`.
-- See `docs/blog-analytics-plan.md §6.3` for the design rationale.

CREATE EXTENSION IF NOT EXISTS timescaledb;
--> statement-breakpoint

-- Convert to a hypertable partitioned by `ts` (1-day chunks).
-- `migrate_data => TRUE` lets the call succeed even if the table was
-- briefly used before the migration ran (defence in depth — fresh
-- installs always have an empty table here).
SELECT create_hypertable(
  'access_log', 'ts',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE,
  migrate_data => TRUE
);
--> statement-breakpoint

-- Column-oriented compression for old chunks. `entity_type` is a low-
-- cardinality natural partition; `ts DESC` keeps recent rows hot at
-- the chunk head for the dashboard's most common query shape.
ALTER TABLE access_log SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'entity_type',
  timescaledb.compress_orderby = 'ts DESC'
);
--> statement-breakpoint

-- Compression policy: compress chunks older than 7 days. Wrapped in a
-- DO block because `add_compression_policy` raises `duplicate_object`
-- on a partial re-run (older Timescale versions).
DO $$ BEGIN
  PERFORM add_compression_policy('access_log', INTERVAL '7 days');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Retention policy: drop chunks older than 180 days. Same idempotency
-- guard as compression.
DO $$ BEGIN
  PERFORM add_retention_policy('access_log', INTERVAL '180 days');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Hourly continuous aggregate. Used by chart queries that span more
-- than 24 hours so the dashboard doesn't scan raw rows. The dialect
-- intentionally excludes referer / city / language / browser_version
-- / os_version because (a) cardinality explodes the MV row count and
-- (b) the dashboard groups those dimensions out of raw rows on the
-- "last 24h" view where rate-of-events is bounded.
CREATE MATERIALIZED VIEW IF NOT EXISTS stats_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', ts) AS bucket,
  entity_type,
  entity_id,
  path,
  country,
  browser,
  os,
  device_type,
  COUNT(*)::bigint AS visits,
  COUNT(DISTINCT visitor_hash)::bigint AS visitors
FROM access_log
WHERE is_bot = FALSE
GROUP BY bucket, entity_type, entity_id, path, country, browser, os, device_type
WITH NO DATA;
--> statement-breakpoint

DO $$ BEGIN
  PERFORM add_continuous_aggregate_policy('stats_hourly',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Daily continuous aggregate. Used by chart queries that span more
-- than 30 days. The dialect drops everything except the top three
-- dimensions (entity / path / country) so the MV stays narrow on a
-- per-day grain.
CREATE MATERIALIZED VIEW IF NOT EXISTS stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', ts) AS bucket,
  entity_type,
  entity_id,
  path,
  country,
  COUNT(*)::bigint AS visits,
  COUNT(DISTINCT visitor_hash)::bigint AS visitors
FROM access_log
WHERE is_bot = FALSE
GROUP BY bucket, entity_type, entity_id, path, country
WITH NO DATA;
--> statement-breakpoint

DO $$ BEGIN
  PERFORM add_continuous_aggregate_policy('stats_daily',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
