import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import { type UserType } from '@/app/(auth)/auth';
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
  getUser,
  createUser,
  consumeUserMessage,
} from '@/lib/db/queries';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateHashedPassword } from '@/lib/db/utils';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../(chat)/actions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment, isVectorSearchEnabled } from '@/lib/constants';
import { myProvider, fallbackProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { externalChatRequestSchema, type ExternalChatRequest } from './schema';
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
    console.log('[langfuse] External trace flushed successfully');
  } catch (error) {
    console.debug('[langfuse] External flush error:', error);
  }
};

export const maxDuration = 60;

// HARDCODED API KEY - Change this to your secure key
const HARDCODED_API_KEY = 'your-super-secret-api-key-change-this-12345';

// External API user email - the actual user ID will be fetched from database
const EXTERNAL_API_USER_EMAIL = 'external-api@system.local';

// Database connection for direct queries
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
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

// Simple API key validation
function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  
  const [type, key] = authHeader.split(' ');
  if (type !== 'Bearer' || !key) return false;
  
  return key === HARDCODED_API_KEY;
}

// Ensure external API user exists in database and return user data
async function getOrCreateExternalApiUser(): Promise<{ id: string; type: UserType }> {
  try {
    let existingUsers = await getUser(EXTERNAL_API_USER_EMAIL);
    if (existingUsers.length === 0) {
      console.log('[external-chat] Creating external API user...');
      await createUser(EXTERNAL_API_USER_EMAIL, 'system-generated-password');
      console.log('[external-chat] External API user created successfully');
      // Fetch the newly created user
      existingUsers = await getUser(EXTERNAL_API_USER_EMAIL);
    }
    
    if (existingUsers.length === 0) {
      throw new Error('Failed to create or retrieve external API user');
    }
    
    return {
      id: existingUsers[0].id,
      type: 'regular' as const
    };
  } catch (error) {
    console.error('[external-chat] Failed to ensure external API user exists:', error);
    throw error;
  }
}

// Get or create user by ID - for custom user IDs
async function getOrCreateUserById(userId: string): Promise<{ id: string; type: UserType }> {
  try {
    // First try to find user by ID directly
    const existingUsers = await db.select().from(user).where(eq(user.id, userId));
    
    if (existingUsers.length > 0) {
      return {
        id: existingUsers[0].id,
        type: 'regular' as const
      };
    }
    
    // If user doesn't exist, create with a generated email
    const generatedEmail = `api-user-${userId}@external.local`;
    console.log('[external-chat] Creating user for ID:', userId);
    
    // Insert user with specific ID
    await db.insert(user).values({
      id: userId,
      email: generatedEmail,
      password: generateHashedPassword('api-generated-password')
    });
    
    console.log('[external-chat] User created successfully for ID:', userId);
    
    return {
      id: userId,
      type: 'regular' as const
    };
  } catch (error) {
    console.error('[external-chat] Failed to get or create user by ID:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  // Create main trace for the entire external chat request
  const mainTrace = langfuse.trace({
    name: "external-chat-request",
    input: { 
      url: request.url,
      method: request.method,
      headers: {
        'content-type': request.headers.get('content-type'),
        'user-agent': request.headers.get('user-agent')?.substring(0, 100),
        'accept': request.headers.get('accept'),
        'origin': request.headers.get('origin'),
        'authorization': request.headers.get('authorization') ? 'Bearer [REDACTED]' : null
      }
    },
    metadata: { 
      timestamp: new Date().toISOString(),
      requestStartTime: startTime,
      environment: process.env.NODE_ENV,
      deployment: process.env.VERCEL_ENV || 'local',
      apiType: 'external',
      source: 'external-api'
    }
  });

  console.log('[langfuse] Created main trace for external-chat-request:', mainTrace.id);

  // Validate API key first
  const authSpan = mainTrace.span({
    name: "api-key-validation",
    input: { 
      hasAuthHeader: !!request.headers.get('authorization'),
      authType: request.headers.get('authorization')?.split(' ')[0] || null,
      validationStartTime: Date.now()
    }
  });

  if (!validateApiKey(request)) {
    safeTrace(() => authSpan.update({ 
      output: { 
        authenticated: false, 
        error: "Invalid API key",
        duration: Date.now() - startTime
      }
    }));
    safeTrace(() => mainTrace.update({ 
      output: { 
        error: "Unauthorized - Invalid API key",
        success: false,
        apiType: 'external'
      }
    }));
    await flushTrace(mainTrace);
    
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  safeTrace(() => authSpan.update({ 
    output: { 
      authenticated: true,
      duration: Date.now() - startTime
    }
  }));

  // Test database connection (skip during build)
  if (process.env.NODE_ENV !== 'production' || process.env.RAILWAY_ENVIRONMENT) {
    try {
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        console.error('[external-chat route] Database connection test failed');
        return new ChatSDKError('bad_request:database', 'Database connection failed').toResponse();
      }
    } catch (error) {
      console.warn('[external-chat route] Database connection test skipped during build:', error);
    }
  }

  // Check if this is a vector search request
  const url = new URL(request.url);
  const isVectorSearchRequest = url.searchParams.get('vector') === '1';
  const isStreamRequest = url.searchParams.get('stream') === '1';

  let requestBody: ExternalChatRequest;

  try {
    const json = await request.json();
    console.log('[external-chat route] 🔍 Request body received:', {
      hasId: !!json.id,
      hasMessage: !!json.message,
      hasSelectedSources: !!json.selectedSources,
      selectedSources: json.selectedSources,
      messageId: json.message?.id,
      messageContent: json.message?.content?.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });
    requestBody = externalChatRequestSchema.parse(json);
    console.log('[external-chat route] ✅ Schema validation passed');
  } catch (error) {
    console.error('[external-chat route] ❌ Schema validation failed:', {
      error: error instanceof Error ? error.message : String(error),
      errorDetails: error,
      timestamp: new Date().toISOString()
    });
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, userId, message, selectedChatModel, selectedVisibilityType, selectedLanguage, selectedSources } =
      requestBody;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('[external-chat route] Invalid chat ID format:', { id });
      return new ChatSDKError('bad_request:api', 'Invalid chat ID format').toResponse();
    }

    // Validate userId format if provided
    if (userId && !uuidRegex.test(userId)) {
      console.error('[external-chat route] Invalid user ID format:', { userId });
      return new ChatSDKError('bad_request:api', 'Invalid user ID format').toResponse();
    }

    // Get or create user - use provided userId or default external user
    const apiUser = userId 
      ? await getOrCreateUserById(userId)
      : await getOrCreateExternalApiUser();
    
    const session = {
      user: apiUser
    };

    console.log('[external-chat route] Using user:', {
      userId: session.user.id,
      isCustomUser: !!userId,
      providedUserId: userId
    });

    const userType: UserType = session.user.type;

    // NEW: Use trial balance system for external API users too
    const rateLimitSpan = mainTrace.span({
      name: "rate-limit-check",
      input: { 
        userId: session.user.id,
        userType: userType,
        checkStartTime: Date.now(),
        apiType: 'external'
      }
    });

    const { entitlementsByUserType } = await import('@/lib/ai/entitlements');
    const entitlements = entitlementsByUserType[userType] || entitlementsByUserType['regular'];
    
    // Store consumption info for potential refund
    let messageConsumed = false;
    let usedTrialForRefund = false;
    
    if (entitlements.useTrialBalance) {
      // Try to consume a message from user's balance
      const consumeResult = await consumeUserMessage(session.user.id);
      
      if (!consumeResult.success) {
        // User has no messages left - return rate limit error
        console.log(`[External Chat API] User ${session.user.id} has no messages remaining`);
        
        safeTrace(() => rateLimitSpan.update({
          output: {
            success: false,
            error: "Rate limit exceeded",
            remainingMessages: 0,
            systemType: "trial",
            entitlements: entitlements,
            apiType: 'external',
            duration: Date.now() - startTime
          }
        }));
        safeTrace(() => mainTrace.update({ 
          output: { 
            error: "Rate limit exceeded",
            success: false,
            apiType: 'external'
          }
        }));
        await flushTrace(mainTrace);
        
        return new ChatSDKError('rate_limit:chat').toResponse();
      }
      
      // Store consumption info for potential refund
      messageConsumed = true;
      usedTrialForRefund = consumeResult.usedTrial;
      
      console.log(`[External Chat API] User ${session.user.id} consumed message. Remaining: ${consumeResult.remainingMessages}, Used trial: ${consumeResult.usedTrial}`);
      
      safeTrace(() => rateLimitSpan.update({
        output: {
          success: true,
          remainingMessages: consumeResult.remainingMessages,
          usedTrial: consumeResult.usedTrial,
          systemType: "trial",
          entitlements: entitlements,
          apiType: 'external',
          duration: Date.now() - startTime
        }
      }));
    } else {
      // LEGACY: For users not using trial balance system, allow unlimited access
      console.log(`[External Chat API] User ${session.user.id} using legacy system - unlimited access`);
      
      safeTrace(() => rateLimitSpan.update({
        output: {
          success: true,
          systemType: "legacy",
          unlimited: true,
          entitlements: entitlements,
          apiType: 'external',
          duration: Date.now() - startTime
        }
      }));
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      console.log('[external-chat route] Attempting to save new chat:', {
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
        titleLength: title?.length,
        userIdType: typeof session.user.id,
        idType: typeof id,
        visibilityType: typeof selectedVisibilityType,
        visibilityValue: selectedVisibilityType,
        isVisibilityPublic: selectedVisibilityType === 'public',
        isVisibilityPrivate: selectedVisibilityType === 'private'
      });

      try {
        await saveChat({
          id,
          userId: session.user.id,
          title,
          visibility: selectedVisibilityType,
        });
        console.log('[external-chat route] Chat saved successfully');
        
        // Verify what was actually saved
        const savedChat = await getChatById({ id });
        console.log('[external-chat route] Verification - Chat retrieved after save:', {
          id: savedChat?.id,
          visibility: savedChat?.visibility,
          title: savedChat?.title,
          userId: savedChat?.userId,
          createdAt: savedChat?.createdAt
        });
      } catch (saveChatError) {
        console.error('[external-chat route] Failed to save chat:', {
          error: saveChatError,
          errorMessage: saveChatError instanceof Error ? saveChatError.message : 'Unknown error',
          errorStack: saveChatError instanceof Error ? saveChatError.stack : undefined,
          chatData: {
            id,
            userId: session.user.id,
            title,
            visibility: selectedVisibilityType
          }
        });
        throw saveChatError;
      }
    } else {
      // For API users, allow access to all chats
      // You might want to restrict this based on your needs
    }

    const previousMessages = await getMessagesByChatId({ id });

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    // Log the user request details
    console.log('[external-chat route] User request details:', {
      chatId: id,
      messageId: message.id,
      messageRole: message.role,
      selectedLanguage,
      selectedChatModel,
      selectedVisibilityType,
      selectedSources,
    });

    // Extract and log user message content
    let userMessageContent = '';
    if (message.parts && Array.isArray(message.parts)) {
      console.log('[external-chat route] Message parts:', message.parts.map(part => ({
        type: part.type,
        textLength: part.type === 'text' ? part.text?.length : 0,
        textPreview: part.type === 'text' ? part.text?.substring(0, 100) + '...' : 'N/A'
      })));
      
      for (const part of message.parts) {
        if (part.type === 'text' && part.text) {
          userMessageContent += part.text;
        }
      }
    } else if (message.content) {
      userMessageContent = message.content;
      console.log('[external-chat route] Message content (legacy):', {
        contentLength: message.content.length,
        contentPreview: message.content.substring(0, 100) + '...'
      });
    }

    console.log('[external-chat route] Extracted user message content:', {
      totalLength: userMessageContent.length,
      contentPreview: userMessageContent.substring(0, 200) + '...',
      fullContent: userMessageContent
    });

    // Handle vector search request
    if (isVectorSearchRequest && !isStreamRequest) {
      const conversationHistory = buildConversationHistory(messages);
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
      
      console.log('[external-chat route] Vector search context:', {
        messagesCount: messages.length,
        historyLength: conversationHistory.length,
        userMessageLength: userMessageContent.length,
        historyPreview: conversationHistory.substring(0, 200) + '...'
      });
      
      const searchResults = await performVectorSearch(
        userMessageContent,
        conversationHistory,
        selectedChatModel,
        selectedSources
      );

      // Filter out citations with minimal metadata before sending to frontend
      const filteredCitations = searchResults.citations.filter((c: any) => {
        if (!c.namespace && c.metadata) {
          // IMPORTANT: Allow fatwa citations to pass through
          if (c.metadata.content_type === 'islamqa_fatwa' || 
              c.metadata.type === 'fatwa' || 
              c.metadata.type === 'FAT' ||
              c.metadata.source_link || 
              c.metadata.url) {
            return true; // Keep fatwa citations
          }
          
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
          citations: filteredCitations,
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

    // Save user message immediately
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
    console.log('[external-chat route] 🔍 Vector search check:', {
      isVectorSearchEnabled,
      hasMessageId: !!messageId,
      shouldPerformVectorSearch: isVectorSearchEnabled && !messageId,
      environment: process.env.NODE_ENV,
      enableVectorSearchEnv: process.env.ENABLE_VECTOR_SEARCH
    });
    
    if (isVectorSearchEnabled && !messageId) {
      console.log('[external-chat route] 🚀 Starting automatic vector search execution');
      
      const vectorSearchSpan = mainTrace.span({
        name: "vector-search",
        input: {
          messagesCount: messages.length,
          selectedSources: selectedSources,
          selectedChatModel: selectedChatModel,
          searchStartTime: Date.now(),
          apiType: 'external'
        }
      });
      
      const conversationHistory = buildConversationHistory(messages);
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
      
      console.log('[external-chat route] Vector search context:', {
        messagesCount: messages.length,
        historyLength: conversationHistory.length,
        userMessageLength: userMessageContent.length,
        historyPreview: conversationHistory.substring(0, 200) + '...',
        selectedSources: selectedSources,
        selectedSourcesType: typeof selectedSources,
        selectedSourcesKeys: selectedSources ? Object.keys(selectedSources) : 'null'
      });
      
      const searchStartTime = Date.now();
      
      try {
        console.log('[external-chat route] 🔍 Calling performVectorSearchWithProgress with selectedSources:', selectedSources);
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
          if (!c.namespace && c.metadata) {
            // IMPORTANT: Allow fatwa citations to pass through
            if (c.metadata.content_type === 'islamqa_fatwa' || 
                c.metadata.type === 'fatwa' || 
                c.metadata.type === 'FAT' ||
                c.metadata.source_link || 
                c.metadata.url) {
              return true; // Keep fatwa citations
            }
            
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
        console.log('[external-chat route] Storing filtered citations in messageContextMap:', {
          messageId,
          originalCitationsCount: searchResults.citations.length,
          filteredCitationsCount: filteredCitations.length
        });
        messageContextMap.set(messageId, filteredCitations);
        
        // Store search results for later saving to database
        const searchResultCounts = {
          classic: filteredCitations.filter((c: any) => c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)).length,
          modern: filteredCitations.filter((c: any) => c.metadata?.type === 'modern' || c.metadata?.type === 'MOD').length,
          risale: filteredCitations.filter((c: any) => c.metadata?.type === 'risale' || c.metadata?.type === 'RIS' || (c.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(c.namespace))).length,
          youtube: filteredCitations.filter((c: any) => c.metadata?.type === 'youtube' || c.metadata?.type === 'YT' || (c.namespace && ['youtube-qa-pairs'].includes(c.namespace))).length,
          fatwa: filteredCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT').length
        };

        // Calculate citation scores for analytics
        const citationScores = filteredCitations.map((c: any) => c.score || 0);
        const avgScore = citationScores.length > 0 ? citationScores.reduce((a: number, b: number) => a + b, 0) / citationScores.length : 0;
        const maxScore = citationScores.length > 0 ? Math.max(...citationScores) : 0;
        const minScore = citationScores.length > 0 ? Math.min(...citationScores) : 0;

        safeTrace(() => vectorSearchSpan.update({
          output: {
            messageId: messageId,
            searchDurationMs: searchDurationMs,
            totalCitations: filteredCitations.length,
            citationsBySource: searchResultCounts,
            improvedQueriesCount: searchResults.improvedQueries?.length || 0,
            citationAnalytics: {
              avgScore: avgScore,
              maxScore: maxScore,
              minScore: minScore,
              scoreDistribution: citationScores
            },
            conversationContext: {
              historyLength: conversationHistory.length,
              userMessageLength: userMessageContent.length,
              messagesInConversation: messages.length
            },
            filteringStats: {
              originalCount: searchResults.citations.length,
              filteredCount: filteredCitations.length,
              removedCount: searchResults.citations.length - filteredCitations.length
            },
            apiType: 'external'
          }
        }));
        
        // Store vector search data to save after assistant message is created
        (globalThis as any).__vectorSearchDataToSave = {
          chatId: id,
          improvedQueries: searchResults.improvedQueries,
          citations: filteredCitations,
          searchResultCounts,
          searchDurationMs,
        };
        
        // Add the final update with filtered citations
        vectorSearchProgressUpdates.push({
          step: 4,
          improvedQueries: searchResults.improvedQueries,
          searchResults: searchResultCounts,
          citations: filteredCitations
        });
        
        // Add chat ID to the data stream
        vectorSearchProgressUpdates.push({
          type: 'chat-info',
          chatId: id,
          messageId: searchResults.messageId
        });
      } catch (error) {
        console.error('[external-chat route] ❌ Automatic vector search failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        console.error('Automatic vector search failed:', error);
        
        safeTrace(() => vectorSearchSpan.update({
          output: {
            error: error instanceof Error ? error.message : String(error),
            searchDurationMs: Date.now() - searchStartTime,
            success: false,
            apiType: 'external'
          }
        }));
      }
    }

    if (messageId && messageContextMap.has(messageId)) {
      // Build context block from stored citations
      const allContexts = getContextByMessageId(messageId);
      console.log('[external-chat route] Found citations in messageContextMap:', {
        messageId,
        totalContexts: allContexts.length,
        contextTypes: allContexts.map(c => c.metadata?.type || 'unknown')
      });
      
      const classicContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'classic' || ctx.metadata?.type === 'CLS' || (!ctx.metadata?.type && !ctx.namespace));
      const modernContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'modern' || ctx.metadata?.type === 'MOD');
      const risaleContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'risale' || ctx.metadata?.type === 'RIS' || (ctx.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(ctx.namespace)));
      const youtubeContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'youtube' || ctx.metadata?.type === 'YT' || (ctx.namespace && ['youtube-qa-pairs'].includes(ctx.namespace)));
      const fatwaContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'fatwa' || ctx.metadata?.type === 'FAT');
      const tafsirsContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'tafsirs' || ctx.metadata?.type === 'TAF' || (ctx.namespace && ['Maarif-ul-Quran', 'Bayan-ul-Quran', 'Kashf-Al-Asrar', 'Tazkirul-Quran'].includes(ctx.namespace)));
      
      const totalCitations = classicContexts.length + modernContexts.length + risaleContexts.length + youtubeContexts.length + fatwaContexts.length + tafsirsContexts.length;
      
              console.log('[external-chat route] Citation breakdown:', {
          classic: classicContexts.length,
          modern: modernContexts.length,
          risale: risaleContexts.length,
          youtube: youtubeContexts.length,
          fatwa: fatwaContexts.length,
          tafsirs: tafsirsContexts.length,
          total: totalCitations
        });
      
      if (totalCitations === 0) {
        console.log('[external-chat route] No citations found, using fixed response prompt');
        
        const fixedResponsePrompt = `You must respond with exactly this message and nothing else: "Sorry I do not have enough information to provide grounded response"

Do not add any additional text, explanations, or formatting. Just return that exact message.`;
        
        modifiedSystemPrompt = fixedResponsePrompt;
      } else {
        console.log('[external-chat route] Using citations-based prompt with', totalCitations, 'citations');
        contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts, tafsirsContexts);

        const citationEmphasis = `

MARKDOWN FORMATTING REQUIREMENTS:
- Format your response using proper Markdown syntax
- Use **bold** for important terms and concepts
- Use *italics* for emphasis and Arabic/Islamic terms
- Use ### for section headings when organizing content
- Use bullet points (-) or numbered lists (1.) for structured information
- Use > for important quotes or Quranic verses
- Format your response to be visually appealing and well-structured

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
- Example: "**Prayer** is fundamental [CIT1], [CIT2]. It purifies the soul [CIT3]."
- Do NOT write: "Prayer is fundamental as detailed in [CIT1]" or "according to [CIT2]"

CONTEXT-AWARE RESPONSES:
- If this is a follow-up question, consider the ENTIRE conversation history
- Citations may relate to both the current question AND previous topics discussed
- Use citations that connect the current question to earlier parts of the conversation
- When answering "Can you explain more?" or similar follow-ups, refer back to what was discussed and expand using ALL available citations

CRITICAL: NO FAKE CITATIONS OR MODERN RESEARCH REFERENCES:
- ABSOLUTELY FORBIDDEN: Never cite, reference, or mention modern research studies, academic papers, or contemporary scientific studies that are not provided in your context
- ABSOLUTELY FORBIDDEN: Never create fake citations like "Research by Smith (2020)" or "Studies show (Johnson, 2019)" or "Исследования посттравматического роста (Tedeschi, 2004)"
- ABSOLUTELY FORBIDDEN: Never reference psychological studies, neuroscience research, or any modern academic work unless it is explicitly provided in your available citations
- ONLY use the Islamic sources and citations that are provided to you in the context ([CIT1], [CIT2], etc.)
- If you want to connect Islamic wisdom to modern concepts, do so through logical reasoning and universal principles, NOT through citing non-existent research
- Present Islamic teachings on their own merit and wisdom, without needing validation from modern studies

REMEMBER: More citations = Better answer. Use them ALL! Add [CIT] directly without connecting phrases. Format everything in beautiful Markdown!`;

        modifiedSystemPrompt = modifiedSystemPrompt + '\n\n' + contextBlock + citationEmphasis;
      }
    } else {
      console.log('[external-chat route] No messageId or messageContextMap entry found, using fixed response prompt');
      
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
          const llmSpan = mainTrace.span({
            name: "llm-streaming",
            input: {
              model: selectedChatModel,
              systemPromptLength: modifiedSystemPrompt.length,
              messagesCount: messages.length,
              hasVectorSearchContext: !!messageId,
              selectedLanguage: selectedLanguage,
              streamStartTime: Date.now(),
              apiType: 'external'
            }
          });

          let result;
          try {
            console.log('[external-chat route] Sending to AI model:', {
              model: selectedChatModel,
              systemPromptLength: modifiedSystemPrompt.length,
              systemPromptPreview: modifiedSystemPrompt.substring(0, 300) + '...',
              messagesCount: messages.length,
              lastUserMessage: messages[messages.length - 1],
              hasVectorSearchContext: !!messageId,
              languageInstruction: languageInstruction || 'None'
            });

            console.log('[external-chat route] Full system prompt:', modifiedSystemPrompt);

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
                if (session.user?.id) {
                  try {
                    const assistantId = getTrailingMessageId({
                      messages: response.messages.filter(
                        (message: any) => message.role === 'assistant',
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

                    // Extract final response text for tracing
                    let finalResponseText = '';
                    if (assistantMessage.parts && Array.isArray(assistantMessage.parts)) {
                      for (const part of assistantMessage.parts) {
                        if (part.type === 'text' && part.text) {
                          finalResponseText += part.text;
                        }
                      }
                    }

                    // Check if this is the "Sorry I do not have enough information" response
                    const isInsufficientInfoResponse = finalResponseText.trim() === "Sorry I do not have enough information to provide grounded response";
                    
                    // Refund message if user got insufficient info response
                    if (isInsufficientInfoResponse && messageConsumed && entitlements.useTrialBalance) {
                      try {
                        const { refundUserMessage } = await import('@/lib/db/queries');
                        await refundUserMessage(session.user.id, usedTrialForRefund);
                        console.log(`[External Chat API] Refunded message for user ${session.user.id} due to insufficient info response. Was trial: ${usedTrialForRefund}`);
                      } catch (refundError) {
                        console.error('Failed to refund message (external):', refundError);
                      }
                    }

                    // Extract citations used in the response
                    const citationMatches = finalResponseText.match(/\[CIT\d+\]/g) || [];
                    const uniqueCitations = [...new Set(citationMatches)];

                    // Get citation details if we have messageId
                    let citationDetails: any[] = [];
                    if (messageId && messageContextMap.has(messageId)) {
                      const allCitations = messageContextMap.get(messageId) || [];
                      citationDetails = uniqueCitations.map(citRef => {
                        const citNum = parseInt(citRef.match(/\d+/)?.[0] || '0');
                        const citation = allCitations[citNum - 1];
                        return citation ? {
                          reference: citRef,
                          originalText: citation.text?.substring(0, 200) + '...',
                          metadata: citation.metadata,
                          namespace: citation.namespace,
                          score: citation.score
                        } : null;
                      }).filter(Boolean);
                    }

                    // Update LLM span with comprehensive final response data
                    safeTrace(() => llmSpan.update({
                      output: {
                        assistantId: assistantId,
                        responseLength: finalResponseText.length,
                        responsePreview: finalResponseText.substring(0, 1000),
                        citationsUsed: uniqueCitations,
                        citationCount: uniqueCitations.length,
                        citationToSourceMapping: citationDetails,
                        citationAnalytics: {
                          totalAvailable: messageId && messageContextMap.has(messageId) ? (messageContextMap.get(messageId) || []).length : 0,
                          totalUsed: uniqueCitations.length,
                          utilizationRate: messageId && messageContextMap.has(messageId) ? 
                            (uniqueCitations.length / Math.max((messageContextMap.get(messageId) || []).length, 1) * 100).toFixed(1) + '%' : '0%'
                        },
                        contextUtilization: {
                          hasVectorContext: !!messageId,
                          messageId: messageId,
                          contextLength: modifiedSystemPrompt.length
                        },
                        streamingDuration: Date.now() - startTime,
                        provider: 'primary',
                        apiType: 'external',
                        isInsufficientInfoResponse,
                        messageRefunded: isInsufficientInfoResponse && messageConsumed
                      }
                    }));

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
                    
                    const vectorSearchData = (globalThis as any).__vectorSearchDataToSave;
                    if (vectorSearchData) {
                      try {
                        await saveVectorSearchResult({
                          messageId: assistantId,
                          ...vectorSearchData,
                        });
                        delete (globalThis as any).__vectorSearchDataToSave;
                      } catch (error) {
                        console.error('Failed to save vector search results:', error);
                      }
                    }

                    // Update main trace with final success data
                    safeTrace(() => mainTrace.update({
                      output: {
                        success: true,
                        assistantMessageId: assistantId,
                        responseLength: finalResponseText.length,
                        citationsUsed: uniqueCitations.length,
                        totalDuration: Date.now() - startTime,
                        apiType: 'external'
                      }
                    }));

                    // Flush trace to ensure data reaches Langfuse
                    await flushTrace(mainTrace);
                  } catch (error) {
                    console.error('Failed to save assistant message:', error);
                    safeTrace(() => llmSpan.update({
                      output: {
                        error: error instanceof Error ? error.message : String(error),
                        provider: 'primary',
                        apiType: 'external'
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
            safeTrace(() => llmSpan.update({
              output: {
                primaryProviderError: primaryError instanceof Error ? primaryError.message : String(primaryError),
                usingFallback: true,
                apiType: 'external'
              }
            }));

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
                if (session.user?.id) {
                  try {
                    const assistantId = getTrailingMessageId({
                      messages: response.messages.filter(
                        (message: any) => message.role === 'assistant',
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

                    // Extract final response text for tracing
                    let finalResponseText = '';
                    if (assistantMessage.parts && Array.isArray(assistantMessage.parts)) {
                      for (const part of assistantMessage.parts) {
                        if (part.type === 'text' && part.text) {
                          finalResponseText += part.text;
                        }
                      }
                    }

                    // Check if this is the "Sorry I do not have enough information" response
                    const isInsufficientInfoResponse = finalResponseText.trim() === "Sorry I do not have enough information to provide grounded response";
                    
                    // Refund message if user got insufficient info response
                    if (isInsufficientInfoResponse && messageConsumed && entitlements.useTrialBalance) {
                      try {
                        const { refundUserMessage } = await import('@/lib/db/queries');
                        await refundUserMessage(session.user.id, usedTrialForRefund);
                        console.log(`[External Chat API Fallback] Refunded message for user ${session.user.id} due to insufficient info response. Was trial: ${usedTrialForRefund}`);
                      } catch (refundError) {
                        console.error('Failed to refund message (external fallback):', refundError);
                      }
                    }

                    // Extract citations used in the response
                    const citationMatches = finalResponseText.match(/\[CIT\d+\]/g) || [];
                    const uniqueCitations: string[] = [...new Set(citationMatches)];

                    // Get citation details if we have messageId
                    let citationDetails: any[] = [];
                    if (messageId && messageContextMap.has(messageId)) {
                      const allCitations = messageContextMap.get(messageId) || [];
                      citationDetails = uniqueCitations.map(citRef => {
                        const citNum = parseInt(citRef.match(/\d+/)?.[0] || '0');
                        const citation = allCitations[citNum - 1];
                        return citation ? {
                          reference: citRef,
                          originalText: citation.text?.substring(0, 200) + '...',
                          metadata: citation.metadata,
                          namespace: citation.namespace,
                          score: citation.score
                        } : null;
                      }).filter(Boolean);
                    }

                    // Update LLM span with comprehensive final response data
                    safeTrace(() => llmSpan.update({
                      output: {
                        assistantId: assistantId,
                        responseLength: finalResponseText.length,
                        responsePreview: finalResponseText.substring(0, 1000),
                        citationsUsed: uniqueCitations,
                        citationCount: uniqueCitations.length,
                        citationToSourceMapping: citationDetails,
                        citationAnalytics: {
                          totalAvailable: messageId && messageContextMap.has(messageId) ? (messageContextMap.get(messageId) || []).length : 0,
                          totalUsed: uniqueCitations.length,
                          utilizationRate: messageId && messageContextMap.has(messageId) ? 
                            (uniqueCitations.length / Math.max((messageContextMap.get(messageId) || []).length, 1) * 100).toFixed(1) + '%' : '0%'
                        },
                        contextUtilization: {
                          hasVectorContext: !!messageId,
                          messageId: messageId,
                          contextLength: modifiedSystemPrompt.length
                        },
                        streamingDuration: Date.now() - startTime,
                        provider: 'fallback',
                        apiType: 'external',
                        isInsufficientInfoResponse,
                        messageRefunded: isInsufficientInfoResponse && messageConsumed
                      }
                    }));

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
                    
                    const vectorSearchData = (globalThis as any).__vectorSearchDataToSave;
                    if (vectorSearchData) {
                      try {
                        await saveVectorSearchResult({
                          messageId: assistantId,
                          ...vectorSearchData,
                        });
                        delete (globalThis as any).__vectorSearchDataToSave;
                      } catch (error) {
                        console.error('Failed to save vector search results:', error);
                      }
                    }

                    // Update main trace with final success data
                    safeTrace(() => mainTrace.update({
                      output: {
                        success: true,
                        assistantMessageId: assistantId,
                        responseLength: finalResponseText.length,
                        citationsUsed: uniqueCitations.length,
                        totalDuration: Date.now() - startTime,
                        usedFallbackProvider: true,
                        apiType: 'external'
                      }
                    }));

                    // Flush trace to ensure data reaches Langfuse
                    await flushTrace(mainTrace);
                  } catch (error) {
                    console.error('Failed to save assistant message:', error);
                    safeTrace(() => llmSpan.update({
                      output: {
                        error: error instanceof Error ? error.message : String(error),
                        provider: 'fallback',
                        apiType: 'external'
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
          throw error;
        }
      },
      onError: (error) => {
        console.error('DataStream error:', error);
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

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
    // Update main trace with error information
    safeTrace(() => mainTrace.update({
      output: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof ChatSDKError ? 'ChatSDKError' : 'UnexpectedError',
        totalDuration: Date.now() - startTime,
        apiType: 'external'
      }
    }));
    await flushTrace(mainTrace);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    console.error('Unexpected error in external-chat API:', error);
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
  // Validate API key first
  if (!validateApiKey(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

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

  // Get or create external API user
  const externalApiUser = await getOrCreateExternalApiUser();
  const session = {
    user: externalApiUser
  };

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  // For API users, allow access to all chats
  // You might want to restrict this based on your needs

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
  // Validate API key first
  if (!validateApiKey(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  // Get or create external API user
  const externalApiUser = await getOrCreateExternalApiUser();
  const session = {
    user: externalApiUser
  };

  const chat = await getChatById({ id });

  // For API users, allow deletion of all chats
  // You might want to restrict this based on your needs

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
} 