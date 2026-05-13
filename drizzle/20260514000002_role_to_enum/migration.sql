-- Upgrade path for deployments that previously had `user.role` as
-- `varchar(16)`. Fresh installs come out of `init_schema` with the
-- enum already in place, so this ALTER becomes a no-op there
-- (information_schema sees `USER-DEFINED` for the column type).
--
-- Existing rows with non-enum values fail the cast — that's the
-- desired behaviour, since the application-side `Role` union only
-- knows three values. If you somehow land here with a stray value
-- like `'editor'`, the migration fails loud, and you fix the row
-- by hand before re-running.
DO $$ BEGIN
  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'role'
  ) = 'character varying' THEN
    ALTER TABLE "user" ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
  END IF;
END $$;
