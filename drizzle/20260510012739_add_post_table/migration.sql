CREATE TABLE "post" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"slug" varchar(80) NOT NULL UNIQUE,
	"title" varchar(200) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"cover" text DEFAULT '' NOT NULL,
	"og" text,
	"published" boolean DEFAULT true NOT NULL,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"show_toc" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_revision_id" bigint,
	"category" varchar(20) DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"alias" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_post_slug" ON "post" ("slug");--> statement-breakpoint
CREATE INDEX "idx_post_deleted_at" ON "post" ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_post_category" ON "post" ("category");--> statement-breakpoint
CREATE INDEX "idx_post_published_at" ON "post" ("published_at");