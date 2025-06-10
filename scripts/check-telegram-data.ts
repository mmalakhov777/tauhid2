import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from '../lib/db/schema';
import { isNotNull, like } from 'drizzle-orm';

config({
  path: '.env.local',
});

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function checkTelegramData() {
  console.log('🔍 Checking Telegram data in database...\n');

  try {
    // Get all users with Telegram data
    const telegramUsers = await db
      .select()
      .from(user)
      .where(isNotNull(user.telegramId));

    console.log(`📊 Found ${telegramUsers.length} users with Telegram data:\n`);

    if (telegramUsers.length === 0) {
      console.log('❌ No users with Telegram data found!');
      console.log('This could mean:');
      console.log('1. No Telegram users have signed up yet');
      console.log('2. Telegram data is not being saved properly');
      console.log('3. Database migration might not have run');
      
      // Check if any users exist at all
      const allUsers = await db.select().from(user);
      console.log(`\n📈 Total users in database: ${allUsers.length}`);
      
      if (allUsers.length > 0) {
        console.log('\n👥 Sample of existing users:');
        allUsers.slice(0, 3).forEach((u, i) => {
          console.log(`${i + 1}. Email: ${u.email}`);
          console.log(`   ID: ${u.id}`);
          console.log(`   Telegram ID: ${u.telegramId || 'NULL'}`);
          console.log(`   Telegram First Name: ${u.telegramFirstName || 'NULL'}`);
          console.log('');
        });
      }
      
      return;
    }

    // Display detailed info for each Telegram user
    telegramUsers.forEach((u, index) => {
      console.log(`👤 User ${index + 1}:`);
      console.log(`   Email: ${u.email}`);
      console.log(`   User ID: ${u.id}`);
      console.log(`   Telegram ID: ${u.telegramId}`);
      console.log(`   Telegram Username: ${u.telegramUsername || 'NULL'}`);
      console.log(`   Telegram First Name: ${u.telegramFirstName || 'NULL'}`);
      console.log(`   Telegram Last Name: ${u.telegramLastName || 'NULL'}`);
      console.log(`   Telegram Photo URL: ${u.telegramPhotoUrl || 'NULL'}`);
      console.log(`   Telegram Language: ${u.telegramLanguageCode || 'NULL'}`);
      console.log(`   Telegram Premium: ${u.telegramIsPremium}`);
      console.log(`   Telegram Allows PM: ${u.telegramAllowsWriteToPm}`);
      console.log('');
    });

    // Check for users with dummy Telegram emails
    const dummyEmailUsers = await db
      .select()
      .from(user)
      .where(like(user.email, 'telegram_%@telegram.local'));

    console.log(`📧 Users with dummy Telegram emails: ${dummyEmailUsers.length}`);
    
    if (dummyEmailUsers.length > 0) {
      console.log('\n🔍 Dummy email users:');
      dummyEmailUsers.forEach((u, i) => {
        console.log(`${i + 1}. ${u.email} (Telegram ID: ${u.telegramId})`);
      });
    }

    // Summary statistics
    console.log('\n📈 Summary:');
    console.log(`Total users: ${(await db.select().from(user)).length}`);
    console.log(`Users with Telegram ID: ${telegramUsers.length}`);
    console.log(`Users with dummy emails: ${dummyEmailUsers.length}`);
    console.log(`Users with Telegram username: ${telegramUsers.filter(u => u.telegramUsername).length}`);
    console.log(`Users with Telegram photo: ${telegramUsers.filter(u => u.telegramPhotoUrl).length}`);
    console.log(`Telegram Premium users: ${telegramUsers.filter(u => u.telegramIsPremium).length}`);

  } catch (error) {
    console.error('❌ Error checking Telegram data:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('relation') || error.message.includes('column')) {
        console.log('\n💡 This might be a database schema issue.');
        console.log('Try running: npm run db:migrate');
      }
    }
  }
}

// Run the check
checkTelegramData()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 