CREATE TABLE "friend" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"website" varchar(80) NOT NULL,
	"description" text,
	"homepage" text NOT NULL,
	"poster" text NOT NULL,
	"rss_url" text,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_friend_visible" ON "friend" ("visible");--> statement-breakpoint
CREATE INDEX "idx_friend_homepage" ON "friend" ("homepage");