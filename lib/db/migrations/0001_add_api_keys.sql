-- Migration to add API key table
-- This migration adds support for API key authentication

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "keyHash" varchar(255) NOT NULL UNIQUE,
  "keyPrefix" varchar(20) NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "lastUsedAt" timestamp,
  "expiresAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ApiKey_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_api_key_user_id" ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "idx_api_key_hash" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "idx_api_key_prefix" ON "ApiKey"("keyPrefix");
CREATE INDEX IF NOT EXISTS "idx_api_key_active" ON "ApiKey"("isActive"); 