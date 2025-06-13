const TELEGRAM_BOT_TOKEN = '7649122639:AAG50HM5qrVYh2hZ4NJj1S6PiLnBcsHEUeA';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// You'll need to replace this with your actual Vercel URL when deployed
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-app.vercel.app/api/telegram/webhook';

async function setWebhook() {
  try {
    console.log('Setting up Telegram webhook...');
    console.log('Webhook URL:', WEBHOOK_URL);
    
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message'],
      }),
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook set successfully!');
      console.log('Result:', result);
    } else {
      console.error('❌ Failed to set webhook:', result);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error);
  }
}

async function getWebhookInfo() {
  try {
    console.log('\nGetting webhook info...');
    
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const result = await response.json();
    
    console.log('Webhook info:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error getting webhook info:', error);
  }
}

async function deleteWebhook() {
  try {
    console.log('Deleting webhook...');
    
    const response = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`, {
      method: 'POST',
    });
    
    const result = await response.json();
    console.log('Delete result:', result);
  } catch (error) {
    console.error('Error deleting webhook:', error);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'set':
      await setWebhook();
      break;
    case 'info':
      await getWebhookInfo();
      break;
    case 'delete':
      await deleteWebhook();
      break;
    default:
      console.log('Usage:');
      console.log('  node setup-telegram-webhook.js set    - Set webhook');
      console.log('  node setup-telegram-webhook.js info   - Get webhook info');
      console.log('  node setup-telegram-webhook.js delete - Delete webhook');
      console.log('');
      console.log('Environment variables:');
      console.log('  WEBHOOK_URL - Your webhook URL (required for set command)');
  }
}

main().catch(console.error); 