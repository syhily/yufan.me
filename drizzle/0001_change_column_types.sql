ALTER TABLE "comment" ALTER COLUMN "content" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "page_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "rid" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "rid" SET NOT NULL;