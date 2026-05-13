-- Add `user.role` (admin | author | visitor), backfill from legacy
-- `is_admin`. The legacy column is kept for one release so the rollout
-- can be done in two steps; it is dropped in a follow-up migration.
--
-- Backfill strategy:
--   * is_admin = true                       → role = 'admin'
--   * is_admin = false AND password <> ''   → role = 'visitor'
--   * is_admin = false AND password = ''    → role = NULL (anonymous placeholder)
--
-- Also add an index on `verification.value` to support the SHA-256 hash
-- lookup performed by `consumeToken` / `peekToken`.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" varchar(16);

UPDATE "user" SET "role" = 'admin' WHERE "is_admin" = true;
UPDATE "user" SET "role" = 'visitor' WHERE "is_admin" = false AND "password" <> '';
UPDATE "user" SET "role" = NULL WHERE "is_admin" = false AND "password" = '';

CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user"("role") WHERE "role" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_verification_value" ON "verification"("value");
