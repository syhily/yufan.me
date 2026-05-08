-- Postgres CREATE TYPE has no IF NOT EXISTS clause; emulate via DO block.
DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM('admin', 'author', 'visitor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"name" varchar(20) NOT NULL UNIQUE,
	"slug" varchar(80) NOT NULL UNIQUE,
	"cover" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"content" text DEFAULT '',
	"body" jsonb DEFAULT '[]' NOT NULL,
	"type" varchar(16),
	"owner_id" bigint,
	"user_id" bigint NOT NULL,
	"is_verified" boolean DEFAULT false,
	"ua" text,
	"ip" text,
	"rid" bigint DEFAULT 0 NOT NULL,
	"is_collapsed" boolean DEFAULT false,
	"is_pending" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"vote_up" bigint,
	"vote_down" bigint,
	"root_id" bigint,
	"delete_requested_at" timestamp with time zone,
	"delete_requested_by" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content" (
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
CREATE TABLE IF NOT EXISTS "friend" (
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
CREATE TABLE IF NOT EXISTS "image" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"storage_path" varchar(500) NOT NULL UNIQUE,
	"mime_type" varchar(60) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" bigint NOT NULL,
	"thumbhash" text,
	"uploader_id" bigint,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "like" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"token" varchar(255),
	"type" varchar(16),
	"owner_id" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metric" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"type" varchar(16),
	"owner_id" bigint,
	"public_id" uuid NOT NULL,
	"vote_up" bigint,
	"vote_down" bigint,
	"pv" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "music" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"source" varchar(20) NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"player_id" varchar(16) NOT NULL UNIQUE,
	"name" varchar(200) NOT NULL,
	"artist" varchar(200) NOT NULL,
	"album" varchar(200) NOT NULL,
	"audio_storage_path" varchar(500) NOT NULL UNIQUE,
	"cover_storage_path" varchar(500) NOT NULL UNIQUE,
	"lyric" text,
	"uploader_id" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page" (
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
	"show_updated" boolean DEFAULT false NOT NULL,
	"show_friends" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_revision_id" bigint,
	"first_published_at" timestamp with time zone,
	"author_id" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post" (
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
	"show_updated" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_revision_id" bigint,
	"first_published_at" timestamp with time zone,
	"author_id" bigint,
	"category" varchar(20) DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"alias" jsonb DEFAULT '[]' NOT NULL,
	"pinned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_search_index" (
	"post_id" bigint PRIMARY KEY,
	"plain_text" text DEFAULT '' NOT NULL,
	"embedding" vector(1536),
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setting" (
	"id" bigserial PRIMARY KEY,
	"scope" varchar(64) DEFAULT 'blog' NOT NULL UNIQUE,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tag" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"name" varchar(20) NOT NULL UNIQUE,
	"slug" varchar(80) NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"link" text,
	"password" text NOT NULL,
	"badge_name" text,
	"badge_color" text,
	"badge_text_color" text,
	"last_ip" text,
	"last_ua" text,
	"role" "user_role",
	"is_muted" boolean DEFAULT false NOT NULL,
	"receive_email" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY,
	"purpose" varchar(32) NOT NULL,
	"user_id" bigint NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_slug" ON "category" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_sort_order" ON "category" ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_root_id" ON "comment" ("root_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "comment" ("rid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_user_id" ON "comment" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_owner" ON "comment" ("type","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_deleted_at" ON "comment" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_delete_requested_at" ON "comment" ("delete_requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_content_owner_revision" ON "content" ("type","owner_id","revision_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_owner_status" ON "content" ("type","owner_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_status" ON "content" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_friend_visible" ON "friend" ("visible");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_friend_homepage" ON "friend" ("homepage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_image_created_at" ON "image" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_image_deleted_at" ON "image" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_like_token" ON "like" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_like_owner" ON "like" ("type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_metric_public_id" ON "metric" ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_metric_owner" ON "metric" ("type","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_metric_deleted_at" ON "metric" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_music_source_source_id" ON "music" ("source","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_music_player_id" ON "music" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_music_created_at" ON "music" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_music_deleted_at" ON "music" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_slug" ON "page" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_deleted_at" ON "page" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_first_published_at" ON "page" ("first_published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_slug" ON "post" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_deleted_at" ON "post" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_category" ON "post" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_published_at" ON "post" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_first_published_at" ON "post" ("first_published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_pinned_at" ON "post" ("pinned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_search_embedding" ON "post_search_index" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tag_slug" ON "tag" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "user" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_name" ON "user" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_deleted_at" ON "user" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user" ("role") WHERE role IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_verification_value" ON "verification" ("value");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_verification_purpose_user" ON "verification" ("purpose","user_id");