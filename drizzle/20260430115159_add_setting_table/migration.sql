CREATE TABLE IF NOT EXISTS "setting" (
	"id" bigserial PRIMARY KEY,
	"scope" varchar(64) DEFAULT 'blog' NOT NULL UNIQUE,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" bigint
);
