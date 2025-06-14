import { NextRequest, NextResponse } from 'next/server';
import { generateUUID } from '@/lib/utils';
import { createHash } from 'crypto';
import { getUserByTelegramId, useTelegramBindingCode, getUserMessageBalance, addPaidMessages, recordStarPayment } from '@/lib/db/queries';
import { telegramAuth } from '@/app/(auth)/actions';
import { getUserLanguage, getTranslations, formatText } from '@/lib/telegram-translations';
import { PAYMENT_CONFIG } from '@/lib/ai/entitlements';

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

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    message?: TelegramMessage;
    data?: string;
  };
  successful_payment?: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
  };
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

// =============================================================================
// TELEGRAM STARS PAYMENT FUNCTIONS
// =============================================================================

async function sendInvoice(chatId: number, packageInfo: { messages: number; stars: number; bonus: number; popular: boolean }) {
  try {
    if (TEST_MODE) {
      console.log(`[TEST MODE] Would send invoice to chat ${chatId}:`, packageInfo);
      return { ok: true, result: { message_id: Date.now() } };
    }

    const totalMessages = packageInfo.messages + packageInfo.bonus;
    const title = `${packageInfo.messages} Messages${packageInfo.bonus > 0 ? ` + ${packageInfo.bonus} Bonus` : ''}`;
    const description = `Get ${totalMessages} additional messages for your Islamic Knowledge Assistant. Each message costs ${PAYMENT_CONFIG.STARS_PER_MESSAGE} stars.${packageInfo.bonus > 0 ? ` Includes ${packageInfo.bonus} bonus messages!` : ''}`;
    
    const payload = JSON.stringify({
      packageMessages: packageInfo.messages,
      bonusMessages: packageInfo.bonus,
      totalStars: packageInfo.stars,
      timestamp: Date.now()
    });

    const response = await fetch(`${TELEGRAM_API_URL}/sendInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        title: title,
        description: description,
        payload: payload,
        currency: 'XTR', // Telegram Stars currency
        prices: [
          {
            label: `${totalMessages} Messages`,
            amount: packageInfo.stars
          }
        ],
        photo_url: 'https://tauhid2.onrender.com/images/payment-icon.png', // Optional: Add a payment icon
        photo_width: 512,
        photo_height: 512,
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        send_phone_number_to_provider: false,
        send_email_to_provider: false,
        is_flexible: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send invoice:', errorText);
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error sending invoice:', error);
    throw error;
  }
}

async function handleSuccessfulPayment(telegramUserId: number, paymentInfo: any, dbUser: any) {
  try {
    console.log('[Telegram Stars] Processing successful payment:', {
      telegramUserId,
      paymentChargeId: paymentInfo.telegram_payment_charge_id,
      totalAmount: paymentInfo.total_amount,
      payload: paymentInfo.invoice_payload
    });

    // Parse the payload to get package details
    const payload = JSON.parse(paymentInfo.invoice_payload);
    const totalMessages = payload.packageMessages + payload.bonusMessages;
    const starAmount = payload.totalStars;

    // Record the payment in database
    await recordStarPayment({
      userId: dbUser.id,
      telegramPaymentChargeId: paymentInfo.telegram_payment_charge_id,
      starAmount: starAmount,
      messagesAdded: totalMessages,
    });

    // Add messages to user's balance
    await addPaidMessages(dbUser.id, totalMessages);

    console.log(`[Telegram Stars] Successfully added ${totalMessages} messages to user ${dbUser.id}`);

    return {
      success: true,
      messagesAdded: totalMessages,
      starAmount: starAmount
    };
  } catch (error) {
    console.error('[Telegram Stars] Error processing payment:', error);
    throw error;
  }
}

async function showPaymentPackages(chatId: number, userLanguage: string = 'en') {
  try {
    const t = getTranslations(userLanguage);
    
    // Get user's current balance
    let balanceInfo = '';
    try {
      const users = await getUserByTelegramId(chatId); // Using chatId as telegramUserId for direct messages
      if (users.length > 0) {
        const balance = await getUserMessageBalance(users[0].id);
        balanceInfo = `\n💬 *Current Balance:* ${balance.totalMessagesRemaining} messages (${balance.trialMessagesRemaining} trial + ${balance.paidMessagesRemaining} paid)`;
      }
    } catch (error) {
      console.log('[Telegram Stars] Could not fetch balance for payment menu:', error);
      // Check if it's a migration-related error
      if (error instanceof Error && error.message.includes('migration')) {
        throw new Error('Payment system migration in progress');
      }
    }

    const paymentText = `⭐ *Buy Additional Messages with Telegram Stars*

Need more messages? Purchase additional messages using Telegram Stars!${balanceInfo}

💰 *Available Packages:*

${PAYMENT_CONFIG.PACKAGES.map((pkg, index) => {
      const totalMessages = pkg.messages + pkg.bonus;
      const starsPerMessage = (pkg.stars / totalMessages).toFixed(1);
      const popularBadge = pkg.popular ? ' 🔥 *POPULAR*' : '';
      const bonusText = pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : '';
      
      return `${index + 1}. **${pkg.messages}${bonusText} messages** - ${pkg.stars} ⭐
   _${starsPerMessage} stars per message_${popularBadge}`;
    }).join('\n\n')}

💡 *How it works:*
1. Choose a package below
2. Pay with Telegram Stars
3. Messages are added instantly to your account
4. Use them anytime - they never expire!

🌟 *Why buy more messages?*
• Get detailed Islamic guidance
• Access comprehensive Quran & Hadith references
• Explore Risale-i Nur collection
• No daily limits on purchased messages

Choose a package to get started:`;

    const keyboard = {
      inline_keyboard: [
        // Create rows of 2 packages each
        ...PAYMENT_CONFIG.PACKAGES.reduce((rows: any[], pkg, index) => {
          const totalMessages = pkg.messages + pkg.bonus;
          const bonusText = pkg.bonus > 0 ? `+${pkg.bonus}` : '';
          const popularEmoji = pkg.popular ? '🔥 ' : '';
          
          const button = {
            text: `${popularEmoji}${pkg.messages}${bonusText} msgs - ${pkg.stars}⭐`,
            callback_data: `buy_${index}`
          };
          
          if (index % 2 === 0) {
            // Start new row
            rows.push([button]);
          } else {
            // Add to current row
            rows[rows.length - 1].push(button);
          }
          
          return rows;
        }, []),
        [
          {
            text: '💬 Check Balance',
            callback_data: 'check_balance'
          },
          {
            text: '❌ Cancel',
            callback_data: 'cancel_payment'
          }
        ]
      ]
    };

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: paymentText,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send payment packages:', errorText);
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error showing payment packages:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    console.log('Received Telegram update:', JSON.stringify(body, null, 2));

    // Handle callback queries (inline keyboard button presses)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message?.chat.id;
      const telegramUserId = callbackQuery.from.id;
      const callbackData = callbackQuery.data;
      
      console.log(`[Telegram Bot] Callback query from user ${telegramUserId}: ${callbackData}`);

      if (!chatId || !callbackData) {
        return NextResponse.json({ ok: true });
      }

      // Answer the callback query to remove loading state
      await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: 'Processing...'
        }),
      });

      // Handle different callback actions
      if (callbackData.startsWith('buy_')) {
        // Extract package index
        const packageIndex = parseInt(callbackData.replace('buy_', ''));
        const packageInfo = PAYMENT_CONFIG.PACKAGES[packageIndex];
        
        if (packageInfo) {
          console.log(`[Telegram Stars] User ${telegramUserId} selected package:`, packageInfo);
          
          // Send invoice for the selected package
          try {
            await sendInvoice(chatId, packageInfo);
            console.log(`[Telegram Stars] Invoice sent successfully for package ${packageIndex}`);
          } catch (error) {
            console.error(`[Telegram Stars] Failed to send invoice:`, error);
            await sendMessage(chatId, '❌ Sorry, there was an error creating the payment. Please try again later.', 'Markdown');
          }
        }
      } else if (callbackData === 'check_balance') {
        // Show user's current balance
        try {
          const users = await getUserByTelegramId(telegramUserId);
          if (users.length > 0) {
            const balance = await getUserMessageBalance(users[0].id);
            const balanceText = `💬 *Your Current Balance*

📊 **Total Messages:** ${balance.totalMessagesRemaining}
🆓 **Trial Messages:** ${balance.trialMessagesRemaining} (resets daily)
💰 **Paid Messages:** ${balance.paidMessagesRemaining} (never expire)

${balance.needsReset ? '🔄 *Your trial balance will reset soon!*' : ''}

💡 *Need more messages?* Use the buttons below to purchase additional messages with Telegram Stars.`;

            await sendMessage(chatId, balanceText, 'Markdown');
          } else {
            await sendMessage(chatId, '❌ Could not retrieve your balance. Please try again.', 'Markdown');
          }
        } catch (error) {
          console.error('[Telegram Stars] Error checking balance:', error);
          await sendMessage(chatId, '❌ Could not retrieve your balance. Please try again.', 'Markdown');
        }
             } else if (callbackData === 'cancel_payment') {
         await sendMessage(chatId, '❌ Payment cancelled. You can buy messages anytime by typing `/buy` or when you run out of messages.', 'Markdown');
       } else if (callbackData === 'show_payment_packages') {
         // Show payment packages
         const userLanguage = getUserLanguage(callbackQuery.from.language_code);
         try {
           await showPaymentPackages(chatId, userLanguage);
           console.log(`[Telegram Stars] Payment packages shown to user ${telegramUserId} via callback`);
         } catch (error) {
           console.error('[Telegram Stars] Error showing payment packages via callback:', error);
           await sendMessage(chatId, '❌ Sorry, there was an error showing the payment options. Please try again later.', 'Markdown');
         }
       }

      return NextResponse.json({ ok: true, callback_handled: true });
    }

    // Handle successful payments
    if (body.successful_payment) {
      console.log('[Telegram Stars] Successful payment received:', body.successful_payment);
      
      // We need to get the message that contains the successful payment
      // This will be in the message field of the update
      if (body.message) {
        const chatId = body.message.chat.id;
        const telegramUserId = body.message.from.id;
        
        try {
          // Look up user in database
          const users = await getUserByTelegramId(telegramUserId);
          if (users.length === 0) {
            console.error('[Telegram Stars] User not found in database for payment processing');
            await sendMessage(chatId, '❌ Payment received but user not found. Please contact support.', 'Markdown');
            return NextResponse.json({ ok: true, error: 'User not found' });
          }
          
          const dbUser = users[0];
          
          // Process the payment
          const paymentResult = await handleSuccessfulPayment(telegramUserId, body.successful_payment, dbUser);
          
          if (paymentResult.success) {
            // Send success message
            const successText = `✅ *Payment Successful!*

🎉 **${paymentResult.messagesAdded} messages** have been added to your account!
⭐ **${paymentResult.starAmount} Telegram Stars** charged

💬 *Your messages are ready to use and never expire.*
🚀 *Start chatting to get detailed Islamic guidance!*

Thank you for your purchase! 🌟`;

            await sendMessage(chatId, successText, 'Markdown');
            
            console.log(`[Telegram Stars] Payment processed successfully for user ${telegramUserId}: ${paymentResult.messagesAdded} messages added`);
          } else {
            await sendMessage(chatId, '❌ Payment received but there was an error adding messages to your account. Please contact support.', 'Markdown');
          }
        } catch (error) {
          console.error('[Telegram Stars] Error processing successful payment:', error);
          await sendMessage(chatId, '❌ Payment received but there was an error processing it. Please contact support.', 'Markdown');
        }
      }
      
      return NextResponse.json({ ok: true, payment_processed: true });
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
      console.error('[Telegram Bot] Error looking up user in database:', error);
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
    if (userText === '/start') {
      // Get user's language from Telegram data
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Get user's current balance for welcome message
      let balanceInfo = '';
      try {
        if (dbUser) {
          const balance = await getUserMessageBalance(dbUser.id);
          const isGuest = dbUser.email.startsWith('guest-') || dbUser.email.includes('@telegram.local');
          const userType = isGuest ? 'guest' : 'regular';
          const dailyLimit = userType === 'guest' ? 2 : 5;
          
          balanceInfo = `\n💬 *Your Message Balance:*
🆓 Trial: ${balance.trialMessagesRemaining}/${dailyLimit} messages (resets daily)
💰 Paid: ${balance.paidMessagesRemaining} messages (never expire)

`;
        }
      } catch (error) {
        console.log('[Telegram Bot] Could not fetch balance for welcome message:', error);
      }

      const welcomeText = `${formatText(t.welcome.greeting, { userName })}

${t.welcome.description}
${balanceInfo}
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

💰 *Need More Messages?*
• Type \`/buy\` to purchase additional messages with Telegram Stars
• Type \`/balance\` to check your current message balance
• Purchased messages never expire!

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

${t.help.blessing}`;

      await sendMessage(chatId, helpText, 'Markdown');
      return NextResponse.json({ ok: true, message_sent: true });
    }

    // Handle /buy command - show payment packages
    if (userText === '/buy' || userText.toLowerCase() === 'buy messages' || userText.toLowerCase() === 'buy more messages') {
      const userLanguage = getUserLanguage(message.from.language_code);
      
      try {
        await showPaymentPackages(chatId, userLanguage);
        console.log(`[Telegram Stars] Payment packages shown to user ${telegramUserId}`);
        return NextResponse.json({ ok: true, message_sent: true, payment_menu_shown: true });
      } catch (error) {
        console.error('[Telegram Stars] Error showing payment packages:', error);
        
        // Check if it's a migration-related error
        if (error instanceof Error && error.message.includes('migration')) {
          await sendMessage(chatId, `🔧 *Payment System Updating*

The payment system is currently being updated with new features!

⏳ **What's happening:**
• Database migration in progress
• Payment features will be available soon
• Your current messages are still working

🆓 **For now:**
• Continue using your daily trial messages
• Payment system will be restored shortly
• No action needed from you

Thank you for your patience! 🙏`, 'Markdown');
        } else {
          await sendMessage(chatId, '❌ Sorry, there was an error showing the payment options. Please try again later.', 'Markdown');
        }
        return NextResponse.json({ ok: true, error: 'Failed to show payment packages' });
      }
    }

    // Handle /balance command - show current balance
    if (userText === '/balance' || userText.toLowerCase() === 'balance' || userText.toLowerCase() === 'my balance') {
      try {
        if (dbUser) {
          const balance = await getUserMessageBalance(dbUser.id);
          const balanceText = `💬 *Your Message Balance*

📊 **Total Messages Available:** ${balance.totalMessagesRemaining}

🆓 **Trial Messages:** ${balance.trialMessagesRemaining}
   _Resets daily • Free messages for all users_

💰 **Paid Messages:** ${balance.paidMessagesRemaining}
   _Never expire • Purchased with Telegram Stars_

${balance.needsReset ? '🔄 *Your trial balance will reset in a few hours!*\n' : ''}
${balance.totalMessagesRemaining === 0 ? '⚠️ *You have no messages left. Use /buy to purchase more.*' : ''}

💡 *Need more messages?* Type \`/buy\` to see available packages.`;

          await sendMessage(chatId, balanceText, 'Markdown');
        } else {
          await sendMessage(chatId, '❌ Could not retrieve your balance. Please try again.', 'Markdown');
        }
        return NextResponse.json({ ok: true, message_sent: true, balance_shown: true });
      } catch (error) {
        console.error('[Telegram Bot] Error showing balance:', error);
        await sendMessage(chatId, '❌ Could not retrieve your balance. Please try again.', 'Markdown');
        return NextResponse.json({ ok: true, error: 'Failed to show balance' });
      }
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

    // Call external chat API with streaming support
    const apiResult = await callExternalChatAPI(userText, userId, chatId.toString(), processingMessage, chatId, dbUser, countdownInterval, t);

    // Clear countdown timer when API call completes
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    if (!apiResult.success) {
      console.error('External chat API failed:', apiResult.error);
      
      // Check if it's a rate limit error
      if (apiResult.error && apiResult.error.includes('rate limit')) {
        console.log('[Telegram Bot] Rate limit detected, showing payment options');
        
        // Show rate limit message with payment options
        const rateLimitText = `⚠️ *Daily Message Limit Reached*

You've used all your free messages for today!

💬 **Your Options:**
🆓 **Wait for Reset:** Your trial messages will reset in a few hours
💰 **Buy More Messages:** Get additional messages instantly with Telegram Stars

🌟 **Why buy messages?**
• No daily limits on purchased messages
• Messages never expire
• Instant access to Islamic guidance
• Support the development of this service

Ready to continue your Islamic learning journey?`;

        await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: processingMessage.result.message_id,
            text: rateLimitText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '⭐ Buy Messages',
                    callback_data: 'show_payment_packages'
                  },
                  {
                    text: '💬 Check Balance',
                    callback_data: 'check_balance'
                  }
                ],
                [
                  {
                    text: '🌐 Open Web App',
                    web_app: {
                      url: BASE_URL
                    }
                  }
                ]
              ]
            }
          }),
        });
      } else {
        // Regular technical error
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
      }

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