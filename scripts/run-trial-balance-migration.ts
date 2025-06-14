#!/usr/bin/env tsx

// Migration script to add trial balance system columns
// Uses the existing database connection setup

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('🚀 Starting Trial Balance Migration...\n');

  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL environment variable is not set');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  try {
    console.log('✅ Connected to database');

    // Check if columns already exist
    console.log('🔍 Checking existing columns...');
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('trialMessagesRemaining', 'trialLastResetAt', 'paidMessagesRemaining', 'totalMessagesPurchased', 'lastPurchaseAt')
    `);

    const existingColumns = checkColumns.map((row: any) => row.column_name);
    console.log('📋 Existing trial balance columns:', existingColumns);

    // Add missing columns
    const columnsToAdd = [
      { name: 'trialMessagesRemaining', sql: 'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialMessagesRemaining" INTEGER DEFAULT 0' },
      { name: 'trialLastResetAt', sql: 'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialLastResetAt" TIMESTAMP DEFAULT NOW()' },
      { name: 'paidMessagesRemaining', sql: 'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paidMessagesRemaining" INTEGER DEFAULT 0' },
      { name: 'totalMessagesPurchased', sql: 'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalMessagesPurchased" INTEGER DEFAULT 0' },
      { name: 'lastPurchaseAt', sql: 'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPurchaseAt" TIMESTAMP' }
    ];

    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);
        await db.execute(sql.raw(column.sql));
      } else {
        console.log(`✅ Column already exists: ${column.name}`);
      }
    }

    // Create StarPayment table if it doesn't exist
    console.log('🌟 Creating StarPayment table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "StarPayment" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "userId" UUID NOT NULL,
        "telegramPaymentChargeId" VARCHAR(255) NOT NULL,
        "starAmount" INTEGER NOT NULL,
        "messagesAdded" INTEGER NOT NULL,
        "status" VARCHAR(20) DEFAULT 'completed' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Add foreign key constraint if it doesn't exist
    console.log('🔗 Adding foreign key constraint...');
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_userId_User_id_fk" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add unique constraint if it doesn't exist
    console.log('🔒 Adding unique constraint...');
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_telegramPaymentChargeId_unique" 
        UNIQUE("telegramPaymentChargeId");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create indexes
    console.log('📊 Creating indexes...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_star_payment_user_id" ON "StarPayment" ("userId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_star_payment_status" ON "StarPayment" ("status")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_star_payment_created_at" ON "StarPayment" ("createdAt")`);

    // Initialize trial balance for existing users
    console.log('🎯 Initializing trial balance for existing users...');
    const updateResult = await db.execute(sql`
      UPDATE "User" 
      SET 
        "trialMessagesRemaining" = CASE 
          WHEN "email" LIKE 'guest-%' OR "email" LIKE 'telegram_%@telegram.local' THEN 2
          ELSE 5
        END,
        "trialLastResetAt" = NOW()
      WHERE "trialMessagesRemaining" IS NULL OR "trialMessagesRemaining" = 0
    `);

    console.log(`✅ Updated users with trial balance`);

    // Check final state
    console.log('\n🔍 Final verification...');
    const finalCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('trialMessagesRemaining', 'trialLastResetAt', 'paidMessagesRemaining', 'totalMessagesPurchased', 'lastPurchaseAt')
      ORDER BY column_name
    `);

    console.log('✅ Trial balance columns now present:', finalCheck.map((row: any) => row.column_name));

    // Check if StarPayment table exists
    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'StarPayment'
    `);

    console.log('✅ StarPayment table exists:', tableCheck.length > 0);

    // Check specific user (your Telegram user)
    console.log('\n👤 Checking your Telegram user...');
    const userCheck = await db.execute(sql`
      SELECT "id", "email", "telegramId", "trialMessagesRemaining", "trialLastResetAt"
      FROM "User" 
      WHERE "telegramId" = 321097981
    `);

    if (userCheck.length > 0) {
      const user = userCheck[0] as any;
      console.log('✅ Your user found:', {
        id: user.id,
        email: user.email,
        telegramId: user.telegramId,
        trialMessagesRemaining: user.trialMessagesRemaining,
        trialLastResetAt: user.trialLastResetAt
      });
    } else {
      console.log('⚠️ Your Telegram user not found - will be created on next message');
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Test /dbtest command again in Telegram');
    console.log('2. Try /debug command to see trial balance');
    console.log('3. Send a regular message to test consumption');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error); 