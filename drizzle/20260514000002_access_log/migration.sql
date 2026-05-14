CREATE TABLE "access_log" (
	"ts" timestamp with time zone NOT NULL,
	"visitor_hash" text NOT NULL,
	"session_id" text,
	"ip" inet,
	"path" text NOT NULL,
	"entity_type" varchar(16),
	"entity_id" bigint,
	"referer" text,
	"referer_host" text,
	"country" text,
	"region" text,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"timezone" text,
	"language" text,
	"ua" text,
	"browser" text,
	"browser_version" text,
	"os" text,
	"os_version" text,
	"device" text,
	"device_type" text,
	"is_bot" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_access_log_entity_ts" ON "access_log" ("entity_type","entity_id","ts");--> statement-breakpoint
CREATE INDEX "idx_access_log_path_ts" ON "access_log" ("path","ts");--> statement-breakpoint
CREATE INDEX "idx_access_log_country_ts" ON "access_log" ("country","ts");--> statement-breakpoint
CREATE INDEX "idx_access_log_visitor_ts" ON "access_log" ("visitor_hash","ts");--> statement-breakpoint
CREATE INDEX "idx_access_log_referer_host_ts" ON "access_log" ("referer_host","ts");--> statement-breakpoint
CREATE INDEX "idx_access_log_is_bot_ts" ON "access_log" ("is_bot","ts");