-- Switch metric / comment / like keying from URL-based `page_key` to a
-- `(type, owner_id)` discriminator plus a `public_id uuid` surrogate
-- exposed on the public API wire. Background: the legacy URL key
-- broke whenever `siteIdentity.website` changed or a post / page slug
-- got renamed, silently orphaning every dependent row. The new shape
-- references `post.id` / `page.id` directly so renames are inert, and
-- the UUID hides numeric ids from the client bundle.
--
-- This migration is additive: the legacy URL columns stay in place so
-- a partial deploy with the new + old code paths coexist. A follow-up
-- migration drops them once production has cut over.
--
-- pgcrypto provides `gen_random_uuid()`. It's already installed on the
-- baseline DB image; this is a no-op when re-applied.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --- metric -----------------------------------------------------------
ALTER TABLE "metric" ADD COLUMN IF NOT EXISTS "type" varchar(16);
ALTER TABLE "metric" ADD COLUMN IF NOT EXISTS "owner_id" bigint;
ALTER TABLE "metric" ADD COLUMN IF NOT EXISTS "public_id" uuid NOT NULL DEFAULT gen_random_uuid();
-- Drop the legacy NOT NULL guards so new (UUID-only) inserts can omit
-- the URL columns. Constraints stay around until the cleanup migration.
ALTER TABLE "metric" ALTER COLUMN "key" DROP NOT NULL;
ALTER TABLE "metric" ALTER COLUMN "title" DROP NOT NULL;

-- --- comment ----------------------------------------------------------
ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS "type" varchar(16);
ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS "owner_id" bigint;
ALTER TABLE "comment" ALTER COLUMN "page_key" DROP NOT NULL;

-- --- like -------------------------------------------------------------
ALTER TABLE "like" ADD COLUMN IF NOT EXISTS "type" varchar(16);
ALTER TABLE "like" ADD COLUMN IF NOT EXISTS "owner_id" bigint;

-- --- backfill ---------------------------------------------------------
-- Best-effort backfill from the URL `key`. We pull the pathname out of
-- the URL with a regex and look up the matching post / page by slug.
-- Anything that doesn't match (host changed, slug renamed without an
-- alias, pre-WordPress imports) lands as NULL — the application code
-- treats those rows as orphaned and the operator can sweep them by
-- hand from `/wp-admin/comments` before the cleanup migration enforces
-- NOT NULL.
WITH parsed AS (
  SELECT
    m.id AS metric_id,
    CASE WHEN m.key ~ '^https?://[^/]+/posts/' THEN 'post' ELSE 'page' END AS guessed_type,
    CASE
      WHEN m.key ~ '^https?://[^/]+/posts/([^/?#]+)' THEN substring(m.key from '^https?://[^/]+/posts/([^/?#]+)')
      WHEN m.key ~ '^https?://[^/]+/([^/?#]+)'       THEN substring(m.key from '^https?://[^/]+/([^/?#]+)')
      ELSE NULL
    END AS guessed_slug
  FROM "metric" m
  WHERE m.type IS NULL AND m.key IS NOT NULL
)
UPDATE "metric" m
SET type = p.guessed_type,
    owner_id = CASE
      WHEN p.guessed_type = 'post' THEN po.id
      WHEN p.guessed_type = 'page' THEN pg.id
    END
FROM parsed p
LEFT JOIN "post" po ON p.guessed_type = 'post' AND po.slug = p.guessed_slug
LEFT JOIN "page" pg ON p.guessed_type = 'page' AND pg.slug = p.guessed_slug
WHERE m.id = p.metric_id
  AND (
    (p.guessed_type = 'post' AND po.id IS NOT NULL) OR
    (p.guessed_type = 'page' AND pg.id IS NOT NULL)
  );

-- Copy the resolved (type, owner_id) onto every comment / like row by
-- matching `page_key = metric.key`. Orphaned metric rows stay NULL on
-- the comment / like side too.
UPDATE "comment" c
SET    type = m.type, owner_id = m.owner_id
FROM   "metric" m
WHERE  c.page_key = m.key
  AND  m.type IS NOT NULL
  AND  c.type IS NULL;

UPDATE "like" l
SET    type = m.type, owner_id = m.owner_id
FROM   "metric" m
WHERE  l.page_key = m.key
  AND  m.type IS NOT NULL
  AND  l.type IS NULL;

-- --- indexes ----------------------------------------------------------
-- Partial-unique on (type, owner_id) so orphan NULL rows from the
-- backfill don't crash the constraint while still preventing dupes
-- once the columns are populated.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_metric_public_id" ON "metric" ("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_metric_owner"
  ON "metric" ("type", "owner_id")
  WHERE "type" IS NOT NULL AND "owner_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_comment_owner" ON "comment" ("type", "owner_id");
CREATE INDEX IF NOT EXISTS "idx_like_owner" ON "like" ("type", "owner_id");
