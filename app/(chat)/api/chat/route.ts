import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { authenticateApiRequest } from '@/lib/api-key';
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
  // Test database connection first
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.error('[chat route] Database connection test failed');
    return new ChatSDKError('bad_request:database', 'Database connection failed').toResponse();
  }

  // Check if this is a vector search request
  const url = new URL(request.url);
  const isVectorSearchRequest = url.searchParams.get('vector') === '1';
  const isStreamRequest = url.searchParams.get('stream') === '1';

  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    console.log('[chat route] 🔍 Request body received:', {
      hasId: !!json.id,
      hasMessage: !!json.message,
      hasSelectedSources: !!json.selectedSources,
      selectedSources: json.selectedSources,
      messageId: json.message?.id,
      messageContent: json.message?.content?.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });
    requestBody = postRequestBodySchema.parse(json);
    console.log('[chat route] ✅ Schema validation passed');
  } catch (error) {
    console.error('[chat route] ❌ Schema validation failed:', {
      error: error instanceof Error ? error.message : String(error),
      errorDetails: error,
      timestamp: new Date().toISOString()
    });
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType, selectedLanguage, selectedSources } =
      requestBody;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('[chat route] Invalid chat ID format:', { id });
      return new ChatSDKError('bad_request:api', 'Invalid chat ID format').toResponse();
    }

    // Try API key authentication first, then session authentication
    let user: any = null;
    let userType: UserType = 'guest';
    
    const apiAuth = await authenticateApiRequest(request);
    if (apiAuth) {
      user = apiAuth.user;
      userType = 'regular'; // API key users are treated as regular users
    } else {
      const session = await auth();
      if (!session?.user) {
        return new ChatSDKError('unauthorized:chat').toResponse();
      }
      user = session.user;
      userType = session.user.type;
    }

    const messageCount = await getMessageCountByUserId({
      id: user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      console.log('[chat route] Attempting to save new chat:', {
        id,
        userId: user.id,
        title,
        visibility: selectedVisibilityType,
        titleLength: title?.length,
        userIdType: typeof user.id,
        idType: typeof id,
        visibilityType: typeof selectedVisibilityType
      });

      try {
        await saveChat({
          id,
          userId: user.id,
          title,
          visibility: selectedVisibilityType,
        });
        console.log('[chat route] Chat saved successfully');
      } catch (saveChatError) {
        console.error('[chat route] Failed to save chat:', {
          error: saveChatError,
          errorMessage: saveChatError instanceof Error ? saveChatError.message : 'Unknown error',
          errorStack: saveChatError instanceof Error ? saveChatError.stack : undefined,
          chatData: {
            id,
            userId: user.id,
            title,
            visibility: selectedVisibilityType
          }
        });
        throw saveChatError;
      }
    } else {
      if (chat.userId !== user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    // Log the user request details
    console.log('[chat route] User request details:', {
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
      console.log('[chat route] Message parts:', message.parts.map(part => ({
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
      console.log('[chat route] Message content (legacy):', {
        contentLength: message.content.length,
        contentPreview: message.content.substring(0, 100) + '...'
      });
    }

    console.log('[chat route] Extracted user message content:', {
      totalLength: userMessageContent.length,
      contentPreview: userMessageContent.substring(0, 200) + '...',
      fullContent: userMessageContent // Full content for debugging
    });

    // Log attachments if any
    if (message.experimental_attachments && message.experimental_attachments.length > 0) {
      console.log('[chat route] Message attachments:', message.experimental_attachments.map(att => ({
        name: att.name,
        contentType: att.contentType,
        url: att.url
      })));
    }

    // Log the final messages array that will be sent to AI
    console.log('[chat route] Final messages array for AI:', {
      totalMessages: messages.length,
      lastMessage: messages[messages.length - 1],
      messagesPreview: messages.map(msg => ({
        role: msg.role,
        contentLength: typeof msg.content === 'string' ? msg.content.length : 'N/A',
        partsCount: msg.parts ? msg.parts.length : 0
      }))
    });

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
      
      console.log('[chat route] Vector search context:', {
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
    console.log('[chat route] 🔍 Vector search check:', {
      isVectorSearchEnabled,
      hasMessageId: !!messageId,
      shouldPerformVectorSearch: isVectorSearchEnabled && !messageId,
      environment: process.env.NODE_ENV,
      enableVectorSearchEnv: process.env.ENABLE_VECTOR_SEARCH
    });
    
    if (isVectorSearchEnabled && !messageId) {
      console.log('[chat route] 🚀 Starting automatic vector search execution');
      
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
      
      console.log('[chat route] Vector search context:', {
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
        console.log('[chat route] 🔍 Calling performVectorSearchWithProgress with selectedSources:', selectedSources);
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
        console.log('[chat route] Storing filtered citations in messageContextMap:', {
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
        console.error('[chat route] ❌ Automatic vector search failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        console.error('Automatic vector search failed:', error);
        // Continue without vector search on error
      }
    }

    if (messageId && messageContextMap.has(messageId)) {
      // Build context block from stored citations
      const allContexts = getContextByMessageId(messageId);
      console.log('[chat route] Found citations in messageContextMap:', {
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
      
      console.log('[chat route] Citation breakdown:', {
        classic: classicContexts.length,
        modern: modernContexts.length,
        risale: risaleContexts.length,
        youtube: youtubeContexts.length,
        fatwa: fatwaContexts.length,
        total: totalCitations
      });
      
      if (totalCitations === 0) {
        console.log('[chat route] No citations found, using no-citations prompt');
        // Use completely different prompt for zero citations
        const noCitationsPrompt = `

GENERAL KNOWLEDGE RESPONSE MODE:
You are responding based on general Islamic knowledge without access to specific scholarly sources or citations for this particular question.

🔴 LANGUAGE COMPLIANCE MANDATORY 🔴
- If a specific language is required, you MUST write your ENTIRE response in that language
- ALL disclaimers, explanations, and content must be in the specified language
- Do NOT mix languages or use English if another language is specified

IMPORTANT DISCLAIMERS TO INCLUDE:
- Begin your response by acknowledging: "Based on general Islamic knowledge..."
- Emphasize that this response lacks specific scholarly citations and may have reduced accuracy
- Recommend consulting qualified Islamic scholars, local imams, or authentic Islamic sources for authoritative guidance
- Suggest that the user verify this information with reliable Islamic authorities

RESPONSE GUIDELINES:
- Provide helpful general information based on widely accepted Islamic principles
- Be honest about the limitations of your response
- Do NOT use any [CIT] references or citation numbers
- Do NOT claim to have specific sources when you don't
- Maintain a humble and cautious tone about the reliability of the information
- Focus on well-established, commonly accepted Islamic teachings
- Avoid controversial or disputed matters where possible

TRUSTWORTHINESS NOTICE:
- Clearly indicate that this response has reduced trustworthiness due to lack of specific citations
- Encourage the user to seek verification from qualified Islamic authorities
- Remind them that for important religious matters, consulting scholars is always preferable

Remember: Honesty about limitations is more valuable than false confidence. Guide the user toward authoritative sources while providing what general help you can.${languageInstruction}`;

        // Use the no-citations prompt instead of the regular context
        modifiedSystemPrompt = modifiedSystemPrompt + noCitationsPrompt;
      } else {
        console.log('[chat route] Using citations-based prompt with', totalCitations, 'citations');
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
      console.log('[chat route] No messageId or messageContextMap entry found:', {
        messageId: undefined,
        hasMessageId: false,
        hasContextMapEntry: false,
        contextMapSize: 0
      });
      // No vector search context available - use general knowledge prompt
      const noCitationsPrompt = `

GENERAL KNOWLEDGE RESPONSE MODE:
You are responding based on general Islamic knowledge without access to specific scholarly sources or citations for this particular question.

🔴 LANGUAGE COMPLIANCE MANDATORY 🔴
- If a specific language is required, you MUST write your ENTIRE response in that language
- ALL disclaimers, explanations, and content must be in the specified language
- Do NOT mix languages or use English if another language is specified

IMPORTANT DISCLAIMERS TO INCLUDE:
- Begin your response by acknowledging: "Based on general Islamic knowledge..."
- Emphasize that this response lacks specific scholarly citations and may have reduced accuracy
- Recommend consulting qualified Islamic scholars, local imams, or authentic Islamic sources for authoritative guidance
- Suggest that the user verify this information with reliable Islamic authorities

RESPONSE GUIDELINES:
- Provide helpful general information based on widely accepted Islamic principles
- Be honest about the limitations of your response
- Do NOT use any [CIT] references or citation numbers
- Do NOT claim to have specific sources when you don't
- Maintain a humble and cautious tone about the reliability of the information
- Focus on well-established, commonly accepted Islamic teachings
- Avoid controversial or disputed matters where possible

TRUSTWORTHINESS NOTICE:
- Clearly indicate that this response has reduced trustworthiness due to lack of specific citations
- Encourage the user to seek verification from qualified Islamic authorities
- Remind them that for important religious matters, consulting scholars is always preferable

Remember: Honesty about limitations is more valuable than false confidence. Guide the user toward authoritative sources while providing what general help you can.${languageInstruction}`;

      // Use the no-citations prompt when no vector search context is available
      modifiedSystemPrompt = modifiedSystemPrompt + noCitationsPrompt;
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
            // Log what we're sending to the AI model
            console.log('[chat route] Sending to AI model:', {
              model: selectedChatModel,
              systemPromptLength: modifiedSystemPrompt.length,
              systemPromptPreview: modifiedSystemPrompt.substring(0, 300) + '...',
              messagesCount: messages.length,
              lastUserMessage: messages[messages.length - 1],
              hasVectorSearchContext: !!messageId,
              languageInstruction: languageInstruction || 'None'
            });

            // Log the full system prompt for debugging (can be commented out in production)
            console.log('[chat route] Full system prompt:', modifiedSystemPrompt);

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
                if (user?.id) {
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
                if (user?.id) {
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
