CREATE TABLE IF NOT EXISTS "comment" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"content" text DEFAULT '',
	"page_key" varchar(255) NOT NULL,
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
	"root_id" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "like" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"token" varchar(255),
	"page_key" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"key" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"vote_up" bigint,
	"vote_down" bigint,
	"pv" bigint,
	CONSTRAINT "page_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"link" text,
	"password" text NOT NULL,
	"badge_name" text,
	"badge_color" text,
	"last_ip" text,
	"last_ua" text,
	"is_admin" boolean DEFAULT false,
	"receive_email" boolean DEFAULT true,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_root_id" ON "comment" USING btree ("root_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "comment" USING btree ("rid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_user_id" ON "comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_page_key" ON "comment" USING btree ("page_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comment_deleted_at" ON "comment" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_like_token" ON "like" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_key" ON "page" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_deleted_at" ON "page" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_name" ON "user" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_deleted_at" ON "user" USING btree ("deleted_at");
