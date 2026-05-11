-- Cleanup pass for the (type, owner_id) refactor.
--
-- The additive migration that precedes this one populated the new
-- `(type, owner_id)` columns from the legacy URL `key` via a regex
-- backfill. Anything the regex couldn't resolve to a current post /
-- page row landed with NULL discriminators — those rows now reference
-- entities that no longer exist (deleted posts, pre-rename URLs from
-- before alias tracking landed, pre-migration WordPress pageviews).
-- They have no path forward under the new keying scheme.
--
-- This migration deletes the orphan rows and emits a NOTICE per table
-- so the count shows up in the migration log. If you want to archive
-- the bodies before they go, run
-- `scripts/inspect-metric-orphans.sql` first (it has a `\copy` line
-- that dumps full comment bodies to CSV).
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
    RAISE NOTICE 'Deleting % orphan metric rows (no matching post/page).', metric_orphans;
    DELETE FROM "metric" WHERE type IS NULL OR owner_id IS NULL;
  END IF;
  IF comment_orphans > 0 THEN
    RAISE NOTICE 'Deleting % orphan comment rows (no matching post/page).', comment_orphans;
    DELETE FROM "comment" WHERE type IS NULL OR owner_id IS NULL;
  END IF;
  IF like_orphans > 0 THEN
    RAISE NOTICE 'Deleting % orphan like rows (no matching post/page).', like_orphans;
    DELETE FROM "like" WHERE type IS NULL OR owner_id IS NULL;
  END IF;
END $$;

-- Enforce the invariant now that the orphans are gone.
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
