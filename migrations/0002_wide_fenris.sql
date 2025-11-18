ALTER TABLE "users" ADD COLUMN "subscription_plan" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;