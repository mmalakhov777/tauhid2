import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = '7649122639:AAG50HM5qrVYh2hZ4NJj1S6PiLnBcsHEUeA';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Test mode - set to false to enable real Telegram messaging
const TEST_MODE = false;

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    first_name?: string;
    username?: string;
    type: string;
  };
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendMessage(chatId: number, text: string) {
  try {
    if (TEST_MODE) {
      console.log(`[TEST MODE] Would send message to chat ${chatId}:`, text);
      return { ok: true, result: { message_id: Date.now() } };
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send message:', errorText);
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    console.log('Received Telegram update:', JSON.stringify(body, null, 2));

    // Check if we have a message
    if (!body.message || !body.message.text) {
      console.log('No message or text found, ignoring update');
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    const chatId = message.chat.id;
    const userText = message.text;
    const userName = message.from.first_name || message.from.username || 'User';

    console.log(`Processing message from ${userName} (${chatId}): "${userText}"`);

    // Simple echo response
    const echoText = `Hello ${userName}! 👋\n\nYou said: "${userText}"\n\nThis is a simple echo bot. Soon I'll be able to answer your Islamic questions! 🕌`;

    // Send the echo message back
    const result = await sendMessage(chatId, echoText);
    console.log('Message sent successfully:', result);

    return NextResponse.json({ ok: true, message_sent: true });
  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json({ 
    status: 'Telegram bot webhook is running',
    test_mode: TEST_MODE,
    timestamp: new Date().toISOString()
  });
} 