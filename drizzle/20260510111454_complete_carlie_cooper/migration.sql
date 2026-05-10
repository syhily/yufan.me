ALTER TABLE "page" ADD COLUMN "first_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "first_published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_page_first_published_at" ON "page" ("first_published_at");--> statement-breakpoint
CREATE INDEX "idx_post_first_published_at" ON "post" ("first_published_at");--> statement-breakpoint
UPDATE "page" SET "first_published_at" = "published_at" WHERE "first_published_at" IS NULL AND "published" = true;--> statement-breakpoint
UPDATE "post" SET "first_published_at" = "published_at" WHERE "first_published_at" IS NULL AND "published" = true;