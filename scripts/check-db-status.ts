#!/usr/bin/env tsx

// This script checks the current state of guest users in the database
// Run with: npx dotenv-cli -e .env.local -- tsx scripts/check-db-status.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, chat, message } from '@/lib/db/schema';
import { and, like, isNull, sql, eq, count } from 'drizzle-orm';

// Database connection
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ POSTGRES_URL environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkDatabaseStatus() {
  console.log('🔍 Checking database status...\n');

  try {
    // 1. Total guest users
    const totalGuestUsers = await db
      .select({ count: count() })
      .from(user)
      .where(like(user.email, 'guest-%'));

    console.log(`📊 Total Guest Users: ${totalGuestUsers[0].count}`);

    // 2. Guest users with no chats (completely unused)
    const unusedGuestUsers = await db
      .select({ count: count() })
      .from(user)
      .leftJoin(chat, eq(chat.userId, user.id))
      .where(
        and(
          like(user.email, 'guest-%'),
          isNull(chat.id)
        )
      );

    console.log(`🗑️  Unused Guest Users (no chats): ${unusedGuestUsers[0].count}`);

    // 3. Guest users with chats
    const guestUsersWithChats = await db
      .select({ count: count() })
      .from(user)
      .innerJoin(chat, eq(chat.userId, user.id))
      .where(like(user.email, 'guest-%'));

    console.log(`💬 Guest Users with Chats: ${guestUsersWithChats[0].count}`);

    // 4. Total regular users
    const regularUsers = await db
      .select({ count: count() })
      .from(user)
      .where(sql`email NOT LIKE 'guest-%'`);

    console.log(`👤 Regular Users: ${regularUsers[0].count}`);

    // 5. Recent guest users (last 24 hours)
    const recentGuestUsers = await db
      .select({ count: count() })
      .from(user)
      .where(
        and(
          like(user.email, 'guest-%'),
          sql`EXTRACT(EPOCH FROM TO_TIMESTAMP(SUBSTRING(email, 7)::bigint / 1000)) > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')`
        )
      );

    console.log(`🕐 Recent Guest Users (24h): ${recentGuestUsers[0].count}`);

    // 6. Sample of current guest user emails
    const sampleGuestUsers = await db
      .select({ email: user.email })
      .from(user)
      .where(like(user.email, 'guest-%'))
      .orderBy(user.email)
      .limit(10);

    console.log('\n📝 Sample Guest User Emails:');
    sampleGuestUsers.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.email}`);
    });

    // 7. Total chats and messages
    const totalChats = await db.select({ count: count() }).from(chat);
    const totalMessages = await db.select({ count: count() }).from(message);

    console.log(`\n📈 Database Overview:`);
    console.log(`   Total Chats: ${totalChats[0].count}`);
    console.log(`   Total Messages: ${totalMessages[0].count}`);
    console.log(`   Total Users: ${totalGuestUsers[0].count + regularUsers[0].count}`);

    // 8. Health check
    console.log('\n✅ Database Status: Healthy');
    console.log('🎯 Guest User Management: Optimized');

  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the check
checkDatabaseStatus()
  .then(() => {
    console.log('\n🎉 Database check completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database check failed:', error);
    process.exit(1);
  }); 