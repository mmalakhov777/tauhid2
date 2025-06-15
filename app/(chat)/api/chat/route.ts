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
import { Langfuse } from "langfuse";

// Initialize Langfuse
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"
});

// Helper function for non-blocking Langfuse operations
const safeTrace = (operation: () => void) => {
  try {
    operation();
  } catch (error) {
    // Silently ignore tracing errors to not affect performance
    console.debug('[langfuse] Tracing error:', error);
  }
};

// Helper function to flush traces
const flushTrace = async (trace: any) => {
  try {
    await langfuse.flushAsync();
    console.log('[langfuse] Trace flushed successfully');
  } catch (error) {
    console.debug('[langfuse] Flush error:', error);
  }
};

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
  const startTime = Date.now();
  
  // Create main trace for the entire chat request
  const mainTrace = langfuse.trace({
    name: "chat-request",
    input: { 
      url: request.url,
      method: request.method,
      headers: {
        'content-type': request.headers.get('content-type'),
        'user-agent': request.headers.get('user-agent')?.substring(0, 100),
        'accept': request.headers.get('accept'),
        'origin': request.headers.get('origin')
      }
    },
    metadata: { 
      timestamp: new Date().toISOString(),
      requestStartTime: startTime,
      environment: process.env.NODE_ENV,
      deployment: process.env.VERCEL_ENV || 'local'
    }
  });

  console.log('[langfuse] Created main trace for chat-request:', mainTrace.id);

  // Test database connection first (skip during build)
  if (process.env.NODE_ENV !== 'production' || process.env.RAILWAY_ENVIRONMENT) {
    const dbSpan = mainTrace.span({
      name: "database-connection-test",
      input: { environment: process.env.NODE_ENV }
    });

    try {
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        console.error('[chat route] Database connection test failed');
        safeTrace(() => dbSpan.update({ 
          output: { error: "Database connection failed", connected: false }
        }));
        safeTrace(() => mainTrace.update({ 
          output: { error: "Database connection failed" }
        }));
        return new ChatSDKError('bad_request:database', 'Database connection failed').toResponse();
      }
      safeTrace(() => dbSpan.update({ 
        output: { connected: true, success: true }
      }));
    } catch (error) {
      console.warn('[chat route] Database connection test skipped during build:', error);
      safeTrace(() => dbSpan.update({ 
        output: { skipped: true, reason: "build-time" }
      }));
    }
  }

  // Check if this is a vector search request
  const url = new URL(request.url);
  const isVectorSearchRequest = url.searchParams.get('vector') === '1';
  const isStreamRequest = url.searchParams.get('stream') === '1';

  safeTrace(() => mainTrace.update({ 
    metadata: { 
      isVectorSearchRequest,
      isStreamRequest,
      timestamp: new Date().toISOString()
    }
  }));

  let requestBody: PostRequestBody;

  const parseSpan = mainTrace.span({
    name: "parse-request-body",
    input: { hasBody: true }
  });

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
    safeTrace(() => parseSpan.update({ 
      output: { 
        success: true,
        hasMessage: !!requestBody.message,
        selectedChatModel: requestBody.selectedChatModel
      }
    }));
  } catch (error) {
    safeTrace(() => parseSpan.update({ 
      output: { error: "Invalid request body", success: false }
    }));
    safeTrace(() => mainTrace.update({ 
      output: { error: "Invalid request body" }
    }));
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

    const authStartTime = Date.now();
    const authSpan = mainTrace.span({
      name: "authentication",
      startTime: new Date(authStartTime),
      input: { 
        chatId: id,
        requestedAt: new Date().toISOString()
      }
    });

    const session = await auth();

    if (!session?.user) {
      safeTrace(() => authSpan.update({ 
        endTime: new Date(),
        output: { 
          authenticated: false, 
          error: "No session"
        }
      }));
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;
    safeTrace(() => authSpan.update({ 
      endTime: new Date(),
      output: { 
        authenticated: true, 
        userId: session.user.id,
        userType: userType,
        userEmail: session.user.email?.substring(0, 20) + '...'
      }
    }));

    // Add comprehensive request details to main trace
    const messageLength = typeof message.content === 'string' ? message.content.length : 
                         message.parts ? message.parts.reduce((acc: number, part: any) => 
                           acc + (part.text?.length || 0), 0) : 0;
    
    safeTrace(() => mainTrace.update({
      userId: session.user.id,
      metadata: {
        userType,
        userEmail: session.user.email?.substring(0, 20) + '...',
        chatId: id,
        selectedChatModel,
        selectedVisibilityType,
        selectedLanguage,
        selectedSources: selectedSources ? Object.entries(selectedSources).filter(([_, enabled]) => enabled).map(([source, _]) => source).join(',') || 'all' : 'all',
        messageLength,
        hasAttachments: !!(message.experimental_attachments?.length),
        attachmentCount: message.experimental_attachments?.length || 0,
        requestProcessingTime: Date.now() - startTime
      }
    }));

    // NEW: Use trial balance system instead of legacy message counting
    const entitlements = entitlementsByUserType[userType];
    
    const rateLimitStartTime = Date.now();
    const rateLimitSpan = mainTrace.span({
      name: "rate-limit-check",
      startTime: new Date(rateLimitStartTime),
      input: { 
        userType, 
        useTrialBalance: entitlements.useTrialBalance,
        maxMessagesPerDay: entitlements.maxMessagesPerDay,
        trialMessagesPerDay: entitlements.trialMessagesPerDay
      }
    });

    // Store consumption info for potential refund
    let messageConsumed = false;
    let usedTrialForRefund = false;

    if (entitlements.useTrialBalance) {
      // Import the new balance functions
      const { consumeUserMessage, getUserMessageBalance } = await import('@/lib/db/queries');
      
      // Get current balance before consuming
      const currentBalance = await getUserMessageBalance(session.user.id);
      
      // Try to consume a message from user's balance
      const consumeResult = await consumeUserMessage(session.user.id);
      
      if (!consumeResult.success) {
        // User has no messages left - return rate limit error
        safeTrace(() => rateLimitSpan.update({ 
          endTime: new Date(),
          output: { 
            rateLimited: true, 
            remainingMessages: 0,
            reason: "No messages left",
            balanceBeforeConsume: {
              trialMessagesRemaining: currentBalance.trialMessagesRemaining,
              paidMessagesRemaining: currentBalance.paidMessagesRemaining,
              totalMessagesRemaining: currentBalance.totalMessagesRemaining,
              needsReset: currentBalance.needsReset
            },
            entitlements: {
              trialMessagesPerDay: entitlements.trialMessagesPerDay,
              useTrialBalance: entitlements.useTrialBalance
            }
          }
        }));
        return new ChatSDKError('rate_limit:chat').toResponse();
      }
      
      // Store consumption info for potential refund
      messageConsumed = true;
      usedTrialForRefund = consumeResult.usedTrial;
      
      console.log(`[Chat API] User ${session.user.id} consumed message. Remaining: ${consumeResult.remainingMessages}, Used trial: ${consumeResult.usedTrial}`);
      safeTrace(() => rateLimitSpan.update({ 
        endTime: new Date(),
        output: { 
          rateLimited: false,
          remainingMessages: consumeResult.remainingMessages,
          usedTrial: consumeResult.usedTrial,
          balanceBeforeConsume: {
            trialMessagesRemaining: currentBalance.trialMessagesRemaining,
            paidMessagesRemaining: currentBalance.paidMessagesRemaining,
            totalMessagesRemaining: currentBalance.totalMessagesRemaining,
            needsReset: currentBalance.needsReset
          },
          balanceAfterConsume: {
            remainingMessages: consumeResult.remainingMessages,
            messageType: consumeResult.usedTrial ? 'trial' : 'paid'
          },
          entitlements: {
            trialMessagesPerDay: entitlements.trialMessagesPerDay,
            useTrialBalance: entitlements.useTrialBalance
          }
        }
      }));
    } else {
      // LEGACY: Fall back to old message counting system
      const messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 24,
      });

      if (messageCount > entitlements.maxMessagesPerDay) {
        safeTrace(() => rateLimitSpan.update({ 
          output: { 
            rateLimited: true,
            messageCount,
            maxMessages: entitlements.maxMessagesPerDay,
            system: 'legacy',
            duration: Date.now() - startTime
          }
        }));
        return new ChatSDKError('rate_limit:chat').toResponse();
      }
      
      safeTrace(() => rateLimitSpan.update({ 
        output: { 
          rateLimited: false,
          messageCount,
          maxMessages: entitlements.maxMessagesPerDay,
          system: 'legacy',
          duration: Date.now() - startTime
        }
      }));
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
      const vectorSearchStartTime = Date.now();
      const vectorSearchSpan = mainTrace.span({
        name: "vector-search-only",
        input: { 
          userMessage: userMessageContent.substring(0, 200) + (userMessageContent.length > 200 ? '...' : ''),
          userMessageLength: userMessageContent.length,
          selectedSources: selectedSources || ['all'],
          selectedChatModel,
          conversationLength: messages.length,
          searchStartTime: vectorSearchStartTime
        }
      });

      // Step 1: Return citations and messageId only
      const conversationHistory = buildConversationHistory(messages);
      
      const searchResults = await performVectorSearch(
        userMessageContent,
        conversationHistory,
        selectedChatModel,
        selectedSources,
        mainTrace // Pass main trace instead of creating new one
      );

      // Filter out citations with minimal metadata before sending to frontend
      const filteredCitations = searchResults.citations.filter((c: any) => {
        // IMPORTANT: Allow fatwa citations to pass through FIRST (regardless of namespace)
        if (c.metadata && (c.metadata.content_type === 'islamqa_fatwa' || 
            c.metadata.type === 'fatwa' || 
            c.metadata.type === 'FAT' ||
            c.metadata.source_link || 
            c.metadata.url)) {
          return true; // Keep fatwa citations
        }
        
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

      // Analyze citation sources
      const citationAnalysis = {
        classic: filteredCitations.filter((c: any) => c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)).length,
        modern: filteredCitations.filter((c: any) => c.metadata?.type === 'modern' || c.metadata?.type === 'MOD').length,
        risale: filteredCitations.filter((c: any) => c.metadata?.type === 'risale' || c.metadata?.type === 'RIS' || (c.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi'].includes(c.namespace))).length,
        youtube: filteredCitations.filter((c: any) => c.metadata?.type === 'youtube' || c.metadata?.type === 'YT' || (c.namespace && ['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance'].includes(c.namespace))).length,
        fatwa: filteredCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT' || c.metadata?.content_type === 'islamqa_fatwa').length
      };

      const searchDuration = Date.now() - vectorSearchStartTime;

      safeTrace(() => vectorSearchSpan.update({ 
        output: { 
          messageId: searchResults.messageId,
          citationsCount: filteredCitations.length,
          citationsBySource: citationAnalysis,
          improvedQueriesCount: searchResults.improvedQueries.length,
          improvedQueries: searchResults.improvedQueries,
          searchDurationMs: searchDuration,
          averageCitationScore: filteredCitations.length > 0 ? 
            filteredCitations.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / filteredCitations.length : 0,
          topCitationScore: filteredCitations.length > 0 ? 
            Math.max(...filteredCitations.map((c: any) => c.score || 0)) : 0,
          conversationHistoryLength: conversationHistory.length,
          filteredOutCount: searchResults.citations.length - filteredCitations.length
        }
      }));

      const vectorSearchEndTime = Date.now();
      const vectorSearchTotalDuration = vectorSearchEndTime - startTime;
      
      safeTrace(() => mainTrace.update({ 
        output: { 
          success: true,
          type: "vector-search-only",
          messageId: searchResults.messageId,
          citationsCount: filteredCitations.length,
          citationsBySource: citationAnalysis,
          searchDurationMs: searchDuration,
          totalDurationMs: vectorSearchTotalDuration,
          endTime: vectorSearchEndTime,
          endTimestamp: new Date(vectorSearchEndTime).toISOString(),
          latencyMs: vectorSearchTotalDuration,
          durationMs: vectorSearchTotalDuration,
          // Timing summary for vector search only trace
          timing: {
            startTime: startTime,
            endTime: vectorSearchEndTime,
            durationMs: vectorSearchTotalDuration,
            latencyMs: vectorSearchTotalDuration,
            startTimestamp: new Date(startTime).toISOString(),
            endTimestamp: new Date(vectorSearchEndTime).toISOString()
          }
        }
      }));

      // Flush the trace to ensure it's sent to Langfuse
      await flushTrace(mainTrace);

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
          },
          mainTrace // Pass main trace instead of creating new one
        );
        messageId = searchResults.messageId;
        
        // Calculate search duration
        const searchDurationMs = Date.now() - searchStartTime;
        
        // Filter out citations with minimal metadata before sending to frontend
        const filteredCitations = searchResults.citations.filter((c: any) => {
          // IMPORTANT: Allow fatwa citations to pass through FIRST (regardless of namespace)
          if (c.metadata && (c.metadata.content_type === 'islamqa_fatwa' || 
              c.metadata.type === 'fatwa' || 
              c.metadata.type === 'FAT' ||
              c.metadata.source_link || 
              c.metadata.url)) {
            return true; // Keep fatwa citations
          }
          
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
          fatwa: filteredCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT' || c.metadata?.content_type === 'islamqa_fatwa').length
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
      const fatwaContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'fatwa' || ctx.metadata?.type === 'FAT' || ctx.metadata?.content_type === 'islamqa_fatwa');
      
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

    const streamingStartTime = Date.now();
    const streamSpan = mainTrace.span({
      name: "llm-streaming",
      input: { 
        selectedChatModel,
        hasContext: !!contextBlock,
        contextLength: contextBlock.length,
        messageId: messageId || null,
        systemPromptLength: modifiedSystemPrompt.length,
        conversationLength: messages.length,
        selectedLanguage: selectedLanguage || 'en',
        languageName: languageNames[selectedLanguage || 'en'] || 'English',
        streamingStartTime,
        hasVectorSearchProgress: vectorSearchProgressUpdates.length > 0,
        vectorSearchProgressCount: vectorSearchProgressUpdates.length
      }
    });

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
              onFinish: async ({ response }: { response: any }) => {
                const finishTime = Date.now();
                const streamingDuration = finishTime - streamingStartTime;
                
                // Only save assistant message after streaming completes successfully
                if (session.user?.id) {
                  try {
                    const assistantId = getTrailingMessageId({
                      messages: response.messages.filter(
                        (message: any) => message.role === 'assistant',
                      ),
                    });

                    if (!assistantId) {
                      console.error('No assistant message found in response');
                      safeTrace(() => streamSpan.update({ 
                        output: { 
                          error: "No assistant message found in response",
                          success: false,
                          provider: "primary",
                          streamingDurationMs: streamingDuration,
                          totalResponseMessages: response.messages.length
                        }
                      }));
                      return;
                    }

                    const [, assistantMessage] = appendResponseMessages({
                      messages: [message],
                      responseMessages: response.messages,
                    });

                    // Calculate response length and extract full response text
                    const responseLength = assistantMessage.parts?.reduce((acc: number, part: any) => 
                      acc + (part.text?.length || 0), 0) || 0;
                    
                    // Extract the complete response text
                    const fullResponseText = assistantMessage.parts?.map((part: any) => part.text || '').join('') || '';
                    
                    // Check if this is the "Sorry I do not have enough information" response
                    const isInsufficientInfoResponse = fullResponseText.trim() === "Sorry I do not have enough information to provide grounded response";
                    
                    // Refund message if user got insufficient info response
                    if (isInsufficientInfoResponse && messageConsumed && entitlements.useTrialBalance) {
                      try {
                        const { refundUserMessage } = await import('@/lib/db/queries');
                        await refundUserMessage(session.user.id, usedTrialForRefund);
                        console.log(`[Chat API] Refunded message for user ${session.user.id} due to insufficient info response. Was trial: ${usedTrialForRefund}`);
                      } catch (refundError) {
                        console.error('Failed to refund message:', refundError);
                      }
                    }
                    
                    // Extract citations from the response
                    const citationMatches = fullResponseText.match(/\[CIT\d+\]/g) || [];
                    const uniqueCitations = [...new Set(citationMatches)] as string[];
                    
                    // Get the context that was used for this response
                    const usedContext = messageId ? getContextByMessageId(messageId) : [];
                    
                    // Map citations to their actual sources
                    const citationSourceMap: any = {};
                    uniqueCitations.forEach((citation: string) => {
                      const citationIndex = parseInt(citation.replace(/\[CIT(\d+)\]/, '$1')) - 1;
                      if (usedContext[citationIndex]) {
                        citationSourceMap[citation] = {
                          text: usedContext[citationIndex].text?.substring(0, 200) + '...',
                          metadata: usedContext[citationIndex].metadata,
                          namespace: usedContext[citationIndex].namespace,
                          score: usedContext[citationIndex].score
                        };
                      }
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
                    let vectorSearchSaved = false;
                    if (vectorSearchData) {
                      try {
                        await saveVectorSearchResult({
                          messageId: assistantId,
                          ...vectorSearchData,
                        });
                        vectorSearchSaved = true;
                        // Clean up
                        delete (globalThis as any).__vectorSearchDataToSave;
                      } catch (error) {
                        console.error('Failed to save vector search results:', error);
                      }
                    }

                    safeTrace(() => streamSpan.update({ 
                      output: { 
                        assistantId,
                        success: true,
                        provider: "primary",
                        streamingDurationMs: streamingDuration,
                        totalDurationMs: finishTime - startTime,
                        responseLength,
                        responseMessageCount: response.messages.length,
                        assistantMessageParts: assistantMessage.parts?.length || 0,
                        vectorSearchSaved,
                        hasAttachments: !!(assistantMessage.experimental_attachments?.length),
                        attachmentCount: assistantMessage.experimental_attachments?.length || 0,
                        // NEW: Complete response with sources and refund info
                        finalResponse: {
                          fullText: fullResponseText.substring(0, 1000) + (fullResponseText.length > 1000 ? '...' : ''),
                          citationsUsed: uniqueCitations,
                          citationCount: uniqueCitations.length,
                          citationSourceMap,
                          hasContext: usedContext.length > 0,
                          contextSourceCount: usedContext.length,
                          isInsufficientInfoResponse,
                          messageRefunded: isInsufficientInfoResponse && messageConsumed
                        }
                      }
                    }));
                  } catch (error) {
                    console.error('Failed to save assistant message:', error);
                    safeTrace(() => streamSpan.update({ 
                      output: { 
                        error: "Failed to save assistant message",
                        errorMessage: error instanceof Error ? error.message : String(error),
                        success: false,
                        provider: "primary",
                        streamingDurationMs: streamingDuration
                      }
                    }));
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
              onFinish: async ({ response }: { response: any }) => {
                const finishTime = Date.now();
                const streamingDuration = finishTime - streamingStartTime;
                
                // Only save assistant message after streaming completes successfully
                if (session.user?.id) {
                  try {
                    const assistantId = getTrailingMessageId({
                      messages: response.messages.filter(
                        (message: any) => message.role === 'assistant',
                      ),
                    });

                    if (!assistantId) {
                      console.error('No assistant message found in response');
                      safeTrace(() => streamSpan.update({ 
                        output: { 
                          error: "No assistant message found in response",
                          success: false,
                          provider: "fallback",
                          streamingDurationMs: streamingDuration,
                          totalResponseMessages: response.messages.length
                        }
                      }));
                      return;
                    }

                    const [, assistantMessage] = appendResponseMessages({
                      messages: [message],
                      responseMessages: response.messages,
                    });

                    // Calculate response length
                    const responseLength = assistantMessage.parts?.reduce((acc: number, part: any) => 
                      acc + (part.text?.length || 0), 0) || 0;

                    // Extract the complete response text for fallback provider too
                    const fullResponseTextFallback = assistantMessage.parts?.map((part: any) => part.text || '').join('') || '';
                    
                    // Check if this is the "Sorry I do not have enough information" response
                    const isInsufficientInfoResponse = fullResponseTextFallback.trim() === "Sorry I do not have enough information to provide grounded response";
                    
                    // Refund message if user got insufficient info response
                    if (isInsufficientInfoResponse && messageConsumed && entitlements.useTrialBalance) {
                      try {
                        const { refundUserMessage } = await import('@/lib/db/queries');
                        await refundUserMessage(session.user.id, usedTrialForRefund);
                        console.log(`[Chat API Fallback] Refunded message for user ${session.user.id} due to insufficient info response. Was trial: ${usedTrialForRefund}`);
                      } catch (refundError) {
                        console.error('Failed to refund message (fallback):', refundError);
                      }
                    }

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
                    let vectorSearchSaved = false;
                    if (vectorSearchData) {
                      try {
                        await saveVectorSearchResult({
                          messageId: assistantId,
                          ...vectorSearchData,
                        });
                        vectorSearchSaved = true;
                        // Clean up
                        delete (globalThis as any).__vectorSearchDataToSave;
                      } catch (error) {
                        console.error('Failed to save vector search results:', error);
                      }
                    }

                    const citationMatchesFallback = fullResponseTextFallback.match(/\[CIT\d+\]/g) || [];
                    const uniqueCitationsFallback = [...new Set(citationMatchesFallback)] as string[];
                    const usedContextFallback = messageId ? getContextByMessageId(messageId) : [];
                    
                    // Map citations to their actual sources for fallback
                    const citationSourceMapFallback: any = {};
                    uniqueCitationsFallback.forEach((citation: string) => {
                      const citationIndex = parseInt(citation.replace(/\[CIT(\d+)\]/, '$1')) - 1;
                      if (usedContextFallback[citationIndex]) {
                        citationSourceMapFallback[citation] = {
                          text: usedContextFallback[citationIndex].text?.substring(0, 200) + '...',
                          metadata: usedContextFallback[citationIndex].metadata,
                          namespace: usedContextFallback[citationIndex].namespace,
                          score: usedContextFallback[citationIndex].score
                        };
                      }
                    });

                    safeTrace(() => streamSpan.update({ 
                      output: { 
                        assistantId,
                        success: true,
                        provider: "fallback",
                        streamingDurationMs: streamingDuration,
                        totalDurationMs: finishTime - startTime,
                        responseLength,
                        responseMessageCount: response.messages.length,
                        assistantMessageParts: assistantMessage.parts?.length || 0,
                        vectorSearchSaved,
                        hasAttachments: !!(assistantMessage.experimental_attachments?.length),
                        attachmentCount: assistantMessage.experimental_attachments?.length || 0,
                        // NEW: Complete response with sources and refund info for fallback provider
                        finalResponse: {
                          fullText: fullResponseTextFallback.substring(0, 1000) + (fullResponseTextFallback.length > 1000 ? '...' : ''),
                          citationsUsed: uniqueCitationsFallback,
                          citationCount: uniqueCitationsFallback.length,
                          citationSourceMap: citationSourceMapFallback,
                          hasContext: usedContextFallback.length > 0,
                          contextSourceCount: usedContextFallback.length,
                          isInsufficientInfoResponse,
                          messageRefunded: isInsufficientInfoResponse && messageConsumed
                        }
                      }
                    }));
                  } catch (error) {
                    console.error('Failed to save assistant message:', error);
                    safeTrace(() => streamSpan.update({ 
                      output: { 
                        error: "Failed to save assistant message",
                        errorMessage: error instanceof Error ? error.message : String(error),
                        success: false,
                        provider: "fallback",
                        streamingDurationMs: streamingDuration
                      }
                    }));
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
          safeTrace(() => streamSpan.update({ 
            output: { 
              error: error instanceof Error ? error.message : String(error),
              success: false
            }
          }));
          throw error;
        }
      },
      onError: (error) => {
        console.error('DataStream error:', error);
        safeTrace(() => streamSpan.update({ 
          output: { 
            error: "DataStream error",
            success: false
          }
        }));
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    // Add custom headers if using vector search
    const headers: Record<string, string> = {};
    if (messageId) {
      headers['x-message-id'] = messageId;
    }

    const finalProcessingTime = Date.now() - startTime;
    const endTime = Date.now();
    
    safeTrace(() => mainTrace.update({ 
      output: { 
        success: true,
        type: "chat-stream",
        hasMessageId: !!messageId,
        hasStreamContext: !!streamContext,
        responseHeaders: Object.keys(headers),
        totalProcessingTimeMs: finalProcessingTime,
        hasVectorSearch: !!messageId,
        vectorSearchProgressUpdates: vectorSearchProgressUpdates.length,
        contextBlockLength: contextBlock.length,
        systemPromptLength: modifiedSystemPrompt.length,
        conversationLength: messages.length,
        selectedLanguage: selectedLanguage || 'en',
        selectedSources: selectedSources ? Object.entries(selectedSources).filter(([_, enabled]) => enabled).map(([source, _]) => source).join(',') || 'all' : 'all',
        messageLength,
        hasAttachments: !!(message.experimental_attachments?.length),
        attachmentCount: message.experimental_attachments?.length || 0,
        streamId,
        chatId: id,
        userId: session.user.id,
        userType: session.user.type,
        completedAt: new Date().toISOString(),
        // Summary of what was processed
        processingBreakdown: {
          authenticationMs: 'tracked in auth span',
          rateLimitingMs: 'tracked in rate-limit span', 
          vectorSearchMs: 'tracked in vector-search spans',
          llmStreamingMs: 'tracked in llm-streaming span',
          totalMs: finalProcessingTime
        }
      }
    }));

    // Flush the trace to ensure it's sent to Langfuse
    await flushTrace(mainTrace);

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
        { headers }
      );
    } else {
      return new Response(stream, { headers });
    }
  } catch (error) {
    const errorEndTime = Date.now();
    const errorTotalDuration = errorEndTime - startTime;
    
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof ChatSDKError ? 'ChatSDKError' : 'UnexpectedError',
        stack: error instanceof Error ? error.stack : undefined,
        success: false,
        endTime: errorEndTime,
        endTimestamp: new Date(errorEndTime).toISOString(),
        latencyMs: errorTotalDuration,
        durationMs: errorTotalDuration,
        // Timing summary for error trace
        timing: {
          startTime: startTime,
          endTime: errorEndTime,
          durationMs: errorTotalDuration,
          latencyMs: errorTotalDuration,
          startTimestamp: new Date(startTime).toISOString(),
          endTimestamp: new Date(errorEndTime).toISOString()
        }
      }
    }));

    // Flush the trace even on error to ensure it's sent to Langfuse
    await flushTrace(mainTrace);

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
  const getStartTime = Date.now();
  
  const mainTrace = langfuse.trace({
    name: "chat-get-request",
    input: { 
      url: request.url,
      method: request.method,
      startTime: getStartTime,
      startTimestamp: new Date(getStartTime).toISOString()
    },
    metadata: { 
      timestamp: new Date().toISOString(),
      requestStartTime: getStartTime
    }
  });

  console.log('[langfuse] Created main trace for chat-get-request:', mainTrace.id);

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const messageId = searchParams.get('messageId');

  safeTrace(() => mainTrace.update({ 
    metadata: { 
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasStreamContext: !!streamContext
    }
  }));

  // Handle messageId request for vector search context
  if (messageId) {
    const citationsSpan = mainTrace.span({
      name: "get-citations",
      input: { messageId }
    });

    const citations = getContextByMessageId(messageId);
    safeTrace(() => citationsSpan.update({ 
      output: { 
        citationsCount: citations.length,
        success: true
      }
    }));
    const citationsEndTime = Date.now();
    const citationsDuration = citationsEndTime - getStartTime;
    
    safeTrace(() => mainTrace.update({ 
      output: { 
        success: true,
        type: "citations-retrieval",
        citationsCount: citations.length,
        endTime: citationsEndTime,
        endTimestamp: new Date(citationsEndTime).toISOString(),
        latencyMs: citationsDuration,
        durationMs: citationsDuration,
        // Timing summary for citations retrieval
        timing: {
          startTime: getStartTime,
          endTime: citationsEndTime,
          durationMs: citationsDuration,
          latencyMs: citationsDuration,
          startTimestamp: new Date(getStartTime).toISOString(),
          endTimestamp: new Date(citationsEndTime).toISOString()
        }
      }
    }));
    
    // Flush the trace to ensure it's sent to Langfuse
    await flushTrace(mainTrace);
    
    return new Response(
      JSON.stringify({ citations }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!streamContext) {
    const noStreamEndTime = Date.now();
    const noStreamDuration = noStreamEndTime - getStartTime;
    
    safeTrace(() => mainTrace.update({ 
      output: { 
        success: true,
        type: "no-stream-context",
        status: 204,
        endTime: noStreamEndTime,
        endTimestamp: new Date(noStreamEndTime).toISOString(),
        latencyMs: noStreamDuration,
        durationMs: noStreamDuration,
        timing: {
          startTime: getStartTime,
          endTime: noStreamEndTime,
          durationMs: noStreamDuration,
          latencyMs: noStreamDuration,
          startTimestamp: new Date(getStartTime).toISOString(),
          endTimestamp: new Date(noStreamEndTime).toISOString()
        }
      }
    }));
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "Missing chatId",
        success: false
      }
    }));
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "Unauthorized",
        success: false
      }
    }));
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "Chat not found",
        success: false
      }
    }));
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "Chat not found",
        success: false
      }
    }));
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "Forbidden chat access",
        success: false
      }
    }));
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "No stream found",
        success: false
      }
    }));
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "No recent stream found",
        success: false
      }
    }));
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
      safeTrace(() => mainTrace.update({ 
        output: { 
          success: true,
          type: "empty-stream-no-messages",
          status: 200
        }
      }));
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      safeTrace(() => mainTrace.update({ 
        output: { 
          success: true,
          type: "empty-stream-no-assistant",
          status: 200
        }
      }));
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      safeTrace(() => mainTrace.update({ 
        output: { 
          success: true,
          type: "empty-stream-too-old",
          status: 200
        }
      }));
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

    safeTrace(() => mainTrace.update({ 
      output: { 
        success: true,
        type: "restored-stream",
        status: 200
      }
    }));

    return new Response(restoredStream, { status: 200 });
  }

  safeTrace(() => mainTrace.update({ 
    output: { 
      success: true,
      type: "resumable-stream",
      status: 200
    }
  }));

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
