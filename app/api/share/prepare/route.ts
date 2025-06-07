import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, messageText, chatTitle } = await request.json();

    if (!chatId || !messageText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    // Prepare the inline message result
    const inlineQueryResult = {
      type: 'article',
      id: `chat_${chatId}_${Date.now()}`,
      title: chatTitle || 'Shared Chat',
      description: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
      input_message_content: {
        message_text: `${messageText}\n\n🔗 Continue this conversation: ${process.env.NEXT_PUBLIC_APP_URL}/chat/${chatId}`,
        parse_mode: 'HTML'
      },
      thumb_url: `${process.env.NEXT_PUBLIC_APP_URL}/icon-192x192.png`,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/chat/${chatId}`
    };

    // Call Telegram Bot API to save prepared inline message
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/savePreparedInlineMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: session.user.id, // This should be the Telegram user ID
        result: inlineQueryResult,
        allow_user_chats: true,
        allow_bot_chats: true,
        allow_group_chats: true,
        allow_channel_chats: true,
      }),
    });

    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json();
      console.error('Telegram API error:', errorData);
      return NextResponse.json({ error: 'Failed to prepare message for sharing' }, { status: 500 });
    }

    const preparedMessage = await telegramResponse.json();
    
    return NextResponse.json({
      messageId: preparedMessage.result.id,
      expirationDate: preparedMessage.result.expiration_date,
    });

  } catch (error) {
    console.error('Error preparing share message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 