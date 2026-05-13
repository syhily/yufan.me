ALTER TABLE "user" ADD COLUMN "role" varchar(16);
--> statement-breakpoint
UPDATE "user" SET "role" = 'admin' WHERE "is_admin" = true;
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_admin";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user"("role") WHERE "role" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "delete_requested_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "delete_requested_by" bigint;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_delete_requested_at" ON "comment"("delete_requested_at") WHERE "delete_requested_at" IS NOT NULL;
