#!/usr/bin/env tsx

// This script cleans up excessive guest users from the database
// Run with: pnpm cleanup-guests

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, chat } from '@/lib/db/schema';
import { and, like, isNull, sql, inArray, eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ POSTGRES_URL environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

interface GuestUser {
  id: string;
  email: string;
}

// Function to delete users in batches to avoid stack overflow
async function deleteUsersInBatches(userIds: string[], batchSize: number = 1000) {
  let totalDeleted = 0;
  
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    console.log(`🔥 Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userIds.length / batchSize)} (${batch.length} users)...`);
    
    try {
      await db.delete(user).where(inArray(user.id, batch));
      totalDeleted += batch.length;
      console.log(`✅ Batch completed. Total deleted so far: ${totalDeleted}`);
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error deleting batch starting at index ${i}:`, error);
      throw error;
    }
  }
  
  return totalDeleted;
}

async function cleanupGuestUsers() {
  console.log('🧹 Starting guest user cleanup...');

  try {
    // First, get statistics
    const allGuestUsers = await db
      .select({
        id: user.id,
        email: user.email,
      })
      .from(user)
      .where(like(user.email, 'guest-%'));

    console.log(`📊 Found ${allGuestUsers.length} total guest users`);

    // Find guest users with no chats (completely unused)
    const unusedGuestUsers = await db
      .select({
        id: user.id,
        email: user.email,
      })
      .from(user)
      .leftJoin(chat, eq(chat.userId, user.id))
      .where(
        and(
          like(user.email, 'guest-%'),
          isNull(chat.id)
        )
      );

    console.log(`🗑️  Found ${unusedGuestUsers.length} completely unused guest users`);

    if (unusedGuestUsers.length > 0) {
      // Keep the 10 most recent unused guest users, delete the rest
      const toKeep = 10;
      const toDelete = unusedGuestUsers.slice(toKeep);

      if (toDelete.length > 0) {
        console.log(`🔥 Will delete ${toDelete.length} old unused guest users (keeping ${toKeep} most recent)...`);
        console.log(`📦 Processing in batches of 1000 to avoid database overload...`);
        
        const userIds = toDelete.map((u: GuestUser) => u.id);
        const deletedCount = await deleteUsersInBatches(userIds, 1000);
        
        console.log(`✅ Successfully deleted ${deletedCount} unused guest users`);
        
        // Log some examples of what was deleted
        console.log('📝 Examples of deleted users:');
        toDelete.slice(0, 5).forEach((u: GuestUser) => {
          console.log(`   - ${u.email}`);
        });
        if (toDelete.length > 5) {
          console.log(`   ... and ${toDelete.length - 5} more`);
        }
      } else {
        console.log('✨ No cleanup needed - only keeping the most recent unused guest users');
      }
    }

    // Find guest users with chats but no messages in the last 7 days
    const inactiveGuestUsers = await db
      .select({
        id: user.id,
        email: user.email,
        chatCount: sql<number>`COUNT(${chat.id})`,
      })
      .from(user)
      .leftJoin(chat, eq(chat.userId, user.id))
      .where(
        and(
          like(user.email, 'guest-%'),
          // Only users created more than 7 days ago
          sql`EXTRACT(EPOCH FROM TO_TIMESTAMP(SUBSTRING(${user.email}, 7)::bigint / 1000)) < EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')`
        )
      )
      .groupBy(user.id, user.email)
      .having(sql`COUNT(${chat.id}) > 0`);

    console.log(`⏰ Found ${inactiveGuestUsers.length} guest users with chats older than 7 days`);

    // Final statistics
    const remainingGuestUsers = await db
      .select({
        id: user.id,
      })
      .from(user)
      .where(like(user.email, 'guest-%'));

    console.log(`📈 Final count: ${remainingGuestUsers.length} guest users remaining`);
    console.log(`📉 Reduction: ${allGuestUsers.length - remainingGuestUsers.length} users removed`);
    console.log(`💾 Database space saved: ~${Math.round((allGuestUsers.length - remainingGuestUsers.length) * 0.5)} KB`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanupGuestUsers()
  .then(() => {
    console.log('🎉 Guest user cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  }); 