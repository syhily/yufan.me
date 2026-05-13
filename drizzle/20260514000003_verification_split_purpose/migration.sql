-- Upgrade path for deployments that previously had `verification`
-- with a single `identifier` column (shape: `<purpose>:<userId>`).
-- Splits it into a `purpose` varchar(32) + `user_id` bigint pair so
-- token rows are addressable without string splitting and so a
-- UNIQUE constraint can enforce «one live token per purpose per user».
--
-- Fresh installs come out of `init_schema` already in the new shape
-- (the `identifier` column is never created), so the entire branch
-- below short-circuits via the column-existence guard.
--
-- Existing token rows are migrated in place. Any row whose
-- `identifier` doesn't match `<purpose>:<bigint>` is dropped instead
-- of failing the migration — verification tokens are by design
-- short-lived and re-issuable, and stale malformed rows are not worth
-- blocking a deploy over.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'verification' AND column_name = 'identifier'
  ) THEN
    ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "purpose" varchar(32);
    ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "user_id" bigint;
    DELETE FROM "verification" WHERE "identifier" !~ '^[^:]+:[0-9]+$';
    UPDATE "verification"
      SET "purpose" = split_part("identifier", ':', 1),
          "user_id" = (split_part("identifier", ':', 2))::bigint
      WHERE "purpose" IS NULL OR "user_id" IS NULL;
    ALTER TABLE "verification" ALTER COLUMN "purpose" SET NOT NULL;
    ALTER TABLE "verification" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "verification" DROP COLUMN "identifier";
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_verification_purpose_user"
      ON "verification" ("purpose", "user_id");
  END IF;
END $$;
