const TELEGRAM_BOT_TOKEN = '7649122639:AAG50HM5qrVYh2hZ4NJj1S6PiLnBcsHEUeA';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Test user ID (replace with your Telegram user ID)
const TEST_CHAT_ID = 321097981;

async function sendBuyCommand() {
  try {
    console.log('Sending /buy command to test payment flow...');
    
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TEST_CHAT_ID,
        text: '/buy',
      }),
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Buy command sent successfully!');
      console.log('Message ID:', result.result.message_id);
    } else {
      console.error('❌ Failed to send buy command:', result);
    }
  } catch (error) {
    console.error('❌ Error sending buy command:', error);
  }
}

async function checkWebhookStatus() {
  try {
    console.log('\nChecking webhook status...');
    
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const result = await response.json();
    
    console.log('Webhook status:', {
      url: result.result.url,
      pending_updates: result.result.pending_update_count,
      allowed_updates: result.result.allowed_updates
    });
  } catch (error) {
    console.error('Error checking webhook status:', error);
  }
}

async function main() {
  await checkWebhookStatus();
  await sendBuyCommand();
  
  console.log('\n📱 Now go to Telegram and:');
  console.log('1. Look for the /buy command response with payment buttons');
  console.log('2. Click on a payment package');
  console.log('3. Try to complete the payment');
  console.log('4. Check the webhook logs for pre_checkout_query and successful_payment');
}

main().catch(console.error); 