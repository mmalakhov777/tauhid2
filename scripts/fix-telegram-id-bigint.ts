import postgres from 'postgres';

const client = postgres(process.env.POSTGRES_URL!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function fixTelegramIdBigint() {
  try {
    console.log('🔧 Starting Telegram ID BIGINT migration...');
    
    // Check current column types
    const userColumnInfo = await client`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'telegramId'
    `;
    
    const bindingColumnInfo = await client`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'TelegramBindingCode' AND column_name = 'telegramId'
    `;
    
    console.log('📊 Current column types:');
    console.log('  User.telegramId:', userColumnInfo[0]?.data_type || 'not found');
    console.log('  TelegramBindingCode.telegramId:', bindingColumnInfo[0]?.data_type || 'not found');
    
    // Fix User table
    if (userColumnInfo[0]?.data_type === 'integer') {
      console.log('🔄 Changing User.telegramId from INTEGER to BIGINT...');
      await client`ALTER TABLE "User" ALTER COLUMN "telegramId" TYPE BIGINT`;
      console.log('✅ User.telegramId changed to BIGINT');
    } else {
      console.log('ℹ️  User.telegramId is already BIGINT or doesn\'t exist');
    }
    
    // Fix TelegramBindingCode table
    if (bindingColumnInfo[0]?.data_type === 'integer') {
      console.log('🔄 Changing TelegramBindingCode.telegramId from INTEGER to BIGINT...');
      await client`ALTER TABLE "TelegramBindingCode" ALTER COLUMN "telegramId" TYPE BIGINT`;
      console.log('✅ TelegramBindingCode.telegramId changed to BIGINT');
    } else {
      console.log('ℹ️  TelegramBindingCode.telegramId is already BIGINT or doesn\'t exist');
    }
    
    // Verify changes
    const newUserColumnInfo = await client`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'telegramId'
    `;
    
    const newBindingColumnInfo = await client`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'TelegramBindingCode' AND column_name = 'telegramId'
    `;
    
    console.log('📊 New column types:');
    console.log('  User.telegramId:', newUserColumnInfo[0]?.data_type || 'not found');
    console.log('  TelegramBindingCode.telegramId:', newBindingColumnInfo[0]?.data_type || 'not found');
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
fixTelegramIdBigint().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 