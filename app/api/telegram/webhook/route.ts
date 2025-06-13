import { NextRequest, NextResponse } from 'next/server';
import { generateUUID } from '@/lib/utils';
import { createHash } from 'crypto';

const TELEGRAM_BOT_TOKEN = '7649122639:AAG50HM5qrVYh2hZ4NJj1S6PiLnBcsHEUeA';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Test mode - set to false to enable real Telegram messaging
const TEST_MODE = false;

// External Chat API configuration
const EXTERNAL_CHAT_API_KEY = 'your-super-secret-api-key-change-this-12345';
const EXTERNAL_CHAT_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000/api/external-chat'
  : 'https://thd2-eda9reprd-mmalakhov777s-projects.vercel.app/api/external-chat';

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

// Generate deterministic UUID from string (for consistent chat/user IDs)
function generateDeterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  // Format as UUID v4
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant bits
    hash.substring(20, 32)
  ].join('-');
}

async function sendMessage(chatId: number, text: string, parseMode: string = 'HTML') {
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
        parse_mode: parseMode,
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

async function sendTypingAction(chatId: number) {
  try {
    if (TEST_MODE) {
      console.log(`[TEST MODE] Would send typing action to chat ${chatId}`);
      return { ok: true };
    }

    await fetch(`${TELEGRAM_API_URL}/sendChatAction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  } catch (error) {
    console.error('Error sending typing action:', error);
  }
}

async function callExternalChatAPI(userMessage: string, userId: string, chatId: string) {
  try {
    console.log('[Telegram Bot] Calling external chat API:', {
      userMessageLength: userMessage.length,
      userId,
      chatId,
      apiUrl: EXTERNAL_CHAT_API_URL
    });

    // Generate consistent UUIDs based on Telegram IDs
    const chatUUID = generateDeterministicUUID(`telegram-chat-${chatId}`);
    const userUUID = generateDeterministicUUID(`telegram-user-${userId}`);

    const requestBody = {
      id: chatUUID, // Consistent UUID for this Telegram chat
      userId: userUUID, // Consistent UUID for this Telegram user
      message: {
        id: generateUUID(),
        role: 'user' as const,
        content: userMessage,
        createdAt: new Date().toISOString(),
        parts: [
          {
            type: 'text' as const,
            text: userMessage
          }
        ]
      },
      selectedChatModel: 'chat-model' as const,
      selectedVisibilityType: 'private' as const,
      selectedLanguage: 'en',
      selectedSources: {
        classic: true,
        modern: true,
        risale: true,
        youtube: true,
        fatwa: true
      }
    };

    console.log('[Telegram Bot] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(EXTERNAL_CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXTERNAL_CHAT_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Telegram Bot] External chat API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`External chat API error: ${response.status} - ${errorText}`);
    }

    console.log('[Telegram Bot] External chat API response received, processing stream...');

    // Process the streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let fullResponse = '';
    let vectorSearchProgress = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('0:')) {
            // Parse the streaming data
            try {
              const jsonStr = line.substring(2);
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'vector-search-progress') {
                const progress = JSON.parse(data.progress);
                console.log('[Telegram Bot] Vector search progress:', progress);
                
                if (progress.step === 1) {
                  vectorSearchProgress = '🔍 Searching Islamic sources...';
                } else if (progress.step === 2) {
                  vectorSearchProgress = '📚 Analyzing relevant texts...';
                } else if (progress.step === 3) {
                  vectorSearchProgress = '🤖 Generating response...';
                }
              } else if (data.type === 'text-delta') {
                fullResponse += data.textDelta;
              }
            } catch (parseError) {
              // Ignore parsing errors for non-JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('[Telegram Bot] Full response received:', {
      responseLength: fullResponse.length,
      responsePreview: fullResponse.substring(0, 200) + '...'
    });

    return {
      success: true,
      response: fullResponse || 'I apologize, but I encountered an issue generating a response. Please try again.',
      vectorSearchProgress
    };

  } catch (error) {
    console.error('[Telegram Bot] Error calling external chat API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      response: 'I apologize, but I encountered a technical issue. Please try again later.'
    };
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
    const userText = message.text!.trim(); // We know text exists due to the check above
    const userName = message.from.first_name || message.from.username || 'User';
    const userId = `telegram-${message.from.id}`;

    console.log(`Processing message from ${userName} (${chatId}): "${userText}"`);

    // Handle special commands
    if (userText === '/start') {
      const welcomeText = `🕌 *Assalamu Alaikum, ${userName}!*

Welcome to the Islamic Q&A Bot! I'm here to help answer your questions about Islam using authentic sources.

*What I can help with:*
📚 Quranic verses and interpretations
🕌 Islamic teachings and practices  
📖 Hadith and scholarly opinions
🤲 Prayer, worship, and daily Islamic life
📜 Risale-i Nur teachings

*How to use:*
Simply ask me any Islamic question in plain language. I'll search through authentic Islamic sources and provide you with a comprehensive answer.

*Example questions:*
• "What does Islam say about prayer?"
• "Can you explain the concept of Tawhid?"
• "What are the pillars of Islam?"

Feel free to ask me anything! 🤲`;

      await sendMessage(chatId, welcomeText, 'Markdown');
      return NextResponse.json({ ok: true, message_sent: true });
    }

    if (userText === '/help') {
      const helpText = `🤖 *How to use this bot:*

*Ask any Islamic question* and I'll provide answers based on:
📖 Quran and authentic Hadith
🕌 Classical Islamic scholarship
📚 Modern Islamic teachings
📜 Risale-i Nur collection
🎥 Educational Islamic content

*Tips for better answers:*
• Be specific in your questions
• Ask one question at a time
• Use clear, simple language

*Commands:*
/start - Welcome message
/help - This help message

May Allah guide us all! 🤲`;

      await sendMessage(chatId, helpText, 'Markdown');
      return NextResponse.json({ ok: true, message_sent: true });
    }

    // Show typing indicator
    await sendTypingAction(chatId);

    // Send initial processing message
    const processingMessage = await sendMessage(
      chatId, 
      '🔍 *Searching Islamic sources for your question...*\n\nPlease wait while I find the most relevant information for you.',
      'Markdown'
    );

    // Call external chat API
    const apiResult = await callExternalChatAPI(userText, userId, chatId.toString());

    if (!apiResult.success) {
      console.error('External chat API failed:', apiResult.error);
      
      // Edit the processing message with error
      await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: processingMessage.result.message_id,
          text: '❌ I apologize, but I encountered a technical issue while processing your question. Please try again in a moment.',
          parse_mode: 'Markdown'
        }),
      });

      return NextResponse.json({ ok: true, error: apiResult.error });
    }

    // Clean up the response text
    let responseText = apiResult.response;
    
    // Remove any HTML tags and clean up formatting
    responseText = responseText
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\[CIT\d+\]/g, '') // Remove citation markers
      .trim();

    // Ensure response isn't too long for Telegram (max 4096 characters)
    if (responseText.length > 4000) {
      responseText = responseText.substring(0, 3900) + '\n\n...\n\n*Response truncated due to length. Please ask for more specific details if needed.*';
    }

    // Add Islamic greeting and formatting
    const formattedResponse = `🕌 *Islamic Q&A Response*

${responseText}

---
*May Allah guide us to the truth. If you have more questions, feel free to ask!* 🤲`;

    // Edit the processing message with the final response
    await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: processingMessage.result.message_id,
        text: formattedResponse,
        parse_mode: 'Markdown'
      }),
    });

    console.log('AI response sent successfully to Telegram');

    return NextResponse.json({ ok: true, message_sent: true, ai_response: true });
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