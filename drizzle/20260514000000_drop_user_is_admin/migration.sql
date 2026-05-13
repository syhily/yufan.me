-- Drop the legacy `user.is_admin` column. The previous migration
-- (`20260513230909_add_user_role_and_backfill`) already populated
-- `user.role`; all application code has been switched over.

ALTER TABLE "user" DROP COLUMN IF EXISTS "is_admin";
