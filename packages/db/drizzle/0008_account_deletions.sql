CREATE TABLE "account_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"billing_provider" text,
	"billing_customer_id" text,
	"billing_subscription_id" text,
	"billing_plan" text,
	"billing_status" text,
	"billing_revoked_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"request_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletions_user_unique" ON "account_deletions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_deletions_status_idx" ON "account_deletions" USING btree ("status","requested_at");