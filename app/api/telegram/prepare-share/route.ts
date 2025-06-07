import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, chatUrl } = await request.json();
    
    if (!chatId || !chatUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user from database to get Telegram ID
    const [dbUser] = await getUser(session.user.email);
    if (!dbUser || !dbUser.telegramId) {
      console.error('[prepare-share] User not found or no Telegram ID:', session.user.email);
      return NextResponse.json({ error: 'Telegram account not linked' }, { status: 400 });
    }

    // Get Telegram Bot Token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    console.log('[prepare-share] Preparing message for chat:', chatId);
    console.log('[prepare-share] Chat URL:', chatUrl);
    console.log('[prepare-share] User email:', session.user.email);
    console.log('[prepare-share] Telegram User ID:', dbUser.telegramId);

    // Get the bot username from environment or use a default
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username';
    
    // Create Mini App deep link
    // Format: https://t.me/botusername/appname?startapp=parameter
    const miniAppUrl = `https://t.me/${botUsername}/app?startapp=chat_${chatId}`;
    
    console.log('[prepare-share] Mini App URL:', miniAppUrl);

    // Prepare the inline query result
    const inlineQueryResult = {
      type: 'article',
      id: chatId,
      title: 'Share Chat',
      description: 'Share this conversation',
      input_message_content: {
        message_text: `Check out this interesting conversation!`,
        parse_mode: 'HTML',
      },
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📱 Open in App',
            url: miniAppUrl
          }
        ]]
      }
    };

    // Call Telegram Bot API to save prepared inline message
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/savePreparedInlineMessage`;
    
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: dbUser.telegramId, // Use the actual Telegram user ID
        result: inlineQueryResult,
        allow_user_chats: true,
        allow_bot_chats: true,
        allow_group_chats: true,
        allow_channel_chats: true,
      }),
    });

    const telegramData = await telegramResponse.json();
    
    console.log('[prepare-share] Telegram API response:', telegramData);

    if (!telegramResponse.ok || !telegramData.ok) {
      console.error('[prepare-share] Telegram API error:', telegramData);
      return NextResponse.json({ 
        error: 'Failed to prepare message', 
        details: telegramData.description || 'Unknown error' 
      }, { status: 500 });
    }

    const preparedMessage = telegramData.result;
    console.log('[prepare-share] Prepared message:', preparedMessage);

    return NextResponse.json({
      success: true,
      preparedMessageId: preparedMessage.id,
      expirationDate: preparedMessage.expiration_date,
    });

  } catch (error) {
    console.error('[prepare-share] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 