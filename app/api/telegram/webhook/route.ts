import { NextRequest, NextResponse } from 'next/server';
import { generateUUID } from '@/lib/utils';
import { createHash } from 'crypto';
import { getUserByTelegramId, useTelegramBindingCode } from '@/lib/db/queries';
import { telegramAuth } from '@/app/(auth)/actions';
import { getUserLanguage, getTranslations, formatText } from '@/lib/telegram-translations';

const TELEGRAM_BOT_TOKEN = '7649122639:AAG50HM5qrVYh2hZ4NJj1S6PiLnBcsHEUeA';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Test mode - set to false to enable real Telegram messaging
const TEST_MODE = false;

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// External Chat API configuration
const EXTERNAL_CHAT_API_KEY = 'your-super-secret-api-key-change-this-12345';

// Get the base URL for the current environment
function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // In production, always use the main domain to avoid authentication issues
  return 'https://tauhid2.onrender.com';
}

const BASE_URL = getBaseUrl();
const EXTERNAL_CHAT_API_URL = `${BASE_URL}/api/external-chat`;

// Log the configuration for debugging
console.log('[Telegram Bot] Configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_URL: process.env.VERCEL_URL ? `${process.env.VERCEL_URL.substring(0, 20)}...` : 'not set',
  BASE_URL,
  EXTERNAL_CHAT_API_URL,
  TEST_MODE
});

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    first_name?: string;
    username?: string;
    type: string;
  };
  date: number;
  text?: string;
  voice?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    performer?: string;
    title?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    language_code?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
  };
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
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

async function downloadAndTranscribeAudio(fileId: string): Promise<string | null> {
  try {
    if (!OPENAI_API_KEY) {
      console.error('[Telegram Bot] OpenAI API key not configured');
      return null;
    }

    console.log(`[Telegram Bot] Starting audio transcription for file: ${fileId}`);

    // Get file info from Telegram
    const fileInfoResponse = await fetch(`${TELEGRAM_API_URL}/getFile?file_id=${fileId}`);
    if (!fileInfoResponse.ok) {
      console.error('[Telegram Bot] Failed to get file info from Telegram');
      return null;
    }

    const fileInfo = await fileInfoResponse.json();
    if (!fileInfo.ok) {
      console.error('[Telegram Bot] Telegram API returned error for file info');
      return null;
    }

    const filePath = fileInfo.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

    console.log(`[Telegram Bot] Downloading audio file from: ${fileUrl}`);

    // Download the audio file
    const audioResponse = await fetch(fileUrl);
    if (!audioResponse.ok) {
      console.error('[Telegram Bot] Failed to download audio file');
      return null;
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer]);

    console.log(`[Telegram Bot] Audio file downloaded, size: ${audioBuffer.byteLength} bytes`);

    // Create FormData for OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    // Note: Omitting language parameter allows Whisper to auto-detect the language

    console.log('[Telegram Bot] Sending audio to OpenAI Whisper API...');

    // Send to OpenAI Whisper API
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('[Telegram Bot] OpenAI Whisper API error:', errorText);
      return null;
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcribedText = transcriptionResult.text;

    console.log(`[Telegram Bot] Audio transcription successful: "${transcribedText}"`);
    return transcribedText;

  } catch (error) {
    console.error('[Telegram Bot] Error in audio transcription:', error);
    return null;
  }
}

async function callExternalChatAPI(userMessage: string, userId: string, chatId: string, processingMessage?: any, telegramChatId?: number, dbUser?: any, countdownInterval?: NodeJS.Timeout, translations?: any) {
  try {
    // Generate UNIQUE chat UUID for each message (no follow-ups)
    const messageTimestamp = Date.now();
    const chatUUID = generateDeterministicUUID(`telegram-message-${chatId}-${messageTimestamp}-${Math.random()}`);
    
    // Use actual database user ID if available, otherwise create/get user
    let actualUserId = null;
    if (dbUser && dbUser.id) {
      actualUserId = dbUser.id;
      console.log('[Telegram Bot] Using existing database user ID:', actualUserId);
    } else {
      // Fallback: generate UUID for user (this shouldn't happen if user lookup worked)
      actualUserId = generateDeterministicUUID(`telegram-user-${userId}`);
      console.log('[Telegram Bot] Using generated user UUID (fallback):', actualUserId);
    }

    console.log('[Telegram Bot] Calling external chat API:', {
      userMessageLength: userMessage.length,
      userId,
      chatId,
      apiUrl: EXTERNAL_CHAT_API_URL,
      uniqueChatUUID: chatUUID,
      actualUserId: actualUserId,
      messageTimestamp: messageTimestamp
    });

    const requestBody: any = {
      id: chatUUID, // Unique UUID for each message (new chat every time - no follow-ups)
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
      selectedVisibilityType: 'public' as const,
      selectedLanguage: 'en',
      selectedSources: {
        classic: true,
        modern: true,
        risale: true,
        youtube: true,
        fatwa: true
      }
    };

    // Only add userId if we have a valid database user ID (UUID format)
    if (dbUser && dbUser.id) {
      requestBody.userId = dbUser.id;
      console.log('[Telegram Bot] Adding userId to request:', dbUser.id);
    } else {
      console.log('[Telegram Bot] No valid database user, using external API default user');
    }

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
    let buffer = '';
    let lastUpdateTime = 0;
    let updateCounter = 0;
    const UPDATE_INTERVAL = 1500; // Update every 1.5 seconds
    const MIN_CHARS_FOR_UPDATE = 100; // Or when we have at least 100 new characters

    // Function to update the message incrementally
    const updateMessage = async (text: string, isComplete: boolean = false, currentProgress: string = '') => {
      if (!processingMessage || !telegramChatId) return;
      
      try {
        // Format the text for display
        let displayText = text
          .replace(/\\n/g, '\n')
          .replace(/\*\*(.*?)\*\*/g, '*$1*')
          .replace(/\*(.*?)\*/g, '_$1_')
          .replace(/### (.*?)$/gm, '*$1*')
          .replace(/^\* /gm, '• ')
          .replace(/^\d+\. /gm, (match) => match)
          .replace(/^> /gm, '▶️ ')
          .replace(/\[CIT(\d+)\]/g, ' 📚')
          .replace(/\n\n\n+/g, '\n\n')
          .replace(/\n\s*\n/g, '\n\n');

        let messageText;
        
        if (isComplete) {
          // Final message - just the clean answer
          messageText = displayText;
        } else if (displayText.length > 0) {
          // Partial response - just show the text without progress
          messageText = displayText;
        } else {
          // Only progress, no response yet
          messageText = currentProgress || '🔍 *Searching Islamic sources...*';
        }

        // Ensure message isn't too long for Telegram
        const finalText = messageText.length > 4000 
          ? messageText.substring(0, 3900) + '\n\n...\n\n_Response truncated due to length._'
          : messageText;

        const requestBody: any = {
          chat_id: telegramChatId,
          message_id: processingMessage.result.message_id,
          text: finalText,
          parse_mode: 'Markdown'
        };

        // Add inline keyboard button only for the final complete message
        if (isComplete) {
          const buttonText = translations?.buttons?.fullResponse || "📚 Full Response & Citations";
          requestBody.reply_markup = {
            inline_keyboard: [[
              {
                text: buttonText,
                web_app: {
                  url: `${BASE_URL}/chat/${chatUUID}`
                }
              }
            ]]
          };
        }

        await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        console.log(`[Telegram Bot] Updated message (${displayText.length} chars, complete: ${isComplete})`);
      } catch (error) {
        console.log('[Telegram Bot] Error updating message:', error);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('0:')) {
            // Extract text content from streaming format: 0:"text content"
            try {
              const textContent = line.substring(2); // Remove "0:"
              const parsedText = JSON.parse(textContent); // Parse the quoted string
              fullResponse += parsedText;
              console.log(`[Telegram Bot] Added text: "${parsedText}", total length: ${fullResponse.length}`);

              // Update message incrementally
              const now = Date.now();
              const shouldUpdate = (now - lastUpdateTime > UPDATE_INTERVAL) || 
                                 (fullResponse.length - (updateCounter * MIN_CHARS_FOR_UPDATE) >= MIN_CHARS_FOR_UPDATE);
              
              if (shouldUpdate && fullResponse.length > 50) {
                await updateMessage(fullResponse, false, '');
                lastUpdateTime = now;
                updateCounter++;
              }
            } catch (parseError) {
              console.log('[Telegram Bot] Parse error for text line:', line.substring(0, 100));
            }
          } else if (line.startsWith('2:')) {
            // Handle progress updates: 2:[{"type":"vector-search-progress",...}]
            try {
              const jsonStr = line.substring(2);
              const dataArray = JSON.parse(jsonStr);
              if (Array.isArray(dataArray) && dataArray.length > 0) {
                const data = dataArray[0];
                if (data.type === 'vector-search-progress') {
                  const progress = JSON.parse(data.progress);
                  console.log('[Telegram Bot] Vector search progress step:', progress.step);
                  
                  if (progress.step === 1) {
                    // Clear countdown timer when actual progress starts
                    if (countdownInterval) {
                      clearInterval(countdownInterval);
                    }
                    // Don't show step notifications, just clear the timer
                    vectorSearchProgress = '';
                  }
                }
              }
            } catch (parseError) {
              console.log('[Telegram Bot] Parse error for progress line:', line.substring(0, 100));
            }
          } else if (line.startsWith('e:') || line.startsWith('d:')) {
            // Handle end/done markers
            console.log('[Telegram Bot] Stream end marker received');
          } else {
            console.log('[Telegram Bot] Skipping line:', line.substring(0, 50) + '...');
          }
        }
      }
      
      // Process any remaining buffer
      if (buffer.trim()) {
        console.log('[Telegram Bot] Processing final buffer:', buffer.substring(0, 100) + '...');
        
        if (buffer.startsWith('0:')) {
          try {
            const textContent = buffer.substring(2);
            const parsedText = JSON.parse(textContent);
            fullResponse += parsedText;
            console.log('[Telegram Bot] Added final buffer text:', parsedText.substring(0, 50) + '...');
          } catch (parseError) {
            console.log('[Telegram Bot] Final buffer parse error:', parseError instanceof Error ? parseError.message : 'Unknown error');
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Send final complete update
    if (fullResponse.length > 0) {
      await updateMessage(fullResponse, true, '');
    }

    console.log('[Telegram Bot] Full response received:', {
      responseLength: fullResponse.length,
      responsePreview: fullResponse.substring(0, 200) + '...'
    });

    return {
      success: true,
      response: fullResponse || 'I apologize, but I encountered an issue generating a response. Please try again.',
      vectorSearchProgress,
      streamingComplete: true // Flag to indicate streaming was handled
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

async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery) {
  try {
    const chatId = callbackQuery.message?.chat.id;
    const telegramUserId = callbackQuery.from.id;
    const callbackData = callbackQuery.data;

    if (!chatId || !callbackData) {
      console.log('[Telegram Bot] Invalid callback query data');
      return NextResponse.json({ ok: true });
    }

    console.log('[Telegram Bot] Processing callback query:', {
      telegramUserId,
      chatId,
      callbackData
    });

    // Answer the callback query to remove loading state
    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: 'Processing purchase...'
      }),
    });

    // Handle purchase callback
    if (callbackData.startsWith('buy_')) {
      const packageIndex = parseInt(callbackData.replace('buy_', ''));
      
      // Find user in database
      const users = await getUserByTelegramId(telegramUserId);
      if (users.length === 0) {
        await sendMessage(chatId, '❌ User not found. Please start a conversation first with /start', 'Markdown');
        return NextResponse.json({ ok: true, error: 'User not found' });
      }

      // Call purchase API
      try {
        const purchaseResponse = await fetch(`${getBaseUrl()}/api/telegram/purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramUserId,
            packageIndex
          }),
        });

        const purchaseResult = await purchaseResponse.json();

        if (purchaseResult.success && purchaseResult.invoiceLink) {
          const pkg = purchaseResult.package;
          
          // Send invoice message
          const invoiceMessage = `🌟 *Invoice Created Successfully!*

**Package:** ${pkg.totalMessages} Messages (${pkg.messages}${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''})
**Price:** ${pkg.stars} ⭐ Telegram Stars

💡 *How to pay:*
1. Tap the "Pay" button below
2. Complete payment with your Telegram Stars
3. Messages will be added to your account instantly

Your paid messages never expire and work alongside your daily trial messages!`;

          // Edit the original message to show invoice
          await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: callbackQuery.message?.message_id,
              text: invoiceMessage,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: `💳 Pay ${pkg.stars} ⭐`,
                    url: purchaseResult.invoiceLink
                  }
                ], [
                  {
                    text: '🔙 Back to Packages',
                    callback_data: 'back_to_packages'
                  }
                ]]
              }
            }),
          });

          console.log('[Telegram Bot] Invoice created and sent:', {
            telegramUserId,
            packageIndex,
            stars: pkg.stars,
            messages: pkg.totalMessages
          });

        } else {
          await sendMessage(chatId, `❌ Failed to create invoice: ${purchaseResult.error || 'Unknown error'}`, 'Markdown');
        }

      } catch (error) {
        console.error('[Telegram Bot] Purchase API error:', error);
        await sendMessage(chatId, '❌ Purchase system temporarily unavailable. Please try again later.', 'Markdown');
      }

      return NextResponse.json({ ok: true, callback_handled: true });
    }

    // Handle back to packages
    if (callbackData === 'back_to_packages') {
      const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
      
      let purchaseMessage = `🌟 *Purchase Messages with Telegram Stars*

Choose a package to buy more messages:

`;

      // Create inline keyboard with purchase options
      const inlineKeyboard: Array<Array<{text: string, callback_data: string}>> = [];
      
      PAYMENT_CONFIG.PACKAGES.forEach((pkg, index) => {
        const totalMessages = pkg.messages + pkg.bonus;
        const bonusText = pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : '';
        const popularText = pkg.popular ? ' 🔥' : '';
        
        purchaseMessage += `${index + 1}. **${totalMessages} Messages** (${pkg.messages}${bonusText}) - ${pkg.stars} ⭐${popularText}\n`;
        
        inlineKeyboard.push([{
          text: `${totalMessages} Messages - ${pkg.stars} ⭐${popularText}`,
          callback_data: `buy_${index}`
        }]);
      });

      purchaseMessage += `\n💡 *Telegram Stars* can be purchased directly in Telegram
📱 Tap any package below to create an invoice
💰 Paid messages never expire and stack with your daily trial messages`;

      // Edit the message back to package selection
      await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: callbackQuery.message?.message_id,
          text: purchaseMessage,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        }),
      });

      return NextResponse.json({ ok: true, callback_handled: true });
    }

    console.log('[Telegram Bot] Unknown callback data:', callbackData);
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[Telegram Bot] Callback query error:', error);
    return NextResponse.json({ ok: true, error: 'Callback handling failed' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    console.log('Received Telegram update:', JSON.stringify(body, null, 2));

    // Handle callback queries (inline button presses)
    if (body.callback_query) {
      return await handleCallbackQuery(body.callback_query);
    }

    // Check if we have a message
    if (!body.message) {
      console.log('No message found, ignoring update');
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    const chatId = message.chat.id;
    const userName = message.from.first_name || message.from.username || 'User';
    const telegramUserId = message.from.id;
    const userId = `telegram-${telegramUserId}`;

    // Handle different message types
    let userText: string | null = null;
    let isAudioMessage = false;

    if (message.text) {
      // Text message
      userText = message.text.trim();
      console.log(`Processing text message from ${userName} (${chatId}): "${userText}"`);
    } else if (message.voice) {
      // Voice message
      isAudioMessage = true;
      console.log(`Processing voice message from ${userName} (${chatId}), file_id: ${message.voice.file_id}`);
    } else if (message.audio) {
      // Audio file
      isAudioMessage = true;
      console.log(`Processing audio file from ${userName} (${chatId}), file_id: ${message.audio.file_id}`);
    } else {
      console.log('Message type not supported, ignoring update');
      return NextResponse.json({ ok: true });
    }

    // Look up user in our database by Telegram ID
    let dbUser = null;
    let dbError = null;
    try {
      const users = await getUserByTelegramId(telegramUserId);
      dbUser = users.length > 0 ? users[0] : null;
      
      console.log('[Telegram Bot] Database user lookup:', {
        telegramUserId,
        foundInDb: !!dbUser,
        dbUserId: dbUser?.id,
        dbUserEmail: dbUser?.email,
        telegramUsername: dbUser?.telegramUsername,
        telegramFirstName: dbUser?.telegramFirstName,
        telegramLastName: dbUser?.telegramLastName,
        telegramIsPremium: dbUser?.telegramIsPremium,
        telegramLanguageCode: dbUser?.telegramLanguageCode
      });

      // If user not found, automatically register them
      if (!dbUser) {
        console.log('[Telegram Bot] User not found in database, registering automatically...');
        
        try {
          const telegramAuthResult = await telegramAuth({
            telegramId: telegramUserId,
            telegramUsername: message.from.username,
            telegramFirstName: message.from.first_name,
            telegramLastName: undefined, // Telegram bot API doesn't provide last_name
            telegramPhotoUrl: undefined, // Would need separate API call to get photo
            telegramLanguageCode: undefined, // Not available in webhook
            telegramIsPremium: undefined, // Not available in webhook
            telegramAllowsWriteToPm: undefined, // Not available in webhook
            skipEmail: true, // Skip email form, create with dummy email
          });

          if (telegramAuthResult.status === 'success') {
            console.log('[Telegram Bot] User registered successfully');
            
            // Look up the newly created user
            const newUsers = await getUserByTelegramId(telegramUserId);
            dbUser = newUsers.length > 0 ? newUsers[0] : null;
            
            console.log('[Telegram Bot] Newly registered user:', {
              dbUserId: dbUser?.id,
              dbUserEmail: dbUser?.email,
              telegramUsername: dbUser?.telegramUsername,
              telegramFirstName: dbUser?.telegramFirstName
            });
          } else {
            console.error('[Telegram Bot] Failed to register user:', telegramAuthResult);
          }
        } catch (registrationError) {
          console.error('[Telegram Bot] Error during automatic user registration:', registrationError);
        }
      }

      // Ensure we have a valid database user before proceeding
      if (!dbUser || !dbUser.id) {
        console.error('[Telegram Bot] No valid database user found after lookup/creation');
        // Get user language for error message
        const userLanguage = getUserLanguage(message.from.language_code);
        const t = getTranslations(userLanguage);
        await sendMessage(chatId, t.errors.authenticationFailed, 'Markdown');
        return NextResponse.json({ ok: true, error: 'User authentication failed' });
      }
    } catch (error) {
      dbError = error;
      console.error('[Telegram Bot] Error looking up user in database:', error);
      console.error('[Telegram Bot] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: (error as any)?.cause,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }

    // Handle audio messages - transcribe first
    if (isAudioMessage) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      if (!fileId) {
        // Get user language for error message
        const userLanguage = getUserLanguage(message.from.language_code);
        const t = getTranslations(userLanguage);
        await sendMessage(chatId, t.errors.audioProcessError, 'Markdown');
        return NextResponse.json({ ok: true, error: 'No file ID found' });
      }

      // Show typing indicator
      await sendTypingAction(chatId);

      // Get user's language for processing messages
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Send initial processing message for audio
      const processingMessage = await sendMessage(
        chatId, 
        `${t.processing.transcribing}\n${t.processing.convertingSpeech}`,
        'Markdown'
      );

      // Transcribe the audio
      const transcribedText = await downloadAndTranscribeAudio(fileId);
      
      if (!transcribedText) {
        // Edit the processing message with error
        await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: processingMessage.result.message_id,
            text: t.errors.transcriptionFailed,
            parse_mode: 'Markdown'
          }),
        });
        return NextResponse.json({ ok: true, error: 'Audio transcription failed' });
      }

      // Set the transcribed text as user input
      userText = transcribedText;
      console.log(`[Telegram Bot] Audio transcribed to: "${userText}"`);

      // Update the processing message to show transcription result
      await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: processingMessage.result.message_id,
          text: `${t.processing.audioTranscribed}\n"${userText}"\n\n${t.processing.preparingSearch}\n${formatText(t.processing.initializingSearch, { time: 15 })}`,
          parse_mode: 'Markdown'
        }),
      });

      // Start countdown timer for the updated message
      let timeRemaining = 15;
      const countdownInterval = setInterval(async () => {
        timeRemaining--;
        if (timeRemaining > 0) {
          try {
            await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: processingMessage.result.message_id,
                text: `${t.processing.audioTranscribed}\n"${userText}"\n\n${t.processing.preparingSearch}\n${formatText(t.processing.initializingSearch, { time: timeRemaining })}`,
                parse_mode: 'Markdown'
              }),
            });
          } catch (error) {
            console.log('[Telegram Bot] Timer update error:', error);
          }
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // Call external chat API with transcribed text
      const apiResult = await callExternalChatAPI(userText, userId, chatId.toString(), processingMessage, chatId, dbUser, countdownInterval, t);

      // Clear countdown timer when API call completes
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }

      if (!apiResult.success) {
        console.error('External chat API failed:', apiResult.error);
        
        // Edit the processing message with error
        await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: processingMessage.result.message_id,
            text: t.errors.technicalIssue,
            parse_mode: 'Markdown'
          }),
        });

        return NextResponse.json({ ok: true, error: apiResult.error });
      }

      // If streaming was handled, no need to update the message again
      if (apiResult.streamingComplete) {
        console.log('AI response sent successfully to Telegram via streaming (audio transcription)');
        return NextResponse.json({ 
          ok: true, 
          message_sent: true, 
          ai_response: true, 
          streaming: true,
          audio_transcribed: true,
          transcribed_text: userText,
          debug: {
            telegramUserId,
            userName,
            foundInDb: !!dbUser,
            dbUserId: dbUser?.id,
            dbUserEmail: dbUser?.email,
            telegramUsername: dbUser?.telegramUsername,
            telegramFirstName: dbUser?.telegramFirstName,
            telegramIsPremium: dbUser?.telegramIsPremium,
            telegramLanguageCode: dbUser?.telegramLanguageCode
          }
        });
      }

      // This shouldn't happen with streaming, but keeping as fallback
      return NextResponse.json({ 
        ok: true, 
        message_sent: true, 
        ai_response: true,
        audio_transcribed: true,
        transcribed_text: userText,
        debug: {
          telegramUserId,
          userName,
          foundInDb: !!dbUser,
          dbUserId: dbUser?.id,
          dbUserEmail: dbUser?.email,
          telegramUsername: dbUser?.telegramUsername,
          telegramFirstName: dbUser?.telegramFirstName,
          telegramIsPremium: dbUser?.telegramIsPremium,
          telegramLanguageCode: dbUser?.telegramLanguageCode
        }
      });
    }

    // Ensure we have text to process
    if (!userText) {
      console.log('No text to process after handling message');
      return NextResponse.json({ ok: true });
    }

    // Handle special commands
    if (userText === '/migrate') {
      // Special command to run the migration (only for your Telegram ID)
      if (telegramUserId !== 321097981) {
        await sendMessage(chatId, '❌ Unauthorized - This command is only available to the admin', 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, unauthorized: true });
      }

      await sendMessage(chatId, '🚀 Starting database migration...', 'Markdown');

      try {
        // Import the migration functions directly
        const { drizzle } = await import('drizzle-orm/postgres-js');
        const postgres = (await import('postgres')).default;
        const { sql } = await import('drizzle-orm');

        if (!process.env.POSTGRES_URL) {
          await sendMessage(chatId, '❌ Database connection not configured', 'Markdown');
          return NextResponse.json({ ok: true, message_sent: true, migration_error: true });
        }

        const client = postgres(process.env.POSTGRES_URL);
        const db = drizzle(client);

        // Add the trial balance columns
        await db.execute(sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialMessagesRemaining" INTEGER DEFAULT 0`);
        await db.execute(sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialLastResetAt" TIMESTAMP DEFAULT NOW()`);
        await db.execute(sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paidMessagesRemaining" INTEGER DEFAULT 0`);
        await db.execute(sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalMessagesPurchased" INTEGER DEFAULT 0`);
        await db.execute(sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPurchaseAt" TIMESTAMP`);

        // Initialize trial balance for existing users
        await db.execute(sql`
          UPDATE "User" 
          SET 
            "trialMessagesRemaining" = CASE 
              WHEN "email" LIKE 'guest-%' OR "email" LIKE 'telegram_%@telegram.local' THEN 2
              ELSE 5
            END,
            "trialLastResetAt" = NOW()
          WHERE "trialMessagesRemaining" IS NULL OR "trialMessagesRemaining" = 0
        `);

        await client.end();

        await sendMessage(chatId, `✅ *Migration Completed Successfully!*

The trial balance system has been set up:
• Added trial balance columns to User table
• Initialized existing users with trial messages
• Telegram users: 2 messages/day
• Regular users: 5 messages/day

Try \`/dbtest\` again to verify!`, 'Markdown');

        return NextResponse.json({ ok: true, message_sent: true, migration_success: true });

      } catch (error) {
        console.error('[Telegram Bot] Migration error:', error);
        await sendMessage(chatId, `❌ Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, migration_error: true });
      }
    }

    if (userText === '/dbtest') {
      // Special debug command that works even with database issues
      const dbTestInfo = `🔧 *Database Test Information*

*Telegram User Data:*
• Telegram ID: \`${telegramUserId}\`
• Username: @${message.from.username || 'none'}
• First Name: ${message.from.first_name || 'none'}
• Language: ${message.from.language_code || 'none'}

*Database Lookup Result:*
• User Found: ${!!dbUser ? 'Yes' : 'No'}
• Database Error: ${dbError ? 'Yes' : 'No'}
• Error Message: ${dbError instanceof Error ? dbError.message : 'None'}

*Expected User Email Pattern:*
• Should be: \`telegram_${telegramUserId}@telegram.local\`

*Next Steps:*
${!dbUser && !dbError ? '• User needs to be registered automatically' : ''}
${dbError ? '• Database connection or migration issue' : ''}
${dbUser ? '• User found, ready for trial balance testing' : ''}

*System Status:*
• Current Time: ${new Date().toLocaleString()}
• Environment: ${process.env.NODE_ENV || 'unknown'}`;

      await sendMessage(chatId, dbTestInfo, 'Markdown');
      return NextResponse.json({ 
        ok: true, 
        message_sent: true, 
        db_test: true,
        user_found: !!dbUser,
        db_error: !!dbError,
        error_message: dbError instanceof Error ? dbError.message : null
      });
    }

    if (userText === '/debug') {
      // Debug command to show user's trial balance
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, '❌ Debug error: User not found in database', 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, debug_error: true });
      }
      
      try {
        const { getUserMessageBalance } = await import('@/lib/db/queries');
        const balance = await getUserMessageBalance(dbUser.id);
        
        const debugInfo = `🔧 *Debug Information*

*User Details:*
• Database ID: \`${dbUser.id}\`
• Email: \`${dbUser.email}\`
• Telegram ID: \`${telegramUserId}\`
• Username: @${dbUser.telegramUsername || 'none'}
• First Name: ${dbUser.telegramFirstName || 'none'}

*Trial Balance:*
• Trial Messages Remaining: ${balance.trialMessagesRemaining}
• Paid Messages Remaining: ${balance.paidMessagesRemaining}
• Total Messages Available: ${balance.totalMessagesRemaining}
• Needs Daily Reset: ${balance.needsReset ? 'Yes' : 'No'}
• Last Reset: ${dbUser.trialLastResetAt ? new Date(dbUser.trialLastResetAt).toLocaleString() : 'Never'}

*User Type:*
• Is Guest: ${dbUser.email.startsWith('guest-') || dbUser.email.includes('@telegram.local') ? 'Yes' : 'No'}
• Expected Trial Messages/Day: ${dbUser.email.startsWith('guest-') || dbUser.email.includes('@telegram.local') ? '2' : '5'}

*System Status:*
• Trial Balance System: Enabled
• Current Time: ${new Date().toLocaleString()}`;

        await sendMessage(chatId, debugInfo, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, debug_info: true });
      } catch (error) {
        console.error('[Telegram Bot] Debug command error:', error);
        await sendMessage(chatId, `❌ Debug error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, debug_error: true });
      }
    }

    if (userText === '/reset') {
      // Debug command to manually reset trial balance
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, '❌ Reset error: User not found in database', 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, reset_error: true });
      }
      
      try {
        const { resetDailyTrialBalance } = await import('@/lib/db/queries');
        await resetDailyTrialBalance(dbUser.id);
        
        const resetInfo = `✅ *Trial Balance Reset*

Your daily trial balance has been manually reset!

Use \`/debug\` to see your updated balance.`;

        await sendMessage(chatId, resetInfo, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_reset: true });
      } catch (error) {
        console.error('[Telegram Bot] Reset command error:', error);
        await sendMessage(chatId, `❌ Reset error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, reset_error: true });
      }
    }

    if (userText === '/balance') {
      // Simple balance check command
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, '❌ Balance error: User not found in database', 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_error: true });
      }
      
      try {
        const { getUserMessageBalance } = await import('@/lib/db/queries');
        const balance = await getUserMessageBalance(dbUser.id);
        
        const balanceInfo = `💰 *Your Message Balance*

🎯 **Trial Messages:** ${balance.trialMessagesRemaining}
💎 **Paid Messages:** ${balance.paidMessagesRemaining}
📊 **Total Available:** ${balance.totalMessagesRemaining}

${balance.needsReset ? '⏰ *Your trial balance will reset soon!*' : '✅ *Trial balance is current*'}

${balance.totalMessagesRemaining === 0 ? '⚠️ *No messages remaining! Use /buy to purchase more with Telegram Stars.*' : ''}`;

        await sendMessage(chatId, balanceInfo, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_check: true });
      } catch (error) {
        console.error('[Telegram Bot] Balance command error:', error);
        await sendMessage(chatId, `❌ Balance check error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_error: true });
      }
    }

    if (userText === '/buy') {
      // Show purchase options
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, '❌ Purchase error: User not found in database', 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
      }

      try {
        const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
        
        console.log('[Telegram Bot] Processing /buy command:', {
          telegramUserId,
          chatId,
          packagesAvailable: PAYMENT_CONFIG.PACKAGES.length
        });
        
        let purchaseMessage = `🌟 *Purchase Messages with Telegram Stars*

Choose a package to buy more messages:

`;

        // Create inline keyboard with purchase options
        const inlineKeyboard: Array<Array<{text: string, callback_data: string}>> = [];
        
        PAYMENT_CONFIG.PACKAGES.forEach((pkg, index) => {
          const totalMessages = pkg.messages + pkg.bonus;
          const bonusText = pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : '';
          const popularText = pkg.popular ? ' 🔥' : '';
          
          purchaseMessage += `${index + 1}. **${totalMessages} Messages** (${pkg.messages}${bonusText}) - ${pkg.stars} ⭐${popularText}\n`;
          
          inlineKeyboard.push([{
            text: `${totalMessages} Messages - ${pkg.stars} ⭐${popularText}`,
            callback_data: `buy_${index}`
          }]);
        });

        purchaseMessage += `\n💡 *Telegram Stars* can be purchased directly in Telegram
📱 Tap any package below to create an invoice
💰 Paid messages never expire and stack with your daily trial messages`;

        // Send message with inline keyboard
        console.log('[Telegram Bot] Sending purchase menu with payload:', {
          chat_id: chatId,
          text: purchaseMessage.substring(0, 100) + '...',
          parse_mode: 'Markdown',
          inline_keyboard_rows: inlineKeyboard.length
        });

        const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: purchaseMessage,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: inlineKeyboard
            }
          }),
        });

        console.log('[Telegram Bot] Telegram API response status:', response.status, response.statusText);

        const result = await response.json();
        console.log('[Telegram Bot] Telegram API response body:', result);
        
        if (!result.ok) {
          console.error('[Telegram Bot] Failed to send purchase menu:', result);
          
          // Try with HTML formatting instead of Markdown
          console.log('[Telegram Bot] Retrying with HTML formatting...');
          
          const htmlMessage = `🌟 <b>Purchase Messages with Telegram Stars</b>

Choose a package to buy more messages:

1. <b>20 Messages</b> - 100 ⭐
2. <b>50 Messages</b> - 250 ⭐ 🔥
3. <b>105 Messages</b> (100 + 5 bonus) - 500 ⭐
4. <b>220 Messages</b> (200 + 20 bonus) - 1000 ⭐

💡 <i>Telegram Stars</i> can be purchased directly in Telegram
📱 Tap any package below to create an invoice
💰 Paid messages never expire and stack with your daily trial messages`;

          const retryResponse = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: htmlMessage,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: inlineKeyboard
              }
            }),
          });

          const retryResult = await retryResponse.json();
          console.log('[Telegram Bot] HTML retry result:', retryResult);

          if (!retryResult.ok) {
            // Final fallback: Send simple text message without inline keyboard
            const fallbackMessage = `🌟 Purchase Messages with Telegram Stars

Available packages:
• 20 Messages - 100 ⭐
• 50 Messages - 250 ⭐ (Popular)
• 105 Messages - 500 ⭐ (+5 bonus)
• 220 Messages - 1000 ⭐ (+20 bonus)

Contact support to purchase messages.`;

            await sendMessage(chatId, fallbackMessage);
            return NextResponse.json({ ok: true, message_sent: true, purchase_fallback: true });
          } else {
            console.log('[Telegram Bot] HTML retry successful');
            return NextResponse.json({ ok: true, message_sent: true, purchase_menu: true, retry_html: true });
          }
        }

        console.log('[Telegram Bot] Purchase menu sent successfully:', {
          telegramUserId,
          chatId,
          packagesShown: PAYMENT_CONFIG.PACKAGES.length
        });

        return NextResponse.json({ ok: true, message_sent: true, purchase_menu: true });
      } catch (error) {
        console.error('[Telegram Bot] Buy command error:', error);
        await sendMessage(chatId, `❌ Purchase menu error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
      }
    }

    if (userText === '/start') {
      // Get user's language from Telegram data
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      const welcomeText = `${formatText(t.welcome.greeting, { userName })}

${t.welcome.description}

${t.welcome.howToAsk}
${t.welcome.textMessages}
${t.welcome.voiceMessages}
${t.welcome.forwardMessages}

${t.welcome.whatICanHelp}
${t.welcome.quranicVerses}
${t.welcome.islamicTeachings}
${t.welcome.hadithScholarly}
${t.welcome.prayerWorship}
${t.welcome.risaleNur}

${t.welcome.howItWorks}
${t.welcome.step1}
${t.welcome.step2}
${t.welcome.step3}
${t.welcome.completeResponse}
${t.welcome.dedicatedUI}
${t.welcome.enhancedSearch}
${t.welcome.chatHistory}

${t.welcome.accessFullService}
${t.welcome.menuButton}

${t.welcome.exampleQuestions}
${t.welcome.prayerExample}
${t.welcome.tawhidExample}
${t.welcome.pillarsExample}

${t.welcome.feelFree}`;

      await sendMessage(chatId, welcomeText, 'Markdown');
      return NextResponse.json({ ok: true, message_sent: true });
    }

    if (userText === '/help') {
      // Get user's language from Telegram data
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      const helpText = `${t.help.title}

${t.help.description}
${t.help.quranHadith}
${t.help.classicalScholarship}
${t.help.modernTeachings}
${t.help.risaleNurCollection}
${t.help.educationalContent}

${t.help.tipsTitle}
${t.help.beSpecific}
${t.help.oneQuestion}
${t.help.clearLanguage}

${t.help.commands}
${t.help.startCommand}
${t.help.helpCommand}

*Purchase Commands:*
• \`/buy\` - Purchase more messages with Telegram Stars
• \`/balance\` - Check your message balance

*Debug Commands:*
• \`/debug\` - Show detailed debug information
• \`/reset\` - Manually reset your daily trial balance
• \`/dbtest\` - Test database connection and user lookup

${t.help.blessing}`;

      await sendMessage(chatId, helpText, 'Markdown');
      return NextResponse.json({ ok: true, message_sent: true });
    }

    // Check if the message is an 8-digit binding code
    const bindingCodePattern = /^\d{8}$/;
    if (bindingCodePattern.test(userText)) {
      console.log(`[Telegram Bot] Detected potential binding code: ${userText}`);
      
      // Get user's language for messages
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Show processing message
      await sendTypingAction(chatId);
      const bindingProcessingMessage = await sendMessage(
        chatId, 
        '🔗 *Checking binding code...*\n\nPlease wait while I verify your code.',
        'Markdown'
      );
      
      try {

        // Attempt to use the binding code
        let bindingResult;
        let bindingError = null;
        
        try {
          bindingResult = await useTelegramBindingCode(userText, {
            telegramId: telegramUserId,
            telegramUsername: message.from.username,
            telegramFirstName: message.from.first_name,
            telegramLastName: undefined, // Not available in webhook
            telegramPhotoUrl: undefined, // Would need separate API call
            telegramLanguageCode: message.from.language_code,
            telegramIsPremium: undefined, // Not available in webhook
            telegramAllowsWriteToPm: undefined, // Not available in webhook
          });
          
          console.log(`[Telegram Bot] Binding result:`, {
            success: bindingResult?.success,
            transferred: bindingResult?.transferred,
            userId: bindingResult?.userId,
            email: bindingResult?.email,
            oldUserId: bindingResult?.oldUserId
          });
        } catch (error) {
          bindingError = error;
          console.log(`[Telegram Bot] Binding error details:`, error);
          console.log(`[Telegram Bot] Error message:`, error instanceof Error ? error.message : 'No message');
          console.log(`[Telegram Bot] Error cause:`, (error as any)?.cause);
        }

        if (bindingResult?.success) {
          // Success! Account bound
          let successMessage;
          
                      if (bindingResult.transferred) {
              // Special message for re-binding from dummy account
              successMessage = `✅ *Account Successfully Upgraded & Linked!*

🎉 Your Telegram account has been successfully upgraded and connected to your email account: \`${bindingResult.email}\`

*What this means:*
• You can now access your complete chat history from both Telegram and the web
• Your conversations are synced across all platforms
• You have full access to all premium features
• All your previous chats and messages are preserved

Welcome to the complete Islamic Knowledge Assistant experience! 🌟`;
          } else {
            // Standard binding message
            successMessage = `✅ *Account Successfully Linked!*

🎉 Your Telegram account has been successfully connected to your email account: \`${bindingResult.email}\`

*What this means:*
• You can now access your chat history from both Telegram and the web
• Your conversations are synced across all platforms
• You have full access to all premium features

*Next steps:*
• Continue chatting here in Telegram
• Visit the web app for enhanced features and full chat history
• Your account is now fully integrated!

Welcome to the complete Islamic Knowledge Assistant experience! 🌟`;
          }

          // Edit the processing message with success
          await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: bindingProcessingMessage.result.message_id,
              text: successMessage,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🌐 Open Web App',
                    web_app: {
                      url: BASE_URL
                    }
                  }
                ]]
              }
            }),
          });

          console.log(`[Telegram Bot] Successfully bound account for user ${telegramUserId} to email ${bindingResult.email}${bindingResult.transferred ? ' (with data transfer)' : ''}`);
          
          return NextResponse.json({ 
            ok: true, 
            message_sent: true, 
            binding_success: true,
            bound_email: bindingResult.email,
            data_transferred: bindingResult.transferred || false,
            debug: {
              telegramUserId,
              userName,
              bindingCode: userText,
              boundToUserId: bindingResult.userId,
              oldUserId: bindingResult.oldUserId
            }
          });

        } else {
          // Binding failed - check specific error
          let errorMessage = '';
          
          if (bindingError && bindingError instanceof Error && 
              (bindingError.message.includes('already linked') || 
               bindingError.message.includes('already linked to another user') ||
               (bindingError as any)?.cause?.includes('already linked to another user'))) {
            // Get the existing user's email to help them
            let existingEmail = 'your existing account';
            let isDummyEmailAccount = false;
            try {
              const existingUsers = await getUserByTelegramId(telegramUserId);
              if (existingUsers.length > 0 && existingUsers[0].email) {
                existingEmail = existingUsers[0].email;
                isDummyEmailAccount = existingEmail.startsWith('telegram_') && existingEmail.endsWith('@telegram.local');
              }
            } catch (e) {
              console.log('[Telegram Bot] Could not fetch existing user email:', e);
            }
            
            if (isDummyEmailAccount) {
              // Special message for dummy email accounts that should be able to re-bind
              errorMessage = `⚠️ *Re-binding Issue*

There was an issue upgrading your temporary Telegram account to a full email account.

*Your current account:* Temporary Telegram-only account
*Trying to connect to:* Email account with binding code

*What you can try:*
1. **Generate a new binding code** on the web app
2. Make sure the binding code hasn't expired (15 minutes)
3. Try the binding process again

*If the issue persists:*
• Contact support for assistance
• Your chat history is safe and will be preserved

*Need help?* Contact support or try generating a new code.`;
            } else {
              // Regular case: real email account already linked
              errorMessage = `❌ *Telegram Account Already Linked*

This Telegram account is already connected to another user account.

*Your existing account email:* \`${existingEmail}\`

*What you can do:*
1. **Login with this email** on the web app
2. If you forgot your password, use "Forgot Password" on the login page
3. Once logged in, you'll have full access to your account`;
            }
          } else {
            // Generic error for invalid/expired codes
            errorMessage = `❌ *Invalid Binding Code*

The code \`${userText}\` is not valid or has expired.

*Possible reasons:*
• Code has expired (codes are valid for 15 minutes)
• Code has already been used
• Code was typed incorrectly

*To get a new code:*
1. Go to the web app
2. Click "Connect Telegram Account" in the sidebar
3. Copy the new 8-digit code
4. Send it here within 15 minutes

*Need help?* Contact support or try generating a new code.`;
          }

          // Edit the processing message with error
          await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: bindingProcessingMessage.result.message_id,
              text: errorMessage,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🌐 Get New Code',
                    web_app: {
                      url: BASE_URL
                    }
                  }
                ]]
              }
            }),
          });

          console.log(`[Telegram Bot] Binding failed for code ${userText}: Invalid or expired`);
          
          return NextResponse.json({ 
            ok: true, 
            message_sent: true, 
            binding_failed: true,
            error: 'Invalid or expired binding code',
            debug: {
              telegramUserId,
              userName,
              bindingCode: userText
            }
          });
        }

      } catch (error) {
        console.error(`[Telegram Bot] Error processing binding code ${userText}:`, error);
        
        // Edit the processing message with technical error
        const technicalErrorMessage = `⚠️ *Technical Error*

Sorry, there was a technical issue while processing your binding code.

*Please try again in a few moments.*

If the problem persists, please contact support.`;

        await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: bindingProcessingMessage.result.message_id,
            text: technicalErrorMessage,
            parse_mode: 'Markdown'
          }),
        });

        return NextResponse.json({ 
          ok: true, 
          message_sent: true, 
          binding_error: true,
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: {
            telegramUserId,
            userName,
            bindingCode: userText
          }
        });
      }
    }

    // Get user's language for processing messages
    const userLanguage = getUserLanguage(message.from.language_code);
    const t = getTranslations(userLanguage);

    // Show typing indicator
    await sendTypingAction(chatId);

    // Send initial processing message with countdown timer
    const processingMessage = await sendMessage(
      chatId, 
      `${t.processing.preparingSearch}\n${formatText(t.processing.initializingSearch, { time: 15 })}`,
      'Markdown'
    );

    // Start countdown timer
    let timeRemaining = 15;
    const countdownInterval = setInterval(async () => {
      timeRemaining--;
      if (timeRemaining > 0) {
        try {
          await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: processingMessage.result.message_id,
              text: `${t.processing.preparingSearch}\n${formatText(t.processing.initializingSearch, { time: timeRemaining })}`,
              parse_mode: 'Markdown'
            }),
          });
        } catch (error) {
          console.log('[Telegram Bot] Timer update error:', error);
        }
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Log trial balance before processing message
    if (dbUser && dbUser.id) {
      try {
        const { getUserMessageBalance } = await import('@/lib/db/queries');
        const balanceBeforeMessage = await getUserMessageBalance(dbUser.id);
        console.log('[Telegram Bot] User balance before message:', {
          userId: dbUser.id,
          email: dbUser.email,
          trialRemaining: balanceBeforeMessage.trialMessagesRemaining,
          paidRemaining: balanceBeforeMessage.paidMessagesRemaining,
          totalRemaining: balanceBeforeMessage.totalMessagesRemaining,
          needsReset: balanceBeforeMessage.needsReset
        });
      } catch (error) {
        console.log('[Telegram Bot] Error checking balance before message:', error);
      }
    }

    // Call external chat API with streaming support
    const apiResult = await callExternalChatAPI(userText, userId, chatId.toString(), processingMessage, chatId, dbUser, countdownInterval, t);

    // Clear countdown timer when API call completes
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    if (!apiResult.success) {
      console.error('External chat API failed:', apiResult.error);
      
      // Edit the processing message with error
      await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: processingMessage.result.message_id,
          text: t.errors.technicalIssue,
          parse_mode: 'Markdown'
        }),
      });

      return NextResponse.json({ ok: true, error: apiResult.error });
    }

    // If streaming was handled, no need to update the message again
    if (apiResult.streamingComplete) {
      console.log('AI response sent successfully to Telegram via streaming');
      return NextResponse.json({ 
        ok: true, 
        message_sent: true, 
        ai_response: true, 
        streaming: true,
        debug: {
          telegramUserId,
          userName,
          foundInDb: !!dbUser,
          dbUserId: dbUser?.id,
          dbUserEmail: dbUser?.email,
          telegramUsername: dbUser?.telegramUsername,
          telegramFirstName: dbUser?.telegramFirstName,
          telegramIsPremium: dbUser?.telegramIsPremium,
          telegramLanguageCode: dbUser?.telegramLanguageCode
        }
      });
    }

    // Fallback: Clean up the response text and send as single message (if streaming failed)
    let responseText = apiResult.response;
    
    // Remove any HTML tags but keep citation markers
    responseText = responseText
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim();

    // Convert Markdown to simple text with basic formatting and proper line breaks
    responseText = responseText
      .replace(/\\n/g, '\n') // Convert literal \n to actual line breaks
      .replace(/\*\*(.*?)\*\*/g, '*$1*') // Convert **bold** to *bold*
      .replace(/\*(.*?)\*/g, '_$1_') // Convert *italic* to _italic_
      .replace(/### (.*?)$/gm, '*$1*') // Convert ### headers to *bold*
      .replace(/^\* /gm, '• ') // Convert bullet points
      .replace(/^\d+\. /gm, (match) => match) // Keep numbered lists
      .replace(/^> /gm, '▶️ ') // Convert blockquotes
      .replace(/\[CIT(\d+)\]/g, ' 📚') // Replace citations with book emoji
      .replace(/\n\n\n+/g, '\n\n') // Remove excessive line breaks
      .replace(/\n\s*\n/g, '\n\n'); // Clean up spacing

    // Ensure response isn't too long for Telegram (max 4096 characters)
    if (responseText.length > 4000) {
      responseText = responseText.substring(0, 3900) + '\n\n...\n\n*Response truncated due to length. Please ask for more specific details if needed.*';
    }

    // Use clean response text
    const formattedResponse = responseText;

    // Edit the processing message with the final response
    await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: processingMessage.result.message_id,
        text: formattedResponse,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: t.buttons.fullResponse,
              web_app: {
                url: BASE_URL
              }
            }
          ]]
        }
      }),
    });

    console.log('AI response sent successfully to Telegram (fallback)');

    return NextResponse.json({ 
      ok: true, 
      message_sent: true, 
      ai_response: true,
      debug: {
        telegramUserId,
        userName,
        foundInDb: !!dbUser,
        dbUserId: dbUser?.id,
        dbUserEmail: dbUser?.email,
        telegramUsername: dbUser?.telegramUsername,
        telegramFirstName: dbUser?.telegramFirstName,
        telegramIsPremium: dbUser?.telegramIsPremium,
        telegramLanguageCode: dbUser?.telegramLanguageCode
      }
    });
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