-- Inspect orphan rows before applying the metric/comment/like cleanup
-- migration. Orphans = rows whose URL `key` (or `page_key`) could not
-- be resolved to a current post/page during migration A's regex
-- backfill, so `(type, owner_id)` stayed NULL.
--
-- Run before applying migration `20260511103509_metric_owner_columns_drop_legacy`:
--
--   psql "$DATABASE_URL" -f scripts/inspect-metric-orphans.sql
--
-- The output is purely informational. To dump full comment bodies for
-- archival, see the LIMIT-free SELECT at the bottom — un-comment as
-- needed.

\echo '=== metric orphans (counter rows with no entity) ==='
SELECT id, key, title, pv, vote_up, created_at, updated_at
FROM   "metric"
WHERE  type IS NULL OR owner_id IS NULL
ORDER BY id;

\echo ''
\echo '=== comment orphans (comments whose page_key did not resolve) ==='
SELECT id, page_key, user_id, is_pending, length(coalesce(content, '')) AS body_chars, created_at
FROM   "comment"
WHERE  type IS NULL OR owner_id IS NULL
ORDER BY id;

\echo ''
\echo '=== like orphans (anonymous like tokens with no entity) ==='
SELECT id, page_key, token, created_at, deleted_at
FROM   "like"
WHERE  type IS NULL OR owner_id IS NULL
ORDER BY id;

\echo ''
\echo '=== summary ==='
SELECT
  (SELECT COUNT(*) FROM "metric"  WHERE type IS NULL OR owner_id IS NULL) AS metric_orphans,
  (SELECT COUNT(*) FROM "comment" WHERE type IS NULL OR owner_id IS NULL) AS comment_orphans,
  (SELECT COUNT(*) FROM "like"    WHERE type IS NULL OR owner_id IS NULL) AS like_orphans;

-- Uncomment to dump full comment bodies for archival before deletion:
--
-- \copy (SELECT id, page_key, user_id, content, body, created_at FROM "comment" WHERE type IS NULL OR owner_id IS NULL ORDER BY id) TO 'orphan-comments.csv' WITH CSV HEADER
