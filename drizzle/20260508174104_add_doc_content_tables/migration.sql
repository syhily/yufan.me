CREATE TABLE "content" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"type" varchar(16) NOT NULL,
	"owner_id" bigint NOT NULL,
	"revision_no" integer NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"body" jsonb DEFAULT '[]' NOT NULL,
	"image_sources" jsonb DEFAULT '[]' NOT NULL,
	"headings" jsonb DEFAULT '[]' NOT NULL,
	"author_id" bigint,
	"client_revision_token" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc" (
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
	"published_at" timestamp with time zone NOT NULL,
	"published_revision_id" bigint
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_owner_revision" ON "content" ("type","owner_id","revision_no");--> statement-breakpoint
CREATE INDEX "idx_content_owner_status" ON "content" ("type","owner_id","status");--> statement-breakpoint
CREATE INDEX "idx_content_status" ON "content" ("status");--> statement-breakpoint
CREATE INDEX "idx_doc_slug" ON "doc" ("slug");--> statement-breakpoint
CREATE INDEX "idx_doc_deleted_at" ON "doc" ("deleted_at");