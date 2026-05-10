ALTER TABLE "post" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_post_pinned_at" ON "post" ("pinned_at");