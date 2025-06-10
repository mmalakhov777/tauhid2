-- Migration: Add SubscriptionResponse table
-- This migration creates a table to store subscription modal responses including partial responses

CREATE TABLE IF NOT EXISTS "SubscriptionResponse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"purpose" text,
	"name" varchar(255),
	"email" varchar(255),
	"organization" varchar(255),
	"currentStep" varchar DEFAULT 'limit' NOT NULL,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"isSubmitted" boolean DEFAULT false NOT NULL,
	"submittedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "SubscriptionResponse" ADD CONSTRAINT "SubscriptionResponse_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add check constraint for currentStep enum
DO $$ BEGIN
 ALTER TABLE "SubscriptionResponse" ADD CONSTRAINT "SubscriptionResponse_currentStep_check" CHECK ("currentStep" IN ('limit', 'purpose', 'info', 'beta'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_subscription_response_user_id" ON "SubscriptionResponse" ("userId");
CREATE INDEX IF NOT EXISTS "idx_subscription_response_created_at" ON "SubscriptionResponse" ("createdAt"); 