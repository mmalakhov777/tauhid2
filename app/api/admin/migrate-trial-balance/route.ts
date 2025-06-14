import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

// Simple admin endpoint to run the trial balance migration from production
// This can be called from production where the database is accessible

export async function POST(request: NextRequest) {
  try {
    // Simple security check - require a secret key
    const { secret } = await request.json();
    if (secret !== 'migrate-trial-balance-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Starting Trial Balance Migration via API...');

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json({ 
        error: 'POSTGRES_URL environment variable is not set',
        success: false 
      }, { status: 500 });
    }

    const client = postgres(process.env.POSTGRES_URL);
    const db = drizzle(client);

    const migrationLog: string[] = [];
    const log = (message: string) => {
      console.log(message);
      migrationLog.push(message);
    };

    try {
      log('✅ Connected to database');

      // Check if columns already exist
      log('🔍 Checking existing columns...');
      const checkColumns = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name IN ('trialMessagesRemaining', 'trialLastResetAt', 'paidMessagesRemaining', 'totalMessagesPurchased', 'lastPurchaseAt')
      `);

      const existingColumns = checkColumns.map((row: any) => row.column_name);
      log(`📋 Existing trial balance columns: ${existingColumns.join(', ')}`);

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
          log(`➕ Adding column: ${column.name}`);
          await db.execute(sql.raw(column.sql));
        } else {
          log(`✅ Column already exists: ${column.name}`);
        }
      }

      // Create StarPayment table if it doesn't exist
      log('🌟 Creating StarPayment table...');
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
      log('🔗 Adding foreign key constraint...');
      await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_userId_User_id_fk" 
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Add unique constraint if it doesn't exist
      log('🔒 Adding unique constraint...');
      await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "StarPayment" ADD CONSTRAINT "StarPayment_telegramPaymentChargeId_unique" 
          UNIQUE("telegramPaymentChargeId");
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Create indexes
      log('📊 Creating indexes...');
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_star_payment_user_id" ON "StarPayment" ("userId")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_star_payment_status" ON "StarPayment" ("status")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_star_payment_created_at" ON "StarPayment" ("createdAt")`);

      // Initialize trial balance for existing users
      log('🎯 Initializing trial balance for existing users...');
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

      log(`✅ Updated users with trial balance`);

      // Check final state
      log('🔍 Final verification...');
      const finalCheck = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name IN ('trialMessagesRemaining', 'trialLastResetAt', 'paidMessagesRemaining', 'totalMessagesPurchased', 'lastPurchaseAt')
        ORDER BY column_name
      `);

      const finalColumns = finalCheck.map((row: any) => row.column_name);
      log(`✅ Trial balance columns now present: ${finalColumns.join(', ')}`);

      // Check if StarPayment table exists
      const tableCheck = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'StarPayment'
      `);

      log(`✅ StarPayment table exists: ${tableCheck.length > 0}`);

      // Check specific user (Telegram user 321097981)
      log('👤 Checking Telegram user 321097981...');
      const userCheck = await db.execute(sql`
        SELECT "id", "email", "telegramId", "trialMessagesRemaining", "trialLastResetAt"
        FROM "User" 
        WHERE "telegramId" = 321097981
      `);

      let userInfo = null;
      if (userCheck.length > 0) {
        const user = userCheck[0] as any;
        userInfo = {
          id: user.id,
          email: user.email,
          telegramId: user.telegramId,
          trialMessagesRemaining: user.trialMessagesRemaining,
          trialLastResetAt: user.trialLastResetAt
        };
        log(`✅ Telegram user found: ${JSON.stringify(userInfo)}`);
      } else {
        log('⚠️ Telegram user not found - will be created on next message');
      }

      log('🎉 Migration completed successfully!');

      return NextResponse.json({
        success: true,
        message: 'Trial balance migration completed successfully',
        log: migrationLog,
        userInfo,
        finalColumns,
        starPaymentTableExists: tableCheck.length > 0
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`❌ Migration failed: ${errorMessage}`);
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
        log: migrationLog
      }, { status: 500 });
    } finally {
      await client.end();
      log('🔌 Database connection closed');
    }

  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Trial Balance Migration API',
    usage: 'POST with { "secret": "migrate-trial-balance-2025" }',
    status: 'ready'
  });
} 