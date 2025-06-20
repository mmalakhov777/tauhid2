import { NextRequest, NextResponse } from 'next/server';
import { generateUUID } from '@/lib/utils';
import { createHash } from 'crypto';
import { getUserByTelegramId, useTelegramBindingCode } from '@/lib/db/queries';
import { telegramAuth } from '@/app/(auth)/actions';
import { getUserLanguage, getTranslations, formatText } from '@/lib/translations';

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
  successful_payment?: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
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
  pre_checkout_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    currency: string;
    total_amount: number;
    invoice_payload: string;
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

async function sendMessageWithReplyKeyboard(chatId: number, text: string, keyboardButtons: string[][], parseMode: string = 'HTML') {
  try {
    if (TEST_MODE) {
      console.log(`[TEST MODE] Would send message with keyboard to chat ${chatId}:`, text);
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
        reply_markup: {
          keyboard: keyboardButtons,
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send message with keyboard:', errorText);
      // Fallback to regular message
      console.log('Falling back to regular message...');
      return sendMessage(chatId, text, parseMode);
    }

    return response.json();
  } catch (error) {
    console.error('Error sending message with keyboard:', error);
    // Fallback to regular message
    return sendMessage(chatId, text, parseMode);
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

// Helper function to create consistent "already linked" error message
async function createAlreadyLinkedErrorMessage(telegramUserId: number, t: any): Promise<string> {
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
    return `${t.binding.reBindingIssue}

There was an issue upgrading your temporary Telegram account to a full email account.

${t.binding.currentAccount}
${t.binding.tryingToConnect}

${t.binding.whatToTry}
${t.binding.generateNewCode}
${t.binding.codeNotExpired}
${t.binding.tryAgain}

${t.binding.ifPersists}
${t.binding.contactSupport}
${t.binding.historyPreserved}

${t.binding.needHelp}`;
  } else {
    // Regular case: real email account already linked
    return `${t.binding.alreadyLinked}



${formatText(t.binding.existingEmail, { email: existingEmail })}

${t.binding.whatYouCanDo}
${t.binding.loginWithEmail}
${t.binding.forgotPassword}
${t.binding.fullAccess}`;
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

    // Get user language and translations
    const userLanguage = getUserLanguage(callbackQuery.from.language_code);
    const t = getTranslations(userLanguage);

    // Answer the callback query to remove loading state
    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: t.callback.useBuyCommand
      }),
    });

    // For now, just direct users to use the /buy command
    await sendMessage(chatId, t.callback.purchaseInstruction, 'Markdown');

    console.log('[Telegram Bot] Callback query handled - directed to /buy command');
    return NextResponse.json({ ok: true, callback_handled: true });

  } catch (error) {
    console.error('[Telegram Bot] Callback query error:', error);
    return NextResponse.json({ ok: true, error: 'Callback handling failed' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    console.log('===== TELEGRAM WEBHOOK RECEIVED =====');
    console.log('Environment check:', {
      hasTelegramToken: !!TELEGRAM_BOT_TOKEN,
      tokenLength: TELEGRAM_BOT_TOKEN?.length,
      telegramApiUrl: TELEGRAM_API_URL,
      testMode: TEST_MODE
    });
    console.log('Full update body:', JSON.stringify(body, null, 2));
    console.log('Update type analysis:', {
      hasMessage: !!body.message,
      hasCallbackQuery: !!body.callback_query,
      hasPreCheckoutQuery: !!body.pre_checkout_query,
      hasSuccessfulPayment: !!(body.message?.successful_payment),
      messageText: body.message?.text,
      callbackData: body.callback_query?.data
    });

    // Handle callback queries (inline button presses)
    if (body.callback_query) {
      return await handleCallbackQuery(body.callback_query);
    }

    // Handle pre-checkout queries (Telegram Stars payments)
    if (body.pre_checkout_query) {
      try {
        const preCheckoutQuery = body.pre_checkout_query;
        console.log('===== PRE-CHECKOUT QUERY RECEIVED =====');
        console.log('[Telegram Bot] Pre-checkout query details:', {
          queryId: preCheckoutQuery.id,
          userId: preCheckoutQuery.from.id,
          userInfo: preCheckoutQuery.from,
          currency: preCheckoutQuery.currency,
          totalAmount: preCheckoutQuery.total_amount,
          payload: preCheckoutQuery.invoice_payload
        });

        // Parse the payload to get package information
        // Payload format: pkg_${packageIndex}_${telegramUserId}_${stars}
        const payloadParts = preCheckoutQuery.invoice_payload.split('_');
        
        if (payloadParts.length !== 4 || payloadParts[0] !== 'pkg') {
          console.error('[Telegram Bot] Invalid payload format in pre-checkout query:', preCheckoutQuery.invoice_payload);
          
          // Get user language and translations
          const userLanguage = getUserLanguage(preCheckoutQuery.from.language_code);
          const t = getTranslations(userLanguage);
          
          // Answer with error
          await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pre_checkout_query_id: preCheckoutQuery.id,
              ok: false,
              error_message: t.preCheckout.invalidPaymentData
            }),
          });
          
          return NextResponse.json({ ok: true, pre_checkout_error: true });
        }

        // Validate the payment data
        const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
        const packageIndex = parseInt(payloadParts[1]);
        const payloadTelegramUserId = parseInt(payloadParts[2]);
        const payloadStars = parseInt(payloadParts[3]);
        
        // Get user language and translations (moved up for reuse)
        const userLanguage = getUserLanguage(preCheckoutQuery.from.language_code);
        const t = getTranslations(userLanguage);
        
        // Validate user ID matches
        if (payloadTelegramUserId !== preCheckoutQuery.from.id) {
          console.error('[Telegram Bot] User ID mismatch in pre-checkout:', {
            payloadUserId: payloadTelegramUserId,
            queryUserId: preCheckoutQuery.from.id
          });
          
          await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pre_checkout_query_id: preCheckoutQuery.id,
              ok: false,
              error_message: t.preCheckout.paymentValidationFailed
            }),
          });
          
          return NextResponse.json({ ok: true, pre_checkout_error: true });
        }
        
        if (packageIndex < 0 || packageIndex >= PAYMENT_CONFIG.PACKAGES.length) {
          console.error('[Telegram Bot] Invalid package index in pre-checkout:', packageIndex);
          
          await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pre_checkout_query_id: preCheckoutQuery.id,
              ok: false,
              error_message: t.preCheckout.invalidPackageSelected
            }),
          });
          
          return NextResponse.json({ ok: true, pre_checkout_error: true });
        }

        const selectedPackage = PAYMENT_CONFIG.PACKAGES[packageIndex];
        
        // Validate amount and currency (Telegram Stars use direct amount, no multiplication)
        if (preCheckoutQuery.currency !== 'XTR' || preCheckoutQuery.total_amount !== selectedPackage.stars) {
          console.error('[Telegram Bot] Payment validation failed:', {
            expectedCurrency: 'XTR',
            receivedCurrency: preCheckoutQuery.currency,
            expectedAmount: selectedPackage.stars,
            receivedAmount: preCheckoutQuery.total_amount
          });
          
          await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pre_checkout_query_id: preCheckoutQuery.id,
              ok: false,
              error_message: t.preCheckout.paymentAmountMismatch
            }),
          });
          
          return NextResponse.json({ ok: true, pre_checkout_error: true });
        }

        // All validations passed - approve the payment
        console.log('===== APPROVING PRE-CHECKOUT QUERY =====');
        const approvalBody = {
          pre_checkout_query_id: preCheckoutQuery.id,
          ok: true
        };
        
        console.log('[Telegram Bot] Sending approval request:', {
          url: `${TELEGRAM_API_URL}/answerPreCheckoutQuery`,
          body: approvalBody
        });

        const approvalResponse = await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approvalBody),
        });

        console.log('[Telegram Bot] Approval response status:', approvalResponse.status, approvalResponse.statusText);
        const approvalResult = await approvalResponse.json();
        console.log('[Telegram Bot] Approval response body:', approvalResult);

        console.log('[Telegram Bot] Pre-checkout query approved successfully:', {
          queryId: preCheckoutQuery.id,
          userId: preCheckoutQuery.from.id,
          packageIndex,
          stars: selectedPackage.stars,
          messages: selectedPackage.messages + selectedPackage.bonus,
          approvalSuccess: approvalResult.ok
        });

        return NextResponse.json({ ok: true, pre_checkout_approved: true });

      } catch (error) {
        console.error('[Telegram Bot] Pre-checkout query error:', error);
        
        // Get user language and translations for error handling
        const userLanguage = getUserLanguage(body.pre_checkout_query.from.language_code);
        const t = getTranslations(userLanguage);
        
        // Answer with error
        await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: body.pre_checkout_query.id,
            ok: false,
            error_message: t.preCheckout.paymentProcessingError
          }),
        });
        
        return NextResponse.json({ ok: true, pre_checkout_error: true });
      }
    }

    // Check if we have a message
    if (!body.message) {
      console.log('No message found, ignoring update');
      return NextResponse.json({ ok: true });
    }

    // Handle successful payments (in message.successful_payment)
    if (body.message.successful_payment) {
      try {
        const successfulPayment = body.message.successful_payment;
        const chatId = body.message.chat.id;
        const telegramUserId = body.message.from.id;
        
        console.log('===== SUCCESSFUL PAYMENT RECEIVED =====');
        console.log('[Telegram Bot] Successful payment details:', {
          userId: telegramUserId,
          chatId,
          currency: successfulPayment.currency,
          totalAmount: successfulPayment.total_amount,
          telegramChargeId: successfulPayment.telegram_payment_charge_id,
          providerChargeId: successfulPayment.provider_payment_charge_id,
          payload: successfulPayment.invoice_payload,
          messageInfo: {
            messageId: body.message.message_id,
            date: body.message.date,
            fromUser: body.message.from
          }
        });

        // Parse the payload to get package information
        // Payload format: pkg_${packageIndex}_${telegramUserId}_${stars}
        const payloadParts = successfulPayment.invoice_payload.split('_');
        
        if (payloadParts.length !== 4 || payloadParts[0] !== 'pkg') {
          console.error('[Telegram Bot] Invalid payload format in successful payment:', successfulPayment.invoice_payload);
          await sendMessage(chatId, '❌ Payment processed but failed to add messages. Please contact support.', 'Markdown');
          return NextResponse.json({ ok: true, payment_error: true });
        }

        const packageIndex = parseInt(payloadParts[1]);
        const payloadTelegramUserId = parseInt(payloadParts[2]);
        const payloadStars = parseInt(payloadParts[3]);
        
        // Validate user ID matches
        if (payloadTelegramUserId !== telegramUserId) {
          console.error('[Telegram Bot] User ID mismatch in successful payment:', {
            payloadUserId: payloadTelegramUserId,
            actualUserId: telegramUserId
          });
          await sendMessage(chatId, '❌ Payment processed but validation failed. Please contact support.', 'Markdown');
          return NextResponse.json({ ok: true, payment_error: true });
        }

        // Get user language and translations
        const userLanguage = getUserLanguage(body.message.from.language_code);
        const t = getTranslations(userLanguage);
        
        // Find user in database
        const users = await getUserByTelegramId(telegramUserId);
        if (users.length === 0) {
          console.error('[Telegram Bot] User not found for successful payment:', telegramUserId);
          await sendMessage(chatId, t.payment.userNotFound, 'Markdown');
          return NextResponse.json({ ok: true, payment_error: true });
        }

        const dbUser = users[0];
        const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
        const selectedPackage = PAYMENT_CONFIG.PACKAGES[packageIndex];
        const totalMessages = selectedPackage.messages + selectedPackage.bonus;

        // Add paid messages to user's account
        const { addPaidMessages } = await import('@/lib/db/queries');
        await addPaidMessages(dbUser.id, totalMessages);

        // Record the payment transaction (Telegram Stars use direct amount)
        const { recordStarPayment } = await import('@/lib/db/queries');
        await recordStarPayment({
          userId: dbUser.id,
          telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
          starAmount: successfulPayment.total_amount,
          messagesAdded: totalMessages,
        });

        // Send confirmation message (Telegram Stars use direct amount)
        const starsAmount = successfulPayment.total_amount;
        const confirmationMessage = `${t.payment.successful}

${t.payment.packageLabel} ${totalMessages} Messages (${selectedPackage.messages}${selectedPackage.bonus > 0 ? ` + ${selectedPackage.bonus} bonus` : ''})
${t.payment.priceLabel} ${starsAmount} ⭐ Telegram Stars

${formatText(t.payment.messagesAdded, { totalMessages: totalMessages.toString() })}
${t.payment.neverExpire}

${t.payment.checkBalance}`;

        await sendMessage(chatId, confirmationMessage, 'Markdown');

        console.log('[Telegram Bot] Payment processed successfully:', {
          userId: telegramUserId,
          dbUserId: dbUser.id,
          messagesAdded: totalMessages,
          starsSpent: successfulPayment.total_amount,
          transactionId: successfulPayment.telegram_payment_charge_id
        });

        return NextResponse.json({ ok: true, payment_processed: true });

      } catch (error) {
        console.error('[Telegram Bot] Successful payment processing error:', error);
        const chatId = body.message.chat.id;
        // Get user language for error message
        const userLanguage = getUserLanguage(body.message.from.language_code);
        const t = getTranslations(userLanguage);
        await sendMessage(chatId, t.payment.processingFailed, 'Markdown');
        return NextResponse.json({ ok: true, payment_error: true });
      }
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

    if (userText === '/balance') {
      // Get user language and translations
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Simple balance check command
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, t.balance.userNotFound, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_error: true });
      }
      
      try {
        const { getUserMessageBalance } = await import('@/lib/db/queries');
        const balance = await getUserMessageBalance(dbUser.id);
        
        const balanceInfo = `${t.balance.title}

${formatText(t.balance.trialMessages, { count: balance.trialMessagesRemaining.toString() })}
${formatText(t.balance.paidMessages, { count: balance.paidMessagesRemaining.toString() })}
${formatText(t.balance.totalAvailable, { count: balance.totalMessagesRemaining.toString() })}

${balance.needsReset ? t.balance.willResetSoon : t.balance.isCurrent}

${balance.totalMessagesRemaining === 0 ? t.balance.noMessagesRemaining : ''}`;

        await sendMessage(chatId, balanceInfo, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_check: true });
      } catch (error) {
        console.error('[Telegram Bot] Balance command error:', error);
        await sendMessage(chatId, formatText(t.balance.checkError, { error: error instanceof Error ? error.message : 'Unknown error' }), 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, balance_error: true });
      }
    }

    if (userText === '/buy') {
      // Get user language and translations
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Show purchase options
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, t.purchase.userNotFound, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
      }

      try {
        const { PAYMENT_CONFIG, PaymentPlanHelpers } = await import('@/lib/ai/entitlements');
        
        console.log('[Telegram Bot] Processing /buy command:', {
          telegramUserId,
          chatId,
          packagesAvailable: PAYMENT_CONFIG.PACKAGES.length
        });
        
        // Create the purchase message with dynamic numbers but fixed text
        const packageList = PAYMENT_CONFIG.PACKAGES.map((pkg, index) => {
          const totalMessages = pkg.messages + pkg.bonus;
          const bonusText = pkg.bonus > 0 ? ` (${pkg.messages} + ${pkg.bonus} bonus)` : '';
          const popularText = pkg.popular ? ' (Popular)' : '';
          
          return `${pkg.emoji} **${totalMessages} Messages**${bonusText} - ${pkg.stars} ⭐${popularText}`;
        }).join('\n');

        const purchaseMessage = `${t.purchase.title}

${t.purchase.availablePackages}

${packageList}

${t.purchase.starsInfo}
${t.purchase.tapButton}
${t.purchase.neverExpire}`;

        // Create keyboard buttons with dynamic numbers
        const keyboardButtons = PAYMENT_CONFIG.PACKAGES.map((pkg, index) => {
          const totalMessages = pkg.messages + pkg.bonus;
          return [`${pkg.emoji} ${totalMessages} Messages - ${pkg.stars} ⭐`];
        });

        await sendMessageWithReplyKeyboard(chatId, purchaseMessage, keyboardButtons, 'Markdown');

        console.log('[Telegram Bot] Purchase menu with keyboard sent successfully:', {
          telegramUserId,
          chatId,
          packagesShown: PAYMENT_CONFIG.PACKAGES.length
        });

        return NextResponse.json({ ok: true, message_sent: true, purchase_menu: true });
      } catch (error) {
        console.error('[Telegram Bot] Buy command error:', error);
        await sendMessage(chatId, formatText(t.purchase.menuError, { error: error instanceof Error ? error.message : 'Unknown error' }), 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
      }
    }

    // Handle package selection (keyboard buttons or numbers)
    let packageIndex = -1;
    
    if (userText) {
      const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
      
      // Check if it's a keyboard button selection by matching the pattern
      for (let i = 0; i < PAYMENT_CONFIG.PACKAGES.length; i++) {
        const pkg = PAYMENT_CONFIG.PACKAGES[i];
        const totalMessages = pkg.messages + pkg.bonus;
        const expectedButtonText = `${pkg.emoji} ${totalMessages} Messages - ${pkg.stars} ⭐`;
        
        if (userText.trim() === expectedButtonText) {
          packageIndex = i;
          break;
        }
      }
      
      // Also support legacy number selection (1, 2, 3, 4)
      if (packageIndex === -1 && ['1', '2', '3', '4'].includes(userText.trim())) {
        packageIndex = parseInt(userText.trim()) - 1;
      }
    }
    
    if (packageIndex >= 0) {
      // Get user language and translations
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Check if user exists in database
      if (!dbUser || !dbUser.id) {
        await sendMessage(chatId, t.purchase.userNotFound, 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
      }

      try {
        const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
        
        if (packageIndex < 0 || packageIndex >= PAYMENT_CONFIG.PACKAGES.length) {
          await sendMessage(chatId, t.purchase.invalidPackage, 'Markdown');
          return NextResponse.json({ ok: true, message_sent: true, invalid_package: true });
        }

        const selectedPackage = PAYMENT_CONFIG.PACKAGES[packageIndex];
        const totalMessages = selectedPackage.messages + selectedPackage.bonus;
        const bonusText = selectedPackage.bonus > 0 ? ` (${selectedPackage.messages} + ${selectedPackage.bonus} bonus)` : '';
        
        console.log('===== CREATING TELEGRAM STARS INVOICE =====');
        console.log('[Telegram Bot] Invoice creation details:', {
          telegramUserId,
          chatId,
          packageIndex,
          totalMessages,
          stars: selectedPackage.stars,
          packageDetails: selectedPackage
        });

        // Create Telegram Stars invoice using sendInvoice
        // Payload must be 1-128 characters, so we'll use a simple format
        const invoicePayload = `pkg_${packageIndex}_${telegramUserId}_${selectedPackage.stars}`;
        
        const invoiceRequestBody = {
          chat_id: chatId,
          title: `${totalMessages} Messages${bonusText}`,
          description: `Purchase ${totalMessages} messages for your Tauhid AI chatbot. Messages never expire and stack with your daily trial messages.`,
          payload: invoicePayload,
          provider_token: '', // Empty for Telegram Stars
          currency: 'XTR', // Telegram Stars currency
          prices: [{
            label: `${totalMessages} Messages`,
            amount: selectedPackage.stars  // Telegram Stars (XTR) use direct amount, no multiplication
          }],
          start_parameter: `buy_${packageIndex}`
        };

        console.log('[Telegram Bot] Sending invoice request:', {
          url: `${TELEGRAM_API_URL}/sendInvoice`,
          body: invoiceRequestBody
        });

        const invoiceResponse = await fetch(`${TELEGRAM_API_URL}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceRequestBody),
        });

        console.log('[Telegram Bot] Invoice API response status:', invoiceResponse.status, invoiceResponse.statusText);
        console.log('[Telegram Bot] Invoice API response headers:', Object.fromEntries(invoiceResponse.headers.entries()));

        const invoiceResult = await invoiceResponse.json();
        console.log('[Telegram Bot] Invoice API response body:', invoiceResult);
        
        if (!invoiceResult.ok) {
          console.error('[Telegram Bot] Failed to create invoice:', invoiceResult);
          await sendMessage(chatId, formatText(t.purchase.invoiceCreationFailed, { error: invoiceResult.description || 'Unknown error' }), 'Markdown');
          return NextResponse.json({ ok: true, message_sent: true, invoice_error: true });
        }

        console.log('[Telegram Bot] Invoice created successfully:', {
          telegramUserId,
          chatId,
          packageIndex,
          messageId: invoiceResult.result.message_id
        });

        return NextResponse.json({ ok: true, message_sent: true, invoice_created: true });
      } catch (error) {
        console.error('[Telegram Bot] Invoice creation error:', error);
        await sendMessage(chatId, formatText(t.purchase.invoiceError, { error: error instanceof Error ? error.message : 'Unknown error' }), 'Markdown');
        return NextResponse.json({ ok: true, message_sent: true, invoice_error: true });
      }
    }

    if (userText.startsWith('/start')) {
      // Get user's language from Telegram data
      const userLanguage = getUserLanguage(message.from.language_code);
      const t = getTranslations(userLanguage);
      
      // Check if there's a start parameter
      const startParts = userText.split(' ');
      if (startParts.length > 1) {
        const startParam = startParts[1];
        
        // Handle register_XXXXXXXX parameter (binding code from registration)
        if (startParam.startsWith('register_')) {
          const bindingCode = startParam.replace('register_', '');
          
          // Validate binding code format (8 digits)
          const bindingCodePattern = /^\d{8}$/;
          if (bindingCodePattern.test(bindingCode)) {
            console.log(`[Telegram Bot] Auto-processing binding code from start parameter: ${bindingCode}`);
            
            // Show processing message
            await sendTypingAction(chatId);
            const bindingProcessingMessage = await sendMessage(
              chatId, 
              `${t.binding.checking}\n\n${t.binding.pleaseWait}`,
              'Markdown'
            );
            
            try {
              // Attempt to use the binding code
              let bindingResult;
              let bindingError = null;
              
              try {
                bindingResult = await useTelegramBindingCode(bindingCode, {
                  telegramId: telegramUserId,
                  telegramUsername: message.from.username,
                  telegramFirstName: message.from.first_name,
                  telegramLastName: undefined,
                  telegramPhotoUrl: undefined,
                  telegramLanguageCode: message.from.language_code,
                  telegramIsPremium: undefined,
                  telegramAllowsWriteToPm: undefined,
                });
                
                console.log(`[Telegram Bot] Auto-binding result:`, {
                  success: bindingResult?.success,
                  transferred: bindingResult?.transferred,
                  userId: bindingResult?.userId,
                  email: bindingResult?.email,
                  oldUserId: bindingResult?.oldUserId
                });
              } catch (error) {
                bindingError = error;
                console.log(`[Telegram Bot] Auto-binding error:`, error);
              }

              if (bindingResult?.success) {
                // Success! Account bound
                let successMessage;
                
                if (bindingResult.transferred) {
                  successMessage = `${t.binding.successUpgraded}

🎉 Your Telegram account has been successfully upgraded and connected to your email account: \`${bindingResult.email}\`

${t.binding.whatThisMeans}
${t.binding.accessHistory}
${t.binding.syncedPlatforms}
${t.binding.premiumFeatures}
${t.binding.preservedChats}

${t.binding.welcomeComplete}`;
                } else {
                  successMessage = `${t.binding.successLinked}

🎉 Your Telegram account has been successfully connected to your email account: \`${bindingResult.email}\`

${t.binding.whatThisMeans}
${t.binding.accessHistory}
${t.binding.syncedPlatforms}
${t.binding.premiumFeatures}

${t.binding.nextSteps}
${t.binding.continueHere}
${t.binding.visitWebApp}
${t.binding.fullyIntegrated}

${t.binding.welcomeComplete}`;
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
                          text: t.binding.openWebApp,
                          web_app: {
                            url: BASE_URL
                          }
                        }
                      ]]
                    }
                  }),
                });

                console.log(`[Telegram Bot] Auto-binding successful for user ${telegramUserId} to email ${bindingResult.email}`);
                
                return NextResponse.json({ 
                  ok: true, 
                  message_sent: true, 
                  auto_binding_success: true,
                  bound_email: bindingResult.email,
                  data_transferred: bindingResult.transferred || false
                });

              } else {
                // Binding failed - show detailed error based on the specific issue
                let errorMessage = `${t.binding.autoBindingFailed}

`;
                
                if (bindingError && bindingError instanceof Error) {
                  // Check both error message and cause property for specific error types
                  const errorCause = (bindingError as any)?.cause || '';
                  const isAlreadyLinked = bindingError.message.includes('already linked to another user') || 
                                        errorCause.includes('already linked to another user');
                  const isInvalidCode = bindingError.message.includes('Invalid or expired binding code');
                  
                  if (isInvalidCode) {
                    errorMessage += `${t.binding.autoBindingExpiredReason}

${t.binding.autoBindingExpiredWhat}

${t.binding.autoBindingExpiredNextSteps}`;
                  } else if (isAlreadyLinked) {
                    // Use the same consistent message as manual binding
                    errorMessage = await createAlreadyLinkedErrorMessage(telegramUserId, t);
                  } else {
                    errorMessage += `${t.binding.autoBindingTechnicalReason}

${t.binding.autoBindingTechnicalWhat}

${t.binding.autoBindingTechnicalNextSteps}

**Error details:** ${bindingError.message}`;
                  }
                } else {
                  errorMessage += `${t.binding.autoBindingUnknownReason}

${t.binding.autoBindingUnknownWhat}

${t.binding.autoBindingUnknownNextSteps}`;
                }
                
                errorMessage += `

${t.binding.manualBindingOption}

${t.binding.welcomeAnyway}`;

                // Edit the processing message with error and then send welcome
                await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: bindingProcessingMessage.result.message_id,
                    text: errorMessage,
                    parse_mode: 'Markdown'
                  }),
                });

                // Continue to welcome message after a short delay
                setTimeout(async () => {
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
                }, 2000);

                return NextResponse.json({ 
                  ok: true, 
                  message_sent: true, 
                  auto_binding_failed: true
                });
              }

            } catch (error) {
              console.error(`[Telegram Bot] Error in auto-binding:`, error);
              
              // Edit with detailed technical error and continue with welcome
              const technicalErrorMessage = `${t.binding.autoBindingFailed}

${t.binding.autoBindingTechnicalReason}

${t.binding.autoBindingTechnicalWhat}

${t.binding.autoBindingTechnicalNextSteps}

**Error details:** ${error instanceof Error ? error.message : 'Unknown error'}

${t.binding.welcomeAnyway}`;

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

              // Continue to welcome message
              setTimeout(async () => {
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
              }, 2000);

              return NextResponse.json({ 
                ok: true, 
                message_sent: true, 
                auto_binding_error: true
              });
            }
          } else {
            // Invalid binding code format from registration URL
            console.log(`[Telegram Bot] Invalid binding code format from registration: ${bindingCode}`);
            
            const invalidFormatMessage = `${t.binding.autoBindingFailed}

${t.binding.autoBindingInvalidFormatReason}

${t.binding.autoBindingInvalidFormatWhat}
• The code received was: "${bindingCode}"

${t.binding.autoBindingInvalidFormatNextSteps}

${t.binding.welcomeAnyway}`;

            await sendMessage(chatId, invalidFormatMessage, 'Markdown');
            
            // Continue to welcome message after a short delay
            setTimeout(async () => {
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
            }, 2000);

            return NextResponse.json({ 
              ok: true, 
              message_sent: true, 
              auto_binding_invalid_format: true,
              invalid_code: bindingCode
            });
          }
        }
        
        // Handle buy parameter (/start buy)
        if (startParam === 'buy') {
          console.log(`[Telegram Bot] Processing /start buy parameter for user ${telegramUserId}`);
          
          // Check if user exists in database
          if (!dbUser || !dbUser.id) {
            await sendMessage(chatId, t.purchase.userNotFound, 'Markdown');
            return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
          }

          try {
            const { PAYMENT_CONFIG } = await import('@/lib/ai/entitlements');
            
            console.log('[Telegram Bot] Processing /start buy command:', {
              telegramUserId,
              chatId,
              packagesAvailable: PAYMENT_CONFIG.PACKAGES.length
            });
            
            // Create the purchase message with dynamic numbers but fixed text
            const packageList = PAYMENT_CONFIG.PACKAGES.map((pkg, index) => {
              const totalMessages = pkg.messages + pkg.bonus;
              const bonusText = pkg.bonus > 0 ? ` (${pkg.messages} + ${pkg.bonus} bonus)` : '';
              const popularText = pkg.popular ? ' (Popular)' : '';
              
              return `${pkg.emoji} **${totalMessages} Messages**${bonusText} - ${pkg.stars} ⭐${popularText}`;
            }).join('\n');

            const purchaseMessage = `${t.purchase.title}

${t.purchase.availablePackages}

${packageList}

${t.purchase.starsInfo}
${t.purchase.tapButton}
${t.purchase.neverExpire}`;

            // Create keyboard buttons with dynamic numbers
            const keyboardButtons = PAYMENT_CONFIG.PACKAGES.map((pkg, index) => {
              const totalMessages = pkg.messages + pkg.bonus;
              return [`${pkg.emoji} ${totalMessages} Messages - ${pkg.stars} ⭐`];
            });

            await sendMessageWithReplyKeyboard(chatId, purchaseMessage, keyboardButtons, 'Markdown');

            console.log('[Telegram Bot] Purchase menu with keyboard sent successfully from /start buy:', {
              telegramUserId,
              chatId,
              packagesShown: PAYMENT_CONFIG.PACKAGES.length
            });

            return NextResponse.json({ ok: true, message_sent: true, purchase_menu: true, from_start_buy: true });
          } catch (error) {
            console.error('[Telegram Bot] /start buy command error:', error);
            await sendMessage(chatId, formatText(t.purchase.menuError, { error: error instanceof Error ? error.message : 'Unknown error' }), 'Markdown');
            return NextResponse.json({ ok: true, message_sent: true, purchase_error: true });
          }
        }
      }
      
      // Default welcome message (no start parameter or invalid binding code)
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
• ${t.help.buyCommand}
• ${t.help.balanceCommand}

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
        `${t.binding.checking}\n\n${t.binding.pleaseWait}`,
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
              successMessage = `${t.binding.successUpgraded}

🎉 Your Telegram account has been successfully upgraded and connected to your email account: \`${bindingResult.email}\`

${t.binding.whatThisMeans}
${t.binding.accessHistory}
${t.binding.syncedPlatforms}
${t.binding.premiumFeatures}
${t.binding.preservedChats}

${t.binding.welcomeComplete}`;
          } else {
            // Standard binding message
            successMessage = `${t.binding.successLinked}

🎉 Your Telegram account has been successfully connected to your email account: \`${bindingResult.email}\`

${t.binding.whatThisMeans}
${t.binding.accessHistory}
${t.binding.syncedPlatforms}
${t.binding.premiumFeatures}

${t.binding.nextSteps}
${t.binding.continueHere}
${t.binding.visitWebApp}
${t.binding.fullyIntegrated}

${t.binding.welcomeComplete}`;
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
                    text: t.binding.openWebApp,
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
            // Use the same consistent message as auto-binding
            errorMessage = await createAlreadyLinkedErrorMessage(telegramUserId, t);
          } else {
            // Generic error for invalid/expired codes
            errorMessage = `${t.binding.invalidCode}

${formatText(t.binding.notValidExpired, { code: userText })}

${t.binding.possibleReasons}
${t.binding.codeExpired}
${t.binding.alreadyUsed}
${t.binding.typedIncorrectly}

${t.binding.getNewCode}
${t.binding.goToWebApp}
${t.binding.clickConnect}
${t.binding.copyCode}
${t.binding.sendWithin}

${t.binding.needHelp}`;
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
                    text: t.binding.openWebApp,
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
        const technicalErrorMessage = `${t.binding.technicalError}

${t.binding.technicalIssue}

${t.binding.tryAgainMoments}

${t.binding.problemPersists}`;

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

    // Proactive balance check before processing message
    if (dbUser && dbUser.id) {
      try {
        const { getUserMessageBalance } = await import('@/lib/db/queries');
        const balance = await getUserMessageBalance(dbUser.id);
        
        console.log('[Telegram Bot] Proactive balance check:', {
          userId: dbUser.id,
          trialRemaining: balance.trialMessagesRemaining,
          paidRemaining: balance.paidMessagesRemaining,
          totalRemaining: balance.totalMessagesRemaining,
          needsReset: balance.needsReset
        });
        
        if (balance.totalMessagesRemaining === 0) {
          console.log('[Telegram Bot] User has no messages remaining, showing warning');
          await sendMessage(chatId, t.balance.noMessagesRemaining, 'Markdown');
          return NextResponse.json({ 
            ok: true, 
            message_sent: true, 
            no_messages_remaining: true,
            debug: {
              telegramUserId,
              userName,
              dbUserId: dbUser.id,
              balance: balance
            }
          });
        }
      } catch (balanceError) {
        console.error('[Telegram Bot] Error checking balance before processing:', balanceError);
        // Continue processing even if balance check fails
      }
    }

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
    console.error('===== TELEGRAM WEBHOOK ERROR =====');
    console.error('Error processing Telegram webhook:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      cause: (error as any)?.cause
    });
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
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