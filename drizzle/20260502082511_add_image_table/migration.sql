CREATE TABLE "image" (
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
CREATE INDEX "idx_image_created_at" ON "image" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_image_deleted_at" ON "image" ("deleted_at");
