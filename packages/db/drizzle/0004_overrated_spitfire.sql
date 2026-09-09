CREATE TYPE "public"."compatibility_kind" AS ENUM('conflicts', 'requires');--> statement-breakpoint
CREATE TABLE "compatibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"left_resource_id" uuid NOT NULL,
	"right_resource_id" uuid NOT NULL,
	"kind" "compatibility_kind" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_left_resource_id_resources_id_fk" FOREIGN KEY ("left_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_right_resource_id_resources_id_fk" FOREIGN KEY ("right_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compatibility_rules_unique" ON "compatibility_rules" USING btree ("owner_user_id","left_resource_id","right_resource_id","kind");--> statement-breakpoint
CREATE INDEX "compatibility_rules_left_idx" ON "compatibility_rules" USING btree ("left_resource_id");--> statement-breakpoint
CREATE INDEX "compatibility_rules_right_idx" ON "compatibility_rules" USING btree ("right_resource_id");--> statement-breakpoint
CREATE INDEX "profiles_owner_lower_name_idx" ON "profiles" USING btree ("owner_user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "projects_owner_lower_name_idx" ON "projects" USING btree ("owner_user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "resources_owner_lower_name_idx" ON "resources" USING btree ("owner_user_id",lower("name"));