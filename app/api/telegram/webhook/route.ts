import { NextRequest, NextResponse } from 'next/server';
import { generateUUID } from '@/lib/utils';
import { createHash } from 'crypto';
import { getUserByTelegramId } from '@/lib/db/queries';
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
  return 'https://www.tauhid2.onrender.com';
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

export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    console.log('Received Telegram update:', JSON.stringify(body, null, 2));

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

${t.help.blessing}`;

      await sendMessage(chatId, helpText, 'Markdown');
      return NextResponse.json({ ok: true, message_sent: true });
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