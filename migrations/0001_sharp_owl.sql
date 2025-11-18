ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;