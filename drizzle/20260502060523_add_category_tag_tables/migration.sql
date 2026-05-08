CREATE TABLE "category" (
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
CREATE TABLE "tag" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"name" varchar(20) NOT NULL UNIQUE,
	"slug" varchar(80) NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE INDEX "idx_category_slug" ON "category" ("slug");--> statement-breakpoint
CREATE INDEX "idx_category_sort_order" ON "category" ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_tag_slug" ON "tag" ("slug");