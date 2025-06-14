#!/usr/bin/env node

// Simple script to run the trial balance migration
// This adds the missing columns to the User table

const { Client } = require('pg');

async function runMigration() {
  console.log('🚀 Starting Trial Balance Migration...\n');

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if columns already exist
    console.log('🔍 Checking existing columns...');
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('trialMessagesRemaining', 'trialLastResetAt', 'paidMessagesRemaining', 'totalMessagesPurchased', 'lastPurchaseAt')
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);
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
        await client.query(column.sql);
      } else {
        console.log(`✅ Column already exists: ${column.name}`);
      }
    }

    // Create StarPayment table if it doesn't exist
    console.log('🌟 Creating StarPayment table...');
    await client.query(`
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
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_userId_User_id_fk" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add unique constraint if it doesn't exist
    console.log('🔒 Adding unique constraint...');
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_telegramPaymentChargeId_unique" 
        UNIQUE("telegramPaymentChargeId");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create indexes
    console.log('📊 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_star_payment_user_id" ON "StarPayment" ("userId")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_star_payment_status" ON "StarPayment" ("status")');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_star_payment_created_at" ON "StarPayment" ("createdAt")');

    // Initialize trial balance for existing users
    console.log('🎯 Initializing trial balance for existing users...');
    const updateResult = await client.query(`
      UPDATE "User" 
      SET 
        "trialMessagesRemaining" = CASE 
          WHEN "email" LIKE 'guest-%' OR "email" LIKE 'telegram_%@telegram.local' THEN 2
          ELSE 5
        END,
        "trialLastResetAt" = NOW()
      WHERE "trialMessagesRemaining" IS NULL OR "trialMessagesRemaining" = 0
    `);

    console.log(`✅ Updated ${updateResult.rowCount} users with trial balance`);

    // Check final state
    console.log('\n🔍 Final verification...');
    const finalCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('trialMessagesRemaining', 'trialLastResetAt', 'paidMessagesRemaining', 'totalMessagesPurchased', 'lastPurchaseAt')
      ORDER BY column_name
    `);

    console.log('✅ Trial balance columns now present:', finalCheck.rows.map(row => row.column_name));

    // Check if StarPayment table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'StarPayment'
    `);

    console.log('✅ StarPayment table exists:', tableCheck.rows.length > 0);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Test /dbtest command again in Telegram');
    console.log('2. Try /debug command to see trial balance');
    console.log('3. Send a regular message to test consumption');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error); 