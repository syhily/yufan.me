CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY,
	"action" varchar(50) NOT NULL,
	"actor_id" bigint,
	"actor_role" varchar(20),
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(100),
	"details" jsonb,
	"ip_address" inet,
	"user_agent" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor" ON "audit_log" ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_resource" ON "audit_log" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" ("action");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id");