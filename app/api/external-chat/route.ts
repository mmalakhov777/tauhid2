import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
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
  getUser,
  createUser,
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
async function getOrCreateExternalApiUser(): Promise<{ id: string; type: 'premium' }> {
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
      type: 'premium' as const
    };
  } catch (error) {
    console.error('[external-chat] Failed to ensure external API user exists:', error);
    throw error;
  }
}

// Get or create user by ID - for custom user IDs
async function getOrCreateUserById(userId: string): Promise<{ id: string; type: 'premium' }> {
  try {
    // First try to find user by ID directly
    const existingUsers = await db.select().from(user).where(eq(user.id, userId));
    
    if (existingUsers.length > 0) {
      return {
        id: existingUsers[0].id,
        type: 'premium' as const
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
      type: 'premium' as const
    };
  } catch (error) {
    console.error('[external-chat] Failed to get or create user by ID:', error);
    throw error;
  }
}

export async function POST(request: Request) {
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

    const userType = session.user.type;

    // Skip message count check for API users (they have premium access)
    
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
          youtube: filteredCitations.filter((c: any) => c.metadata?.type === 'youtube' || c.metadata?.type === 'YT' || (c.namespace && ['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance', '2004', 'MercifulServant', '1572', 'Towards_Eternity'].includes(c.namespace))).length,
          fatwa: filteredCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT').length
        };
        
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
      const youtubeContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'youtube' || ctx.metadata?.type === 'YT' || (ctx.namespace && ['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance', '2004', 'MercifulServant', '1572', 'Towards_Eternity'].includes(ctx.namespace)));
      const fatwaContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'fatwa' || ctx.metadata?.type === 'FAT');
      
      const totalCitations = classicContexts.length + modernContexts.length + risaleContexts.length + youtubeContexts.length + fatwaContexts.length;
      
      console.log('[external-chat route] Citation breakdown:', {
        classic: classicContexts.length,
        modern: modernContexts.length,
        risale: risaleContexts.length,
        youtube: youtubeContexts.length,
        fatwa: fatwaContexts.length,
        total: totalCitations
      });
      
      if (totalCitations === 0) {
        console.log('[external-chat route] No citations found, using fixed response prompt');
        
        const fixedResponsePrompt = `You must respond with exactly this message and nothing else: "Sorry I do not have enough information to provide grounded response"

Do not add any additional text, explanations, or formatting. Just return that exact message.`;
        
        modifiedSystemPrompt = fixedResponsePrompt;
      } else {
        console.log('[external-chat route] Using citations-based prompt with', totalCitations, 'citations');
        contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts);

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
              onFinish: async ({ response }) => {
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