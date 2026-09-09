CREATE TABLE "project_resources" (
	"project_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_resources_project_id_resource_id_pk" PRIMARY KEY("project_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_request_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_resources_resource_idx" ON "project_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_request_unique" ON "projects" USING btree ("owner_user_id","client_request_id");