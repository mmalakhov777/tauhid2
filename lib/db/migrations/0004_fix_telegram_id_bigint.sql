-- Migration: Fix Telegram ID to use BIGINT instead of INTEGER
-- This migration changes telegramId columns to support large Telegram IDs

-- Step 1: Change telegramId in User table from INTEGER to BIGINT
DO $$ 
BEGIN
    -- Only alter if the column exists and is INTEGER type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name = 'telegramId' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "User" ALTER COLUMN "telegramId" TYPE BIGINT;
    END IF;
END $$;

-- Step 2: Change telegramId in TelegramBindingCode table from INTEGER to BIGINT  
DO $$
BEGIN
    -- Only alter if the column exists and is INTEGER type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'TelegramBindingCode' 
        AND column_name = 'telegramId' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE "TelegramBindingCode" ALTER COLUMN "telegramId" TYPE BIGINT;
    END IF;
END $$;

-- Add comments for documentation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        COMMENT ON COLUMN "User"."telegramId" IS 'Telegram user ID (BIGINT to support large IDs)';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'TelegramBindingCode') THEN
        COMMENT ON COLUMN "TelegramBindingCode"."telegramId" IS 'Telegram user ID (BIGINT to support large IDs)';
    END IF;
END $$;

-- Note: This migration fixes the issue where large Telegram IDs (> 2^31-1) 
-- were causing "value out of range for type integer" errors 