CREATE TABLE "music" (
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
CREATE UNIQUE INDEX "uq_music_source_source_id" ON "music" ("source","source_id");--> statement-breakpoint
CREATE INDEX "idx_music_player_id" ON "music" ("player_id");--> statement-breakpoint
CREATE INDEX "idx_music_created_at" ON "music" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_music_deleted_at" ON "music" ("deleted_at");