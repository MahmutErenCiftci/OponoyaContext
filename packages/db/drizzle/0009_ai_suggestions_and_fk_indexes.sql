CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"slot" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_hash" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "ai_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_suggestions_project_created_idx" ON "ai_suggestions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_suggestions_owner_created_idx" ON "ai_suggestions" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "export_events_project_created_idx" ON "export_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "export_events_context_version_idx" ON "export_events" USING btree ("context_version_id");--> statement-breakpoint
CREATE INDEX "global_decisions_resource_idx" ON "global_decisions" USING btree ("resource_id") WHERE resource_id is not null;--> statement-breakpoint
CREATE INDEX "profile_decisions_resource_idx" ON "profile_decisions" USING btree ("resource_id") WHERE resource_id is not null;--> statement-breakpoint
CREATE INDEX "project_decisions_resource_idx" ON "project_decisions" USING btree ("resource_id") WHERE resource_id is not null;--> statement-breakpoint
CREATE INDEX "project_profiles_profile_idx" ON "project_profiles" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "recipe_decisions_resource_idx" ON "recipe_decisions" USING btree ("resource_id") WHERE resource_id is not null;--> statement-breakpoint
CREATE INDEX "recipe_profiles_profile_idx" ON "recipe_profiles" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "resource_tags_tag_idx" ON "resource_tags" USING btree ("tag_id");