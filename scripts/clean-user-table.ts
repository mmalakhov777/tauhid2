import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, chat, document, message, messageDeprecated, vote, voteDeprecated, suggestion, subscriptionResponse, stream, vectorSearchResult } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import readline from 'readline';

config({
  path: '.env.local',
});

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function cleanUserTable() {
  console.log('🚨 USER TABLE CLEANUP SCRIPT 🚨\n');
  console.log('⚠️  WARNING: This will DELETE ALL user records and related data!');
  console.log('📊 This includes:');
  console.log('   - All users');
  console.log('   - All chats');
  console.log('   - All messages (v1 & v2)');
  console.log('   - All documents');
  console.log('   - All votes (v1 & v2)');
  console.log('   - All suggestions');
  console.log('   - All subscription responses');
  console.log('   - All streams');
  console.log('   - All vector search results');
  console.log('');

  try {
    // First, let's see what we're about to delete
    const userCount = await db.select().from(user);
    const chatCount = await db.select().from(chat);
    const messageCount = await db.select().from(message);
    const messageDeprecatedCount = await db.select().from(messageDeprecated);
    const documentCount = await db.select().from(document);
    const voteCount = await db.select().from(vote);
    const voteDeprecatedCount = await db.select().from(voteDeprecated);
    const suggestionCount = await db.select().from(suggestion);
    const subscriptionCount = await db.select().from(subscriptionResponse);
    const streamCount = await db.select().from(stream);
    const vectorSearchCount = await db.select().from(vectorSearchResult);

    console.log('📈 Current database contents:');
    console.log(`   Users: ${userCount.length}`);
    console.log(`   Chats: ${chatCount.length}`);
    console.log(`   Messages v2: ${messageCount.length}`);
    console.log(`   Messages v1 (deprecated): ${messageDeprecatedCount.length}`);
    console.log(`   Documents: ${documentCount.length}`);
    console.log(`   Votes v2: ${voteCount.length}`);
    console.log(`   Votes v1 (deprecated): ${voteDeprecatedCount.length}`);
    console.log(`   Suggestions: ${suggestionCount.length}`);
    console.log(`   Subscription Responses: ${subscriptionCount.length}`);
    console.log(`   Streams: ${streamCount.length}`);
    console.log(`   Vector Search Results: ${vectorSearchCount.length}`);
    console.log('');

    if (userCount.length === 0) {
      console.log('✅ User table is already empty!');
      rl.close();
      return;
    }

    // Double confirmation
    const firstConfirm = await askQuestion('❓ Are you ABSOLUTELY sure you want to delete ALL user data? Type "YES" to continue: ');
    
    if (firstConfirm !== 'YES') {
      console.log('❌ Operation cancelled.');
      rl.close();
      return;
    }

    const secondConfirm = await askQuestion('❓ This action is IRREVERSIBLE. Type "DELETE ALL USERS" to proceed: ');
    
    if (secondConfirm !== 'DELETE ALL USERS') {
      console.log('❌ Operation cancelled.');
      rl.close();
      return;
    }

    console.log('\n🗑️  Starting cleanup process...\n');

    // Delete in the correct order to respect foreign key constraints
    console.log('1️⃣ Deleting vector search results...');
    const deletedVectorSearch = await db.delete(vectorSearchResult);
    console.log(`   ✅ Deleted ${vectorSearchCount.length} vector search results`);

    console.log('2️⃣ Deleting votes v2...');
    const deletedVotes = await db.delete(vote);
    console.log(`   ✅ Deleted ${voteCount.length} votes v2`);

    console.log('3️⃣ Deleting votes v1 (deprecated)...');
    const deletedVotesDeprecated = await db.delete(voteDeprecated);
    console.log(`   ✅ Deleted ${voteDeprecatedCount.length} votes v1`);

    console.log('4️⃣ Deleting suggestions...');
    const deletedSuggestions = await db.delete(suggestion);
    console.log(`   ✅ Deleted ${suggestionCount.length} suggestions`);

    console.log('5️⃣ Deleting messages v2...');
    const deletedMessages = await db.delete(message);
    console.log(`   ✅ Deleted ${messageCount.length} messages v2`);

    console.log('6️⃣ Deleting messages v1 (deprecated)...');
    const deletedMessagesDeprecated = await db.delete(messageDeprecated);
    console.log(`   ✅ Deleted ${messageDeprecatedCount.length} messages v1`);

    console.log('7️⃣ Deleting streams...');
    const deletedStreams = await db.delete(stream);
    console.log(`   ✅ Deleted ${streamCount.length} streams`);

    console.log('8️⃣ Deleting documents...');
    const deletedDocuments = await db.delete(document);
    console.log(`   ✅ Deleted ${documentCount.length} documents`);

    console.log('9️⃣ Deleting chats...');
    const deletedChats = await db.delete(chat);
    console.log(`   ✅ Deleted ${chatCount.length} chats`);

    console.log('🔟 Deleting subscription responses...');
    const deletedSubscriptions = await db.delete(subscriptionResponse);
    console.log(`   ✅ Deleted ${subscriptionCount.length} subscription responses`);

    console.log('1️⃣1️⃣ Deleting users...');
    const deletedUsers = await db.delete(user);
    console.log(`   ✅ Deleted ${userCount.length} users`);

    console.log('\n🎉 Cleanup completed successfully!');
    console.log('📊 Summary:');
    console.log(`   Users deleted: ${userCount.length}`);
    console.log(`   Chats deleted: ${chatCount.length}`);
    console.log(`   Messages v2 deleted: ${messageCount.length}`);
    console.log(`   Messages v1 deleted: ${messageDeprecatedCount.length}`);
    console.log(`   Documents deleted: ${documentCount.length}`);
    console.log(`   Votes v2 deleted: ${voteCount.length}`);
    console.log(`   Votes v1 deleted: ${voteDeprecatedCount.length}`);
    console.log(`   Suggestions deleted: ${suggestionCount.length}`);
    console.log(`   Subscription responses deleted: ${subscriptionCount.length}`);
    console.log(`   Streams deleted: ${streamCount.length}`);
    console.log(`   Vector search results deleted: ${vectorSearchCount.length}`);

    // Verify cleanup
    const remainingUsers = await db.select().from(user);
    if (remainingUsers.length === 0) {
      console.log('\n✅ Verification: User table is now empty!');
    } else {
      console.log(`\n⚠️  Warning: ${remainingUsers.length} users still remain in the database!`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key')) {
        console.log('\n💡 Foreign key constraint error detected.');
        console.log('Some related data might still exist. You may need to run this script again.');
      }
    }
  } finally {
    rl.close();
    await client.end();
  }
}

// Run the cleanup
cleanUserTable()
  .then(() => {
    console.log('\n🏁 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 