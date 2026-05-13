-- Add `user.role` (admin | author | visitor), backfill from legacy
-- `is_admin`, then drop the boolean column.
--
-- Backfill strategy:
--   * is_admin = true  → role = 'admin'
--   * is_admin = false AND password <> '' → role = 'visitor'
--   * is_admin = false AND password = ''  → role = NULL (anonymous placeholder)

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" varchar(16);

UPDATE "user" SET "role" = 'admin' WHERE "is_admin" = true;
UPDATE "user" SET "role" = 'visitor' WHERE "is_admin" = false AND "password" <> '';
UPDATE "user" SET "role" = NULL WHERE "is_admin" = false AND "password" = '';

CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user"("role") WHERE "role" IS NOT NULL;

ALTER TABLE "user" DROP COLUMN IF EXISTS "is_admin";
