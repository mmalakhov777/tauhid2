import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
  saveVectorSearchResult,
  testDatabaseConnection,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment, isVectorSearchEnabled } from '@/lib/constants';
import { myProvider, fallbackProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';
import {
  performVectorSearch,
  performVectorSearchWithProgress,
  buildConversationHistory,
  getContextByMessageId,
  messageContextMap,
  buildContextBlock,
} from '@/lib/ai/vector-search';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      // Check if Redis URL is properly configured
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl || redisUrl === '****' || redisUrl.trim() === '') {
        return null;
      }
      
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL') || error.code === 'ERR_INVALID_URL') {
        return null;
      } else {
        console.error('Error creating resumable stream context:', error);
        return null;
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  // Test database connection first (skip during build)
  if (process.env.NODE_ENV !== 'production' || process.env.RAILWAY_ENVIRONMENT) {
    try {
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        console.error('[chat route] Database connection test failed');
        return new ChatSDKError('bad_request:database', 'Database connection failed').toResponse();
      }
    } catch (error) {
      console.warn('[chat route] Database connection test skipped during build:', error);
    }
  }

  // Check if this is a vector search request
  const url = new URL(request.url);
  const isVectorSearchRequest = url.searchParams.get('vector') === '1';
  const isStreamRequest = url.searchParams.get('stream') === '1';

  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType, selectedLanguage, selectedSources } =
      requestBody;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return new ChatSDKError('bad_request:api', 'Invalid chat ID format').toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    // NEW: Use trial balance system instead of legacy message counting
    const entitlements = entitlementsByUserType[userType];
    
    if (entitlements.useTrialBalance) {
      // Import the new balance functions
      const { consumeUserMessage } = await import('@/lib/db/queries');
      
      // Try to consume a message from user's balance
      const consumeResult = await consumeUserMessage(session.user.id);
      
      if (!consumeResult.success) {
        // User has no messages left - return rate limit error
        return new ChatSDKError('rate_limit:chat').toResponse();
      }
      
      console.log(`[Chat API] User ${session.user.id} consumed message. Remaining: ${consumeResult.remainingMessages}, Used trial: ${consumeResult.usedTrial}`);
    } else {
      // LEGACY: Fall back to old message counting system
      const messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 24,
      });

      if (messageCount > entitlements.maxMessagesPerDay) {
        return new ChatSDKError('rate_limit:chat').toResponse();
      }
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      try {
        await saveChat({
          id,
          userId: session.user.id,
          title,
          visibility: selectedVisibilityType,
        });
      } catch (saveChatError) {
        throw saveChatError;
      }
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    // Extract user message content
    let userMessageContent = '';
    if (message.parts && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (part.type === 'text' && part.text) {
          userMessageContent += part.text;
        }
      }
    } else if (message.content) {
      userMessageContent = message.content;
    }

    // Handle vector search request
    if (isVectorSearchRequest && !isStreamRequest) {
      // Step 1: Return citations and messageId only
      const conversationHistory = buildConversationHistory(messages);
      // Extract text content from message parts
      let userMessageContent = '';
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'text' && part.text) {
            userMessageContent += part.text;
          }
        }
      } else if (message.content) {
        userMessageContent = message.content;
      }
      
      const searchResults = await performVectorSearch(
        userMessageContent,
        conversationHistory,
        selectedChatModel,
        selectedSources
      );

      // Filter out citations with minimal metadata before sending to frontend
      const filteredCitations = searchResults.citations.filter((c: any) => {
        // Check for classic sources with only answer/question/text
        if (!c.namespace && c.metadata) {
          const metadataKeys = Object.keys(c.metadata);
          const specificKeys = ['answer', 'question', 'text'];
          const hasExactlySpecificKeys =
              metadataKeys.length === specificKeys.length &&
              specificKeys.every(key => metadataKeys.includes(key));
          
          if (hasExactlySpecificKeys) {
            return false;
          }
        }
        return true;
      });

      return new Response(
        JSON.stringify({
          messageId: searchResults.messageId,
          citations: filteredCitations, // Use filtered citations
          improvedQueries: searchResults.improvedQueries,
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Save user message immediately as before
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: message.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Get messageId from request body for vector search context
    let messageId = (requestBody as any).messageId;
    let contextBlock = '';
    let modifiedSystemPrompt = systemPrompt({ selectedChatModel, requestHints });
    let vectorSearchProgressUpdates: any[] = [];

    // Add language instruction to system prompt
    const languageNames: { [key: string]: string } = {
      'en': 'English',
      'tr': 'Turkish',
      'ar': 'Arabic',
      'ru': 'Russian',
      'de': 'German',
      'fr': 'French',
      'es': 'Spanish',
    };

    const languageName = languageNames[selectedLanguage || 'en'] || 'English';
    
    // STRICT language instruction that forces responses in selected language
    let languageInstruction = '';
    if (selectedLanguage && selectedLanguage !== 'en') {
      languageInstruction = `\n\n🔴 CRITICAL LANGUAGE REQUIREMENT 🔴
MANDATORY: You MUST respond ONLY in ${languageName}. This is NON-NEGOTIABLE.

STRICT LANGUAGE RULES:
- Your ENTIRE response must be written in ${languageName}
- Do NOT mix languages - use ONLY ${languageName}
- Do NOT respond in English, Arabic, or any other language
- Even if the user asks in English, you MUST answer in ${languageName}
- All explanations, disclaimers, and content must be in ${languageName}
- This language requirement overrides all other instructions

VIOLATION CONSEQUENCES:
- Responding in any language other than ${languageName} is strictly forbidden
- The user has specifically chosen ${languageName} as their preferred language
- Ignoring this instruction will result in an unsatisfactory response

REMEMBER: ${languageName} ONLY - NO EXCEPTIONS!`;
    }
    
    modifiedSystemPrompt = modifiedSystemPrompt + languageInstruction;

    // Automatically perform vector search if enabled and no messageId provided
    if (isVectorSearchEnabled && !messageId) {
      
      const conversationHistory = buildConversationHistory(messages);
      // Extract text content from message parts
      let userMessageContent = '';
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'text' && part.text) {
            userMessageContent += part.text;
          }
        }
      } else if (message.content) {
        userMessageContent = message.content;
      }
      
      const searchStartTime = Date.now();
      
      try {
        const searchResults = await performVectorSearchWithProgress(
          userMessageContent,
          conversationHistory,
          selectedChatModel,
          selectedSources,
          (progress) => {
            vectorSearchProgressUpdates.push(progress);
          }
        );
        messageId = searchResults.messageId;
        
        // Calculate search duration
        const searchDurationMs = Date.now() - searchStartTime;
        
        // Filter out citations with minimal metadata before sending to frontend
        const filteredCitations = searchResults.citations.filter((c: any) => {
          // Check for classic sources with only answer/question/text
          if (!c.namespace && c.metadata) {
            const metadataKeys = Object.keys(c.metadata);
            const specificKeys = ['answer', 'question', 'text'];
            const hasExactlySpecificKeys =
                metadataKeys.length === specificKeys.length &&
                specificKeys.every(key => metadataKeys.includes(key));
            
            if (hasExactlySpecificKeys) {
              return false;
            }
          }
          return true;
        });
        
        // IMPORTANT: Store the filtered citations in messageContextMap for later use
        messageContextMap.set(messageId, filteredCitations);
        
        // Store search results for later saving to database
        const searchResultCounts = {
          classic: filteredCitations.filter((c: any) => c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)).length,
          modern: filteredCitations.filter((c: any) => c.metadata?.type === 'modern' || c.metadata?.type === 'MOD').length,
          risale: filteredCitations.filter((c: any) => c.metadata?.type === 'risale' || c.metadata?.type === 'RIS' || (c.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(c.namespace))).length,
          youtube: filteredCitations.filter((c: any) => c.metadata?.type === 'youtube' || c.metadata?.type === 'YT' || (c.namespace && ['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance', '2004', 'MercifulServant', '1572', 'Towards_Eternity'].includes(c.namespace))).length,
          fatwa: filteredCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT').length
        };
        
        // Store vector search data to save after assistant message is created
        (globalThis as any).__vectorSearchDataToSave = {
          chatId: id,
          improvedQueries: searchResults.improvedQueries,
          citations: filteredCitations, // Use filtered citations
          searchResultCounts,
          searchDurationMs,
        };
        
        // Add the final update with filtered citations
        vectorSearchProgressUpdates.push({
          step: 4, // Final step with all data
          improvedQueries: searchResults.improvedQueries,
          searchResults: searchResultCounts,
          citations: filteredCitations // Use filtered citations
        });
      } catch (error) {
        // Continue without vector search on error
      }
    }

    if (messageId && messageContextMap.has(messageId)) {
      // Build context block from stored citations
      const allContexts = getContextByMessageId(messageId);
      
      const classicContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'classic' || ctx.metadata?.type === 'CLS' || (!ctx.metadata?.type && !ctx.namespace));
      const modernContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'modern' || ctx.metadata?.type === 'MOD');
      const risaleContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'risale' || ctx.metadata?.type === 'RIS' || (ctx.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(ctx.namespace)));
      const youtubeContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'youtube' || ctx.metadata?.type === 'YT' || (ctx.namespace && ['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance', '2004', 'MercifulServant', '1572', 'Towards_Eternity'].includes(ctx.namespace)));
      const fatwaContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'fatwa' || ctx.metadata?.type === 'FAT');
      
      const totalCitations = classicContexts.length + modernContexts.length + risaleContexts.length + youtubeContexts.length + fatwaContexts.length;
      
            if (totalCitations === 0) {
        
        // Use a system prompt that forces the exact fixed response
        const fixedResponsePrompt = `You must respond with exactly this message and nothing else: "Sorry I do not have enough information to provide grounded response"

Do not add any additional text, explanations, or formatting. Just return that exact message.`;
        
        modifiedSystemPrompt = fixedResponsePrompt;
      } else {
        // Use the existing citation-based prompt
        contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts);

        // Add STRONG emphasis on using ALL citations when context is available
        const citationEmphasis = `

CRITICAL CITATION REQUIREMENTS:
- You MUST use ALL available citations provided in the context
- The MORE different [CIT] numbers you use in your response, the BETTER your answer will be
- NEVER leave any citation unused - every [CIT1], [CIT2], [CIT3], etc. should appear in your response
- If you have 10 citations available, use ALL 10 citations in your answer
- Distribute citations throughout your response - don't just use them at the end
- When multiple citations support the same point, list them all: [CIT1], [CIT2], [CIT3]
- Your goal is to create the most comprehensive answer possible using EVERY available source
- An answer that uses 8 citations is better than one that uses 4 citations
- An answer that uses ALL available citations is the best possible answer
- Add [CIT] references DIRECTLY after statements - do NOT use phrases like "as detailed in", "as emphasized in", "according to", etc.
- Simply place [CIT1], [CIT2] immediately after the relevant information
- Example: "Prayer is fundamental [CIT1], [CIT2]. It purifies the soul [CIT3]."
- Do NOT write: "Prayer is fundamental as detailed in [CIT1]" or "according to [CIT2]"

CONTEXT-AWARE RESPONSES:
- If this is a follow-up question, consider the ENTIRE conversation history
- Citations may relate to both the current question AND previous topics discussed
- Use citations that connect the current question to earlier parts of the conversation
- When answering "Can you explain more?" or similar follow-ups, refer back to what was discussed and expand using ALL available citations

REMEMBER: More citations = Better answer. Use them ALL! Add [CIT] directly without connecting phrases.`;

        // Append context block and citation emphasis to system prompt
        modifiedSystemPrompt = modifiedSystemPrompt + '\n\n' + contextBlock + citationEmphasis;
      }
    } else {
      
      // Use a system prompt that forces the exact fixed response
      const fixedResponsePrompt = `You must respond with exactly this message and nothing else: "Sorry I do not have enough information to provide grounded response"

Do not add any additional text, explanations, or formatting. Just return that exact message.`;
      
      modifiedSystemPrompt = fixedResponsePrompt;
    }

    const stream = createDataStream({
      execute: async (buffer) => {
        // Send all vector search progress updates first
        if (vectorSearchProgressUpdates.length > 0) {
          for (let i = 0; i < vectorSearchProgressUpdates.length; i++) {
            const progress = vectorSearchProgressUpdates[i];
            buffer.writeData({
              type: 'vector-search-progress',
              progress: JSON.stringify(progress)
            });
          }
        }

        try {
          let result;
          try {

            result = streamText({
              model: myProvider.languageModel(selectedChatModel),
              system: modifiedSystemPrompt,
              messages: messages,
              maxSteps: 5,
              experimental_activeTools:
                selectedChatModel === 'chat-model-reasoning'
                  ? []
                  : [
                      'getWeather',
                    ],
              experimental_transform: smoothStream({ chunking: 'word' }),
              experimental_generateMessageId: generateUUID,
              tools: {
                getWeather,
              },
              onFinish: async ({ response }) => {
                // Only save assistant message after streaming completes successfully
                if (session.user?.id) {
                  try {
                    const assistantId = getTrailingMessageId({
                      messages: response.messages.filter(
                        (message) => message.role === 'assistant',
                      ),
                    });

                    if (!assistantId) {
                      console.error('No assistant message found in response');
                      return;
                    }

                    const [, assistantMessage] = appendResponseMessages({
                      messages: [message],
                      responseMessages: response.messages,
                    });

                    // Save only the assistant message (user message already saved)
                    await saveMessages({
                      messages: [
                        {
                          id: assistantId,
                          chatId: id,
                          role: assistantMessage.role,
                          parts: assistantMessage.parts,
                          attachments:
                            assistantMessage.experimental_attachments ?? [],
                          createdAt: new Date(),
                        },
                      ],
                    });
                    
                    // Save vector search results if available
                    const vectorSearchData = (globalThis as any).__vectorSearchDataToSave;
                    if (vectorSearchData) {
                      try {
                        await saveVectorSearchResult({
                          messageId: assistantId,
                          ...vectorSearchData,
                        });
                        // Clean up
                        delete (globalThis as any).__vectorSearchDataToSave;
                      } catch (error) {
                        console.error('Failed to save vector search results:', error);
                      }
                    }
                  } catch (error) {
                    console.error('Failed to save assistant message:', error);
                  }
                }
              },
              experimental_telemetry: {
                isEnabled: isProductionEnvironment,
                functionId: 'stream-text',
              },
            });
          } catch (primaryError) {
            console.warn('Primary provider failed, trying fallback provider:', primaryError);
            result = streamText({
              model: fallbackProvider.languageModel(selectedChatModel),
              system: modifiedSystemPrompt,
              messages: messages,
              maxSteps: 5,
              experimental_activeTools:
                selectedChatModel === 'chat-model-reasoning'
                  ? []
                  : [
                      'getWeather',
                    ],
              experimental_transform: smoothStream({ chunking: 'word' }),
              experimental_generateMessageId: generateUUID,
              tools: {
                getWeather,
              },
              onFinish: async ({ response }) => {
                // Only save assistant message after streaming completes successfully
                if (session.user?.id) {
                  try {
                    const assistantId = getTrailingMessageId({
                      messages: response.messages.filter(
                        (message) => message.role === 'assistant',
                      ),
                    });

                    if (!assistantId) {
                      console.error('No assistant message found in response');
                      return;
                    }

                    const [, assistantMessage] = appendResponseMessages({
                      messages: [message],
                      responseMessages: response.messages,
                    });

                    // Save only the assistant message (user message already saved)
                    await saveMessages({
                      messages: [
                        {
                          id: assistantId,
                          chatId: id,
                          role: assistantMessage.role,
                          parts: assistantMessage.parts,
                          attachments:
                            assistantMessage.experimental_attachments ?? [],
                          createdAt: new Date(),
                        },
                      ],
                    });
                    
                    // Save vector search results if available
                    const vectorSearchData = (globalThis as any).__vectorSearchDataToSave;
                    if (vectorSearchData) {
                      try {
                        await saveVectorSearchResult({
                          messageId: assistantId,
                          ...vectorSearchData,
                        });
                        // Clean up
                        delete (globalThis as any).__vectorSearchDataToSave;
                      } catch (error) {
                        console.error('Failed to save vector search results:', error);
                      }
                    }
                  } catch (error) {
                    console.error('Failed to save assistant message:', error);
                  }
                }
              },
              experimental_telemetry: {
                isEnabled: isProductionEnvironment,
                functionId: 'stream-text-fallback',
              },
            });
          }

          result.consumeStream();

          result.mergeIntoDataStream(buffer, {
            sendReasoning: true,
          });
        } catch (error) {
          console.error('Error in streamText execution:', error);
          throw error;
        }
      },
      onError: (error) => {
        console.error('DataStream error:', error);
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    // Add custom headers if using vector search
    const headers: Record<string, string> = {};
    if (messageId) {
      headers['x-message-id'] = messageId;
    }

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
        { headers }
      );
    } else {
      return new Response(stream, { headers });
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    // Handle any other errors
    console.error('Unexpected error in chat API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const messageId = searchParams.get('messageId');

  // Handle messageId request for vector search context
  if (messageId) {
    const citations = getContextByMessageId(messageId);
    return new Response(
      JSON.stringify({ citations }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: 'append-message',
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
