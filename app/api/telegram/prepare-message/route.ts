import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messageContent } = await request.json();

    if (!messageContent) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }

    // Truncate message content for sharing (Telegram has limits)
    const truncatedContent = messageContent.length > 4000 
      ? messageContent.substring(0, 3997) + '...' 
      : messageContent;

    // Prepare the inline message using Telegram Bot API 8.0
    const prepareResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/savePreparedInlineMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          result: {
            type: 'article',
            id: `shared_${Date.now()}`,
            title: 'AI Chat Response',
            description: truncatedContent.substring(0, 100) + (truncatedContent.length > 100 ? '...' : ''),
            input_message_content: {
              message_text: truncatedContent,
              parse_mode: 'Markdown'
            }
          },
          allow_user_chats: true,
          allow_bot_chats: false,
          allow_group_chats: true,
          allow_channel_chats: true
        }),
      }
    );

    if (!prepareResponse.ok) {
      const errorData = await prepareResponse.json();
      console.error('Telegram API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to prepare message for sharing' },
        { status: 500 }
      );
    }

    const data = await prepareResponse.json();
    
    if (!data.ok) {
      console.error('Telegram API returned error:', data);
      return NextResponse.json(
        { error: data.description || 'Failed to prepare message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preparedMessageId: data.result.prepared_query_id
    });

  } catch (error) {
    console.error('Error preparing message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 