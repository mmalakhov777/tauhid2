-- Migration file for Telegram authentication support
-- This migration adds Telegram user fields to the User table

-- Note: This migration may already be applied to the database
-- The statements below are idempotent and safe to run multiple times

DO $$ BEGIN
  -- Add Telegram fields to User table if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramId') THEN
    ALTER TABLE "User" ADD COLUMN "telegramId" integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramUsername') THEN
    ALTER TABLE "User" ADD COLUMN "telegramUsername" varchar(32);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramFirstName') THEN
    ALTER TABLE "User" ADD COLUMN "telegramFirstName" varchar(64);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramLastName') THEN
    ALTER TABLE "User" ADD COLUMN "telegramLastName" varchar(64);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramPhotoUrl') THEN
    ALTER TABLE "User" ADD COLUMN "telegramPhotoUrl" text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramLanguageCode') THEN
    ALTER TABLE "User" ADD COLUMN "telegramLanguageCode" varchar(10);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramIsPremium') THEN
    ALTER TABLE "User" ADD COLUMN "telegramIsPremium" boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'telegramAllowsWriteToPm') THEN
    ALTER TABLE "User" ADD COLUMN "telegramAllowsWriteToPm" boolean DEFAULT false;
  END IF;
END $$;

-- Add unique constraint on telegramId if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'User_telegramId_unique'
        AND table_name = 'User'
    ) THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_telegramId_unique" UNIQUE("telegramId");
    END IF;
END $$; 