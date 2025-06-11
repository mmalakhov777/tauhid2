import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUser, getChatById, getMessagesByChatId } from '@/lib/db/queries';

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

    // Get chat from database to verify access
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      console.error('[prepare-share] Chat not found:', chatId);
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Check if user has access to this chat (either owns it or it's public)
    if (chat.userId !== session.user.id && chat.visibility !== 'public') {
      console.error('[prepare-share] User does not have access to chat:', {
        chatId,
        chatUserId: chat.userId,
        sessionUserId: session.user.id,
        visibility: chat.visibility
      });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get messages from database
    const messages = await getMessagesByChatId({ id: chatId });
    
    // Generate preview from database messages
    const generatePreviewFromMessages = () => {
      const userMessage = messages.find(msg => msg.role === 'user');
      const assistantMessage = messages.find(msg => msg.role === 'assistant');
      
      if (!userMessage || !assistantMessage) {
        return 'Check out this interesting Islamic Q&A conversation!';
      }
      
      // Extract text content from message parts
      const getUserContent = (msg: any) => {
        if (!msg.parts || !Array.isArray(msg.parts)) return '';
        const textPart = msg.parts.find((part: any) => part.type === 'text');
        return textPart?.text || '';
      };
      
      // Get user question and clean language instructions
      const userContent = getUserContent(userMessage);
      // Remove language instruction pattern like [Answer in Russian], [Answer in Turkish], etc.
      const cleanedUserContent = userContent.replace(/\n\n\[Answer in [^\]]+\]$/i, '').trim();
      
      // Get assistant response and clean it from source citations
      const assistantContent = getUserContent(assistantMessage);
      
      // Remove source citations like [1], [2], etc.
      const cleanedAssistantContent = assistantContent
        .replace(/\[\d+\]/g, '') // Remove [1], [2], [3], etc.
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
      
      // Get first 30 words for preview
      const assistantWords = cleanedAssistantContent.split(/\s+/);
      const assistantPreview = assistantWords.slice(0, 30).join(' ') + (assistantWords.length > 30 ? '...' : '');
      
      // Create a more engaging preview that focuses on the answer
      // If the question is short (under 10 words), include it, otherwise just show the answer
      const userWords = cleanedUserContent.trim().split(/\s+/);
      
      if (userWords.length <= 10) {
        // Short question - show both Q&A
        return `"${cleanedUserContent}"\n\n${assistantPreview}`;
      } else {
        // Long question - just show the answer
        return assistantPreview;
      }
    };

    const previewText = generatePreviewFromMessages();

    // Get Telegram Bot Token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    console.log('[prepare-share] Preparing message for chat:', chatId);
    console.log('[prepare-share] Chat URL:', chatUrl);
    console.log('[prepare-share] Preview text:', previewText);
    console.log('[prepare-share] User email:', session.user.email);
    console.log('[prepare-share] Telegram User ID:', dbUser.telegramId);
    console.log('[prepare-share] Messages count:', messages.length);

    // Get the bot username from environment or use a default
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username';
    
    // Create Mini App deep link
    // For main Mini App: https://t.me/botusername?startapp=parameter
    const miniAppUrl = `https://t.me/${botUsername}?startapp=chat_${chatId}`;
    
    console.log('[prepare-share] Mini App URL:', miniAppUrl);

    // Create simple message text - just the preview without stats or link
    const messageText = previewText || 'Check out this interesting conversation!';

    // Prepare the inline query result
    const inlineQueryResult = {
      type: 'article',
      id: chatId,
      title: 'Islamic Q&A Conversation',
      description: 'Islamic Q&A conversation',
      input_message_content: {
        message_text: messageText,
        parse_mode: 'HTML',
      },
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🕌 Open Conversation',
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
      previewText, // Return the preview for debugging
    });

  } catch (error) {
    console.error('[prepare-share] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 