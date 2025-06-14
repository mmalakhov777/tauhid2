import { getUserByTelegramId, testDatabaseConnection } from './lib/db/queries.js';

async function testTelegramDB() {
  console.log('Testing database connection...');
  
  try {
    await testDatabaseConnection();
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return;
  }

  console.log('\nTesting Telegram user lookup...');
  
  try {
    const users = await getUserByTelegramId(321097981);
    console.log('✅ Telegram user lookup successful');
    console.log('Found users:', users.length);
    if (users.length > 0) {
      console.log('User details:', {
        id: users[0].id,
        email: users[0].email,
        telegramId: users[0].telegramId,
        telegramFirstName: users[0].telegramFirstName,
        telegramUsername: users[0].telegramUsername
      });
    }
  } catch (error: any) {
    console.error('❌ Telegram user lookup failed:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      surface: error.surface,
      statusCode: error.statusCode,
      cause: error.cause
    });
  }
}

testTelegramDB().catch(console.error); 