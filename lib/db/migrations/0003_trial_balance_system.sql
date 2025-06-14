-- Migration: Add Trial Balance System
-- This migration adds trial balance tracking and Telegram Stars payment system

-- Add trial balance columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialMessagesRemaining" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialLastResetAt" TIMESTAMP DEFAULT NOW();
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paidMessagesRemaining" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalMessagesPurchased" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPurchaseAt" TIMESTAMP;

-- Create StarPayment table for tracking Telegram Stars purchases
CREATE TABLE IF NOT EXISTS "StarPayment" (
	"id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" UUID NOT NULL,
	"telegramPaymentChargeId" VARCHAR(255) NOT NULL,
	"starAmount" INTEGER NOT NULL,
	"messagesAdded" INTEGER NOT NULL,
	"status" VARCHAR(20) DEFAULT 'completed' NOT NULL,
	"createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add unique constraint on telegramPaymentChargeId (to prevent duplicate payments)
DO $$ BEGIN
 ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_telegramPaymentChargeId_unique" UNIQUE("telegramPaymentChargeId");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_star_payment_user_id" ON "StarPayment" ("userId");
CREATE INDEX IF NOT EXISTS "idx_star_payment_status" ON "StarPayment" ("status");
CREATE INDEX IF NOT EXISTS "idx_star_payment_created_at" ON "StarPayment" ("createdAt");

-- Initialize trial balance for existing users
-- Guest users get 2 messages, regular users get 5 messages
UPDATE "User" 
SET 
  "trialMessagesRemaining" = CASE 
    WHEN "email" LIKE 'guest-%' OR "email" LIKE 'telegram_%@telegram.local' THEN 2
    ELSE 5
  END,
  "trialLastResetAt" = NOW()
WHERE "trialMessagesRemaining" IS NULL OR "trialMessagesRemaining" = 0;

-- Add comment for documentation
COMMENT ON TABLE "StarPayment" IS 'Tracks Telegram Stars payments for additional messages';
COMMENT ON COLUMN "User"."trialMessagesRemaining" IS 'Daily trial messages remaining (resets every 24 hours)';
COMMENT ON COLUMN "User"."trialLastResetAt" IS 'Last time trial balance was reset';
COMMENT ON COLUMN "User"."paidMessagesRemaining" IS 'Paid messages remaining from Telegram Stars purchases';
COMMENT ON COLUMN "User"."totalMessagesPurchased" IS 'Total messages purchased with Telegram Stars (lifetime)';
COMMENT ON COLUMN "User"."lastPurchaseAt" IS 'Last Telegram Stars purchase timestamp'; 