-- Cleanup pass for the (type, owner_id) refactor.
--
-- The additive migration that precedes this one populated the new
-- `(type, owner_id)` columns from the legacy URL `key` via a regex
-- backfill. By the time this cleanup migration runs the operator must
-- have already manually swept any rows the regex couldn't resolve —
-- otherwise the NOT NULL guards below abort the migration and leave
-- the legacy columns intact for re-attempt.
--
-- Guard: refuse to drop the legacy columns while orphans still exist.
-- The orphan check is repeated per-table so the failure message points
-- at exactly which table needs a sweep.
DO $$
DECLARE
  metric_orphans bigint;
  comment_orphans bigint;
  like_orphans bigint;
BEGIN
  SELECT COUNT(*) INTO metric_orphans FROM "metric" WHERE type IS NULL OR owner_id IS NULL;
  SELECT COUNT(*) INTO comment_orphans FROM "comment" WHERE type IS NULL OR owner_id IS NULL;
  SELECT COUNT(*) INTO like_orphans FROM "like" WHERE type IS NULL OR owner_id IS NULL;
  IF metric_orphans > 0 THEN
    RAISE EXCEPTION 'metric has % orphan rows missing (type, owner_id); sweep before applying.', metric_orphans;
  END IF;
  IF comment_orphans > 0 THEN
    RAISE EXCEPTION 'comment has % orphan rows missing (type, owner_id); sweep before applying.', comment_orphans;
  END IF;
  IF like_orphans > 0 THEN
    RAISE EXCEPTION 'like has % orphan rows missing (type, owner_id); sweep before applying.', like_orphans;
  END IF;
END $$;

-- Enforce the invariant.
ALTER TABLE "metric"  ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "metric"  ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "comment" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "comment" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "like"    ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "like"    ALTER COLUMN "owner_id" SET NOT NULL;

-- Replace the partial `uq_metric_owner` (created in migration A with
-- `WHERE type IS NOT NULL AND owner_id IS NOT NULL`) with an
-- unconditional unique index now that both columns are NOT NULL.
DROP INDEX IF EXISTS "uq_metric_owner";
CREATE UNIQUE INDEX "uq_metric_owner" ON "metric" ("type", "owner_id");

-- Drop legacy indexes and constraints.
DROP INDEX IF EXISTS "idx_metric_key";
DROP INDEX IF EXISTS "idx_comment_page_key";
ALTER TABLE "metric" DROP CONSTRAINT IF EXISTS "metric_key_unique";

-- Drop legacy URL columns.
ALTER TABLE "metric"  DROP COLUMN IF EXISTS "key";
ALTER TABLE "metric"  DROP COLUMN IF EXISTS "title";
ALTER TABLE "comment" DROP COLUMN IF EXISTS "page_key";
ALTER TABLE "like"    DROP COLUMN IF EXISTS "page_key";
