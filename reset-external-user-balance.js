const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

async function resetExternalUserBalance() {
  console.log('🔄 Resetting external API user trial balance...\n');

  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL environment variable is not set');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  try {
    console.log('✅ Connected to database');

    // Find the external API user
    const externalUsers = await db.execute(sql`
      SELECT "id", "email", "trialMessagesRemaining", "paidMessagesRemaining", "trialLastResetAt"
      FROM "User" 
      WHERE "email" = 'external-api@system.local'
    `);

    if (externalUsers.length === 0) {
      console.log('❌ External API user not found. Creating one...');
      
      // Create the external API user
      await db.execute(sql`
        INSERT INTO "User" ("id", "email", "password", "trialMessagesRemaining", "trialLastResetAt")
        VALUES (gen_random_uuid(), 'external-api@system.local', 'system-generated-password', 5, NOW())
      `);
      
      console.log('✅ Created external API user with 5 trial messages');
    } else {
      const user = externalUsers[0];
      console.log('📋 Current external API user state:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Trial Messages: ${user.trialMessagesRemaining}`);
      console.log(`   Paid Messages: ${user.paidMessagesRemaining}`);
      console.log(`   Last Reset: ${user.trialLastResetAt}`);

      // Reset the trial balance
      await db.execute(sql`
        UPDATE "User" 
        SET 
          "trialMessagesRemaining" = 5,
          "trialLastResetAt" = NOW()
        WHERE "email" = 'external-api@system.local'
      `);

      console.log('✅ Reset external API user trial balance to 5 messages');
    }

    // Verify the reset
    const updatedUsers = await db.execute(sql`
      SELECT "id", "email", "trialMessagesRemaining", "paidMessagesRemaining", "trialLastResetAt"
      FROM "User" 
      WHERE "email" = 'external-api@system.local'
    `);

    if (updatedUsers.length > 0) {
      const user = updatedUsers[0];
      console.log('\n📋 Updated external API user state:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Trial Messages: ${user.trialMessagesRemaining}`);
      console.log(`   Paid Messages: ${user.paidMessagesRemaining}`);
      console.log(`   Last Reset: ${user.trialLastResetAt}`);
    }

    console.log('\n🎉 External API user trial balance reset completed!');
    console.log('✅ You can now test the cryptocurrency query');

  } catch (error) {
    console.error('❌ Reset failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetExternalUserBalance(); 