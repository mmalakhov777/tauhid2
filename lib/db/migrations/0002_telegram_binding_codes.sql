-- Migration: Add TelegramBindingCode table
-- This migration creates a table to store temporary binding codes for users who want to connect their Telegram account

CREATE TABLE IF NOT EXISTS "TelegramBindingCode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"bindingCode" varchar(8) NOT NULL,
	"isUsed" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"usedAt" timestamp,
	"telegramId" integer,
	"telegramUsername" varchar(32),
	"telegramFirstName" varchar(64),
	"telegramLastName" varchar(64),
	"telegramPhotoUrl" text,
	"telegramLanguageCode" varchar(10),
	"telegramIsPremium" boolean DEFAULT false,
	"telegramAllowsWriteToPm" boolean DEFAULT false
);

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'TelegramBindingCode_userId_User_id_fk'
        AND table_name = 'TelegramBindingCode'
    ) THEN
        ALTER TABLE "TelegramBindingCode" ADD CONSTRAINT "TelegramBindingCode_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- Add unique constraint on binding code (to prevent duplicates)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'TelegramBindingCode_bindingCode_unique'
        AND table_name = 'TelegramBindingCode'
    ) THEN
        ALTER TABLE "TelegramBindingCode" ADD CONSTRAINT "TelegramBindingCode_bindingCode_unique" UNIQUE("bindingCode");
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_telegram_binding_code_user_id" ON "TelegramBindingCode" ("userId");
CREATE INDEX IF NOT EXISTS "idx_telegram_binding_code_binding_code" ON "TelegramBindingCode" ("bindingCode");
CREATE INDEX IF NOT EXISTS "idx_telegram_binding_code_expires_at" ON "TelegramBindingCode" ("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_telegram_binding_code_is_used" ON "TelegramBindingCode" ("isUsed");

-- Create partial index for active (non-expired, non-used) codes
CREATE INDEX IF NOT EXISTS "idx_telegram_binding_code_active" ON "TelegramBindingCode" ("bindingCode", "expiresAt") 
WHERE "isUsed" = false; 