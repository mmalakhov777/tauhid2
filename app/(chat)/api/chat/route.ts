import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  createDataStreamResponse,
  smoothStream,
  streamText,
  generateText,
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

// Citation categorization interface
interface CitationAnalysis {
  category: 'direct' | 'context' | 'irrelevant';
  description: string;
  reasoning: string;
  relevanceScore: number;
  originalCitation: any;
}

// Function to categorize all citations in a single LLM call
async function categorizeCitations(
  citations: any[],
  userQuestion: string,
  conversationHistory: string,
  selectedChatModel: string,
  parentTrace?: any
): Promise<CitationAnalysis[]> {
  const categorizationSpan = parentTrace?.span({
    name: "categorize-citations-batch",
    input: { 
      citationsCount: citations.length,
      userQuestion: userQuestion.substring(0, 200) + (userQuestion.length > 200 ? '...' : ''),
      conversationHistoryLength: conversationHistory.length,
      selectedChatModel
    }
  });

  if (citations.length === 0) {
    safeTrace(() => categorizationSpan?.update({ 
      output: { 
        categorizedCitations: [],
        success: true,
        reason: "No citations to categorize"
      }
    }));
    return [];
  }

  try {
    // Build citations data for analysis - using only text field
    const citationsData = citations.map((citation, index) => ({
      index: index + 1,
      text: citation.text?.substring(0, 500) + (citation.text?.length > 500 ? '...' : '')
    }));

    // Create the categorization prompt
    const categorizationPrompt = `You are an expert Islamic scholar analyzing the relevance of citations to a user's question.

TASK: Analyze ALL provided citations and categorize each one's relevance to the user's question.

CATEGORIES (3 categories):
1. DIRECT - The citation directly answers the specific question asked
2. CONTEXT - The citation provides related information, background, context, or supporting details that help understand the topic
3. IRRELEVANT - The citation does not meaningfully contribute to answering the question or understanding the topic

USER QUESTION: "${userQuestion}"

CONVERSATION HISTORY: "${conversationHistory}"

CITATIONS TO ANALYZE:
${citationsData.map(c => `
CITATION ${c.index}:
Text: "${c.text}"
`).join('\n')}

ANALYSIS REQUIREMENTS:
1. Categorize each citation as: direct, context, OR irrelevant
2. Provide a clear description (15-40 words) explaining HOW each citation relates to the user's question
3. Provide detailed reasoning (30-80 words) explaining WHY you chose this specific category
4. Assign a relevance score (0.0-1.0) where 1.0 is most relevant and 0.0 is completely irrelevant
5. Consider the conversation history for context
6. Be strict with "direct" - only use if it specifically answers the question
7. Use "irrelevant" for citations that don't meaningfully contribute to the topic

RESPONSE FORMAT (JSON array only):
[
  {
    "index": 1,
    "category": "direct",
    "description": "Brief explanation of how this citation relates to the user's question",
    "reasoning": "Detailed explanation of why this specific category was chosen based on the content analysis",
    "relevanceScore": 0.85
  },
  {
    "index": 2,
    "category": "context",
    "description": "Brief explanation of how this citation relates to the user's question",
    "reasoning": "Detailed explanation of why this specific category was chosen based on the content analysis",
    "relevanceScore": 0.65
  },
  {
    "index": 3,
    "category": "irrelevant",
    "description": "Brief explanation of why this citation is not relevant",
    "reasoning": "Detailed explanation of why this citation was deemed irrelevant to the question",
    "relevanceScore": 0.15
  }
]

Respond with ONLY the JSON array, no additional text.`;

    console.log(`[Citation Categorization] Analyzing ${citations.length} citations in batch`);

    // Use the chat model specifically for categorization (not reasoning model)
    const result = await generateText({
      model: myProvider.languageModel('chat-model'),
      messages: [
        {
          role: 'system',
          content: 'You are an expert Islamic scholar analyzing citation relevance. You MUST respond with ONLY a valid JSON array. Do not include any explanatory text, markdown formatting, or code blocks. Return only the raw JSON array starting with [ and ending with ].'
        },
        {
          role: 'user',
          content: categorizationPrompt + '\n\nIMPORTANT: Respond with ONLY the JSON array. No explanations, no markdown, no code blocks. Just the raw JSON array.'
        }
      ],
      temperature: 0.1, // Lower temperature for more consistent JSON output
      maxTokens: 2000
    });

    // Get the response text
    const responseText = result.text;

    console.log('[Citation Categorization] Raw response:', responseText.substring(0, 200) + '...');

    try {
      // Clean and validate the response text
      let cleanedResponse = responseText.trim();
      
      // Handle common issues with AI responses
      if (!cleanedResponse) {
        throw new Error('Empty response from AI model');
      }
      
      // Remove any markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
      
      // Remove any leading/trailing text that's not JSON
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      // Try to parse the JSON
      const analysisArray = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(analysisArray)) {
        throw new Error('Response is not an array');
      }

      // Convert to our format and validate
      const categorizedCitations: CitationAnalysis[] = citations.map((citation, index) => {
        const analysis = analysisArray.find(a => a.index === index + 1);
        
        if (analysis && analysis.category && analysis.description && analysis.reasoning && typeof analysis.relevanceScore === 'number') {
          const validCategories = ['direct', 'context', 'irrelevant'];
          const category = validCategories.includes(analysis.category) ? analysis.category : 'context';
          
          return {
            category: category as 'direct' | 'context' | 'irrelevant',
            description: analysis.description,
            reasoning: analysis.reasoning,
            relevanceScore: Math.max(0, Math.min(1, analysis.relevanceScore)),
            originalCitation: citation
          };
        } else {
          // Fallback for missing or invalid analysis
          return {
            category: 'context' as const,
            description: 'Unable to analyze relevance - classified as context',
            reasoning: 'Analysis failed or incomplete response from categorization model',
            relevanceScore: citation.score || 0.5,
            originalCitation: citation
          };
        }
      });

      // Calculate category distribution
      const categoryDistribution = {
        direct: categorizedCitations.filter(c => c.category === 'direct').length,
        context: categorizedCitations.filter(c => c.category === 'context').length,
        irrelevant: categorizedCitations.filter(c => c.category === 'irrelevant').length
      };

      const averageRelevanceScore = categorizedCitations.reduce((sum, c) => sum + c.relevanceScore, 0) / categorizedCitations.length;

      console.log(`[Citation Categorization] Success: ${categorizedCitations.length} citations categorized`, categoryDistribution);

      safeTrace(() => categorizationSpan?.update({ 
        output: { 
          categorizedCitations: categorizedCitations.length,
          categoryDistribution,
          averageRelevanceScore,
          success: true,
          method: 'single-llm-call'
        }
      }));

      return categorizedCitations;

    } catch (parseError) {
      console.error('[Citation Categorization] Failed to parse response:', parseError);
      console.error('[Citation Categorization] Raw response was:', responseText);
      console.error('[Citation Categorization] Response length:', responseText.length);
      console.error('[Citation Categorization] First 500 chars:', responseText.substring(0, 500));
      console.error('[Citation Categorization] Last 500 chars:', responseText.substring(Math.max(0, responseText.length - 500)));
      
      // Try one more time with a simpler approach - extract any JSON-like structure
      try {
        // Look for any array-like structure in the response
        const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          console.log('[Citation Categorization] Attempting to parse extracted array:', arrayMatch[0].substring(0, 200) + '...');
          const analysisArray = JSON.parse(arrayMatch[0]);
          if (Array.isArray(analysisArray) && analysisArray.length > 0) {
            console.log('[Citation Categorization] Successfully recovered from parsing error!');
            // Process the successfully parsed array (same logic as above)
            const categorizedCitations: CitationAnalysis[] = citations.map((citation, index) => {
              const analysis = analysisArray.find(a => a.index === index + 1);
              
              if (analysis && analysis.category && analysis.description && analysis.reasoning && typeof analysis.relevanceScore === 'number') {
                const validCategories = ['direct', 'context', 'irrelevant'];
                const category = validCategories.includes(analysis.category) ? analysis.category : 'context';
                
                return {
                  category: category as 'direct' | 'context' | 'irrelevant',
                  description: analysis.description,
                  reasoning: analysis.reasoning,
                  relevanceScore: Math.max(0, Math.min(1, analysis.relevanceScore)),
                  originalCitation: citation
                };
              } else {
                return {
                  category: 'context' as const,
                  description: 'Unable to analyze relevance - classified as context',
                  reasoning: 'Analysis failed or incomplete response from categorization model',
                  relevanceScore: citation.score || 0.5,
                  originalCitation: citation
                };
              }
            });
            
            return categorizedCitations;
          }
        }
      } catch (recoveryError) {
        console.error('[Citation Categorization] Recovery attempt also failed:', recoveryError);
      }
      
      // Fallback categorization for all citations
      const fallbackCategorizations = citations.map(citation => ({
        category: 'context' as const,
        description: 'Unable to analyze relevance - classified as context',
        reasoning: 'JSON parsing failed during categorization analysis',
        relevanceScore: citation.score || 0.5,
        originalCitation: citation
      }));

      safeTrace(() => categorizationSpan?.update({ 
        output: { 
          categorizedCitations: fallbackCategorizations.length,
          success: false,
          error: 'JSON parse error',
          fallbackUsed: true
        }
      }));

      return fallbackCategorizations;
    }

  } catch (error) {
    console.error('Error in citation categorization:', error);
    safeTrace(() => categorizationSpan?.update({ 
      output: { 
        error: error instanceof Error ? error.message : String(error),
        success: false
      }
    }));
    
    // Return fallback categorization for all citations
    return citations.map(citation => ({
      category: 'context' as const,
      description: 'Error during batch analysis - classified as context',
      reasoning: 'Exception occurred during categorization process',
      relevanceScore: citation.score || 0.5,
      originalCitation: citation
    }));
  }
}

// Function to build enhanced context block with categorization
function buildEnhancedContextBlock(
  categorizedCitations: CitationAnalysis[],
  classicContexts: any[],
  modernContexts: any[],
  risaleContexts: any[],
  youtubeContexts: any[],
  fatwaContexts: any[],
  tafsirsContexts: any[]
): string {
  if (categorizedCitations.length === 0) {
    return '';
  }

  // Group categorized citations by their original source type
  const categorizedBySource = {
    classic: categorizedCitations.filter(c => classicContexts.includes(c.originalCitation)),
    modern: categorizedCitations.filter(c => modernContexts.includes(c.originalCitation)),
    risale: categorizedCitations.filter(c => risaleContexts.includes(c.originalCitation)),
    youtube: categorizedCitations.filter(c => youtubeContexts.includes(c.originalCitation)),
    fatwa: categorizedCitations.filter(c => fatwaContexts.includes(c.originalCitation))
  };

  let contextBlock = `📚 ISLAMIC KNOWLEDGE CONTEXT WITH RELEVANCE ANALYSIS:

The following sources have been carefully analyzed and categorized for their relevance to your question:
• **DIRECT**: Sources that directly answer your specific question
• **CONTEXT**: Sources that provide related information or broader context

---

`;

  let citationIndex = 1;

  // Add each source type with categorization info
  const addSourceSection = (title: string, contexts: any[], categorized: CitationAnalysis[]) => {
    if (contexts.length === 0) return;
    
    contextBlock += `\n## ${title}:\n\n`;
    
    contexts.forEach((context, index) => {
      const analysis = categorized.find(c => c.originalCitation === context);
      const categoryLabel = analysis ? `**[${analysis.category.toUpperCase()}]**` : '**[UNCATEGORIZED]**';
      const relevanceDesc = analysis ? ` - ${analysis.description}` : '';
      const reasoning = analysis ? `\n> **Reasoning**: ${analysis.reasoning}` : '';
      
      contextBlock += `**[CIT${citationIndex}]** ${categoryLabel}${relevanceDesc}${reasoning}\n`;
      contextBlock += `${context.text}\n\n---\n\n`;
      citationIndex++;
    });
  };

  addSourceSection('CLASSIC ISLAMIC SOURCES', classicContexts, categorizedBySource.classic);
  addSourceSection('MODERN ISLAMIC SOURCES', modernContexts, categorizedBySource.modern);
  addSourceSection('RISALE-I NUR COLLECTION', risaleContexts, categorizedBySource.risale);
  addSourceSection('ISLAMIC VIDEO CONTENT', youtubeContexts, categorizedBySource.youtube);
  addSourceSection('ISLAMIC FATWA SOURCES', fatwaContexts, categorizedBySource.fatwa);

  // Add relevance summary
  const directCount = categorizedCitations.filter(c => c.category === 'direct').length;
  const contextCount = categorizedCitations.filter(c => c.category === 'context').length;

  contextBlock += `\n## 📊 RELEVANCE SUMMARY:

• **${directCount} DIRECT** sources that specifically answer your question
• **${contextCount} CONTEXT** sources providing related information and background

### 🎯 PRIORITY GUIDANCE: 
Focus primarily on **DIRECT** sources to provide the core answer, then use **CONTEXT** sources to provide comprehensive background and supporting information.`;

  return contextBlock;
}

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

      // Categorize citations to filter out irrelevant ones
      const conversationHistoryForCategorization = buildConversationHistory(messages);
      const categorizedCitations = await categorizeCitations(
        filteredCitations,
        userMessageContent,
        conversationHistoryForCategorization,
        selectedChatModel,
        mainTrace
      );

      // Filter out irrelevant citations - only keep direct and context citations
      const relevantCitations = filteredCitations.filter((citation, index) => {
        const analysis = categorizedCitations.find(c => c.originalCitation === citation);
        return analysis && analysis.category !== 'irrelevant';
      });

      console.log(`[Vector Search Only] Filtered ${filteredCitations.length} -> ${relevantCitations.length} citations (removed ${filteredCitations.length - relevantCitations.length} irrelevant)`);

      // Analyze citation sources (using only relevant citations)
      const citationAnalysis = {
        classic: relevantCitations.filter((c: any) => c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)).length,
        modern: relevantCitations.filter((c: any) => c.metadata?.type === 'modern' || c.metadata?.type === 'MOD').length,
        risale: relevantCitations.filter((c: any) => c.metadata?.type === 'risale' || c.metadata?.type === 'RIS' || (c.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi'].includes(c.namespace))).length,
        youtube: relevantCitations.filter((c: any) => c.metadata?.type === 'youtube' || c.metadata?.type === 'YT' || (c.namespace && ['youtube-qa-pairs'].includes(c.namespace))).length,
        fatwa: relevantCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT' || c.metadata?.content_type === 'islamqa_fatwa').length
      };

      const searchDuration = Date.now() - vectorSearchStartTime;

      safeTrace(() => vectorSearchSpan.update({ 
        output: { 
          messageId: searchResults.messageId,
          citationsCount: relevantCitations.length,
          citationsBySource: citationAnalysis,
          improvedQueriesCount: searchResults.improvedQueries.length,
          improvedQueries: searchResults.improvedQueries,
          searchDurationMs: searchDuration,
          averageCitationScore: relevantCitations.length > 0 ? 
            relevantCitations.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / relevantCitations.length : 0,
          topCitationScore: relevantCitations.length > 0 ? 
            Math.max(...relevantCitations.map((c: any) => c.score || 0)) : 0,
          conversationHistoryLength: conversationHistoryForCategorization.length,
          filteredOutCount: searchResults.citations.length - filteredCitations.length,
          irrelevantFilteredOut: filteredCitations.length - relevantCitations.length
        }
      }));

      const vectorSearchEndTime = Date.now();
      const vectorSearchTotalDuration = vectorSearchEndTime - startTime;
      
      safeTrace(() => mainTrace.update({ 
        output: { 
          success: true,
          type: "vector-search-only",
          messageId: searchResults.messageId,
          citationsCount: relevantCitations.length,
          citationsBySource: citationAnalysis,
          searchDurationMs: searchDuration,
          totalDurationMs: vectorSearchTotalDuration,
          endTime: vectorSearchEndTime,
          endTimestamp: new Date(vectorSearchEndTime).toISOString(),
          latencyMs: vectorSearchTotalDuration,
          durationMs: vectorSearchTotalDuration,
          irrelevantFilteredOut: filteredCitations.length - relevantCitations.length,
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
          citations: relevantCitations, // Use only relevant citations (irrelevant filtered out)
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
        
        // STEP 1: Categorize all citations in parallel
        const categorizationStartTime = Date.now();
        console.log(`[Citation Categorization] Starting parallel analysis of ${filteredCitations.length} citations`);
        
        const categorizedCitations = await categorizeCitations(
          filteredCitations,
          userMessageContent,
          conversationHistory,
          selectedChatModel,
          mainTrace
        );
        
        const categorizationDuration = Date.now() - categorizationStartTime;
        console.log(`[Citation Categorization] Completed in ${categorizationDuration}ms`);
        
        // STEP 2: Filter out irrelevant citations - only keep direct and context citations
        const relevantCitations = filteredCitations.filter((citation, index) => {
          const analysis = categorizedCitations.find(c => c.originalCitation === citation);
          return analysis && analysis.category !== 'irrelevant';
        });
        
        console.log(`[Citation Filtering] Filtered ${filteredCitations.length} -> ${relevantCitations.length} citations (removed ${filteredCitations.length - relevantCitations.length} irrelevant)`);
        
        // Update categorized citations to only include relevant ones
        const relevantCategorizedCitations = categorizedCitations.filter(c => c.category !== 'irrelevant');
        
        // STEP 3: Store enhanced citation data (only relevant citations)
        // Store only the relevant citations in messageContextMap for later use
        messageContextMap.set(messageId, relevantCitations);
        
        // Store enhanced citation metadata (only relevant citations)
        (globalThis as any).__citationAnalysisData = {
          messageId,
          categorizedCitations: relevantCategorizedCitations,
          categorizationDuration
        };
        
        // Store search results for later saving to database (using relevant citations only)
        const searchResultCounts = {
          classic: relevantCitations.filter((c: any) => c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)).length,
          modern: relevantCitations.filter((c: any) => c.metadata?.type === 'modern' || c.metadata?.type === 'MOD').length,
          risale: relevantCitations.filter((c: any) => c.metadata?.type === 'risale' || c.metadata?.type === 'RIS' || (c.namespace && ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(c.namespace))).length,
          youtube: relevantCitations.filter((c: any) => c.metadata?.type === 'youtube' || c.metadata?.type === 'YT' || (c.namespace && ['youtube-qa-pairs'].includes(c.namespace))).length,
          fatwa: relevantCitations.filter((c: any) => c.metadata?.type === 'fatwa' || c.metadata?.type === 'FAT' || c.metadata?.content_type === 'islamqa_fatwa').length
        };
        
        // Enhanced search result counts with categorization (including original irrelevant count for stats)
        const categorizationCounts = {
          direct: relevantCategorizedCitations.filter(c => c.category === 'direct').length,
          context: relevantCategorizedCitations.filter(c => c.category === 'context').length,
          irrelevant: categorizedCitations.filter(c => c.category === 'irrelevant').length // Keep original count for stats
        };
        
        // Add categorization data to relevant citations before saving
        const citationsWithCategorization = relevantCitations.map((citation, index) => {
          // Find the corresponding categorization for this citation
          const analysis = relevantCategorizedCitations.find(c => c.originalCitation === citation);
          return {
            ...citation,
            // Add categorization data to each citation
            category: analysis?.category || 'context',
            categoryDescription: analysis?.description || 'No categorization available',
            categoryReasoning: analysis?.reasoning || 'No reasoning available',
            relevanceScore: analysis?.relevanceScore || citation.score
          };
        });

        // Store vector search data to save after assistant message is created
        (globalThis as any).__vectorSearchDataToSave = {
          chatId: id,
          improvedQueries: searchResults.improvedQueries,
          citations: citationsWithCategorization, // Use only relevant citations with categorization data
          searchResultCounts,
          searchDurationMs,
          // NEW: Add categorization data
          categorizedCitations: relevantCategorizedCitations, // Only relevant citations
          categorizationCounts,
          categorizationDurationMs: categorizationDuration
        };
        
        // Add the final update with relevant citations and categorization
        vectorSearchProgressUpdates.push({
          step: 4, // Final step with all data
          improvedQueries: searchResults.improvedQueries,
          searchResults: searchResultCounts,
          citations: citationsWithCategorization, // Use only relevant categorized citations
          // NEW: Add categorization progress
          categorization: {
            total: relevantCategorizedCitations.length, // Only relevant citations count
            counts: categorizationCounts,
            durationMs: categorizationDuration,
            filteredOut: filteredCitations.length - relevantCitations.length // Show how many were filtered
          }
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
      const youtubeContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'youtube' || ctx.metadata?.type === 'YT' || (ctx.namespace && ['youtube-qa-pairs'].includes(ctx.namespace)));
      const fatwaContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'fatwa' || ctx.metadata?.type === 'FAT' || ctx.metadata?.content_type === 'islamqa_fatwa');
      const tafsirsContexts = allContexts.filter((ctx: any) => ctx.metadata?.type === 'tafsirs' || ctx.metadata?.type === 'TAF' || (ctx.namespace && ['Maarif-ul-Quran', 'Bayan-ul-Quran', 'Kashf-Al-Asrar', 'Tazkirul-Quran'].includes(ctx.namespace)));
      
              const totalCitations = classicContexts.length + modernContexts.length + risaleContexts.length + youtubeContexts.length + fatwaContexts.length + tafsirsContexts.length;
      
      if (totalCitations === 0) {
        // Use a system prompt that forces the exact fixed response
        const fixedResponsePrompt = `You must respond with exactly this message and nothing else: "Sorry I do not have enough information to provide grounded response"

Do not add any additional text, explanations, or formatting. Just return that exact message.`;
        
        modifiedSystemPrompt = fixedResponsePrompt;
      } else {
        // Get categorized citations if available
        const citationAnalysisData = (globalThis as any).__citationAnalysisData;
        const categorizedCitations = citationAnalysisData?.categorizedCitations || [];
        
        // Use enhanced context block with categorization if available
        if (categorizedCitations.length > 0) {
          contextBlock = buildEnhancedContextBlock(
            categorizedCitations,
            classicContexts,
            modernContexts,
            risaleContexts,
            youtubeContexts,
            fatwaContexts,
            tafsirsContexts
          );
        } else {
          // Fallback to original context block
          contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts, tafsirsContexts);
        }

        // Enhanced citation emphasis with modern wisdom-focused approach
        const citationEmphasis = `

🎯 MODERN ISLAMIC WISDOM COMMUNICATION FRAMEWORK:

**CITATION UTILIZATION FOR MODERN AUDIENCES:**
- You MUST use ALL available citations provided in the context (irrelevant citations have been filtered out)
- PRIORITIZE citations based on their relevance categories:
  1. DIRECT citations (highest priority) - use these as primary evidence and examples
  2. CONTEXT citations (supporting priority) - use these to build comprehensive understanding and modern applications
- Use citations as CASE STUDIES and CONCRETE EXAMPLES to demonstrate Islamic wisdom
- Build upon each citation with your own modern parallels and practical applications
- The MORE different [CIT] numbers you use in your response, the BETTER your comprehensive analysis will be

**WISDOM-FOCUSED CITATION INTEGRATION:**
- EVERY SINGLE ISLAMIC TEACHING, RULING, OR PRINCIPLE MUST BE IMMEDIATELY FOLLOWED BY A [CIT] REFERENCE
- After citing, EXPLAIN THE WISDOM: Why is this teaching so beneficial for human nature and modern life?
- Use citations as EVIDENCE, then provide LOGICAL ANALYSIS of why this wisdom works
- Create MODERN EXAMPLES that demonstrate the same principles in contemporary contexts
- Show how cited teachings address fundamental human needs: psychological well-being, social harmony, personal growth, ethical decision-making

**MANDATORY CITATION RULE - NO EXCEPTIONS:**
- Add [CIT] references DIRECTLY after EVERY Islamic claim or teaching
- Do NOT use connecting phrases like "as detailed in", "according to", etc.
- Simply place [CIT1], [CIT2] immediately after the information
- Example: "**Prayer** (*salah*) creates mental discipline and stress relief [CIT1], [CIT2]. This practice functions like modern mindfulness techniques, providing structured breaks that enhance focus and emotional regulation."
- EVERY SENTENCE that makes a claim about Islamic knowledge MUST have a citation
- Personal opinions without Islamic grounding are STRICTLY FORBIDDEN

**MODERN WISDOM ANALYSIS REQUIREMENTS:**

**PSYCHOLOGICAL & SOCIAL BENEFITS:**
- After each cited teaching, explain its impact on mental health, relationships, and productivity
- Connect Islamic wisdom to modern research in psychology, neuroscience, and social sciences
- Show how these teachings create sustainable, holistic solutions to contemporary challenges

**PRACTICAL MODERN APPLICATIONS:**
- Provide concrete examples of how cited teachings apply to modern work environments
- Demonstrate relevance to contemporary challenges: stress management, work-life balance, ethical leadership
- Create scenarios that show Islamic principles solving real-world problems

**SYSTEMS THINKING APPROACH:**
- Explain how Islamic teachings create comprehensive frameworks for human flourishing
- Show the interconnected nature of Islamic principles and their collective benefits
- Demonstrate how individual practices contribute to broader social and personal optimization

**FORMATTING FOR MODERN PROFESSIONALS:**

**STRUCTURE WITH ANALYTICAL CLARITY:**
- Use **bold text** for key concepts, Islamic terms, and main principles
- Use *italics* for Arabic terms, emphasis, and technical definitions
- Use numbered lists (1., 2., 3.) for systematic frameworks and implementation steps
- Use bullet points (•) for benefits, applications, and supporting details
- Use subheadings with ## for major analytical sections
- Use blockquotes (>) for key principles and important insights
- **MANDATORY: Translate ALL Islamic terms** - every Arabic/Islamic term must be immediately followed by translation and explanation in parentheses

**CONTENT DEPTH FOR INTELLIGENT AUDIENCES:**
- Provide ROOT CAUSE ANALYSIS: Why do Islamic teachings work so effectively?
- Include COMPARATIVE INSIGHTS: How do Islamic principles enhance or align with modern best practices?
- Offer IMPLEMENTATION GUIDANCE: Practical steps for applying these teachings in contemporary life
- Address MODERN CHALLENGES: Show how Islamic wisdom provides solutions to current societal issues
- Explain UNIVERSAL PRINCIPLES: Connect Islamic teachings to broader human values and ethical frameworks

**WISDOM-CENTERED RESPONSE STRATEGY:**
- Start with DIRECT citations to establish the Islamic foundation
- Analyze the UNDERLYING WISDOM and psychological benefits
- Provide MODERN APPLICATIONS and practical examples
- Use CONTEXT citations to build comprehensive understanding and broader implications
- Create your own examples that demonstrate the same wisdom in contemporary settings

**TONE FOR MODERN AUDIENCES:**
- Analytical and intellectually engaging
- Direct and authoritative - present knowledge as established truth, not opinion
- Practical and solution-oriented
- Clear logical progression that appeals to systematic thinking
- Encouraging and empowering rather than prescriptive

**CRITICAL: DIRECT COMMUNICATION STYLE - ZERO TOLERANCE FOR DISTANCING:**
- ABSOLUTELY FORBIDDEN: "In Islam," "from Islamic perspective," "according to Islam," "Islamic viewpoint," "Islam teaches," "Islam says," "Islamic tradition," "Muslims believe," "Islamic scholars say"
- ABSOLUTELY FORBIDDEN: Any phrase that presents this as "one religious view" or "Islamic opinion"
- NEVER use qualifying language that creates distance from the teachings
- Present teachings as DIRECT TRUTH and established principles
- Speak with complete authority about these teachings as universal wisdom
- State facts directly without any religious qualifiers or hedging language
- Treat these principles as universal truths that apply to all human beings
- Provide comprehensive, grounded responses without ANY qualifying language

**CORRECT vs WRONG EXAMPLES:**
❌ WRONG: "В Исламе мир рассматривается как..." / "In Islam, the world is viewed as..."
✅ CORRECT: "The world serves as a temporary testing ground where..." [CIT1]

❌ WRONG: "According to Islamic teachings, prayer is..."
✅ CORRECT: "Prayer is a fundamental practice that..." [CIT2]

❌ WRONG: "Muslims believe that charity purifies..."
✅ CORRECT: "Charity purifies wealth and creates social harmony..." [CIT3]

**MANDATORY ISLAMIC TERM TRANSLATION:**
- EVERY Arabic/Islamic term MUST be immediately translated and explained
- Format: **Arabic term** (*English translation and brief explanation*)
- Examples: **Salah** (*prayer - structured worship performed five times daily*), **Zakat** (*purifying charity - obligatory wealth redistribution*), **Jihad** (*struggle - personal effort toward spiritual and moral improvement*)
- Never use Islamic terms without immediate translation and context
- Make all concepts accessible to people unfamiliar with Islamic terminology

**CRITICAL: NO FAKE CITATIONS OR MODERN RESEARCH REFERENCES:**
- ABSOLUTELY FORBIDDEN: Never cite, reference, or mention modern research studies, academic papers, or contemporary scientific studies that are not provided in your context
- ABSOLUTELY FORBIDDEN: Never create fake citations like "Research by Smith (2020)" or "Studies show (Johnson, 2019)" or "Исследования посттравматического роста (Tedeschi, 2004)"
- ABSOLUTELY FORBIDDEN: Never reference psychological studies, neuroscience research, or any modern academic work unless it is explicitly provided in your available citations
- ONLY use the Islamic sources and citations that are provided to you in the context ([CIT1], [CIT2], etc.)
- If you want to connect Islamic wisdom to modern concepts, do so through logical reasoning and universal principles, NOT through citing non-existent research
- Present Islamic teachings on their own merit and wisdom, without needing validation from modern studies
- You may discuss how Islamic principles align with modern understanding, but NEVER cite specific studies or researchers that are not in your provided sources

**CORRECT vs WRONG EXAMPLES:**
❌ WRONG: "Research by Tedeschi (2004) shows that 70% of people experience post-traumatic growth..."
❌ WRONG: "Studies indicate that prayer has psychological benefits (Smith et al., 2020)..."
❌ WRONG: "Neuroscience research demonstrates that meditation improves focus (Johnson, 2019)..."
✅ CORRECT: "Prayer creates mental discipline and emotional regulation [CIT1]. This practice provides structured breaks that naturally enhance focus and reduce stress."
✅ CORRECT: "The wisdom of charity extends beyond financial giving [CIT2]. It develops empathy and social consciousness while creating community bonds."

🧠 REMEMBER: Present these teachings as sophisticated systems of human optimization, ethical frameworks, and practical wisdom that enhance both personal fulfillment and professional effectiveness. Use citations as evidence, then build comprehensive wisdom analysis with modern applications - all presented directly and authoritatively!`;

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
              model: myProvider.languageModel('chat-model-reasoning'),
              system: modifiedSystemPrompt,
              messages: messages,
              maxSteps: 5,
              temperature: 0.7, // Slightly higher for more detailed responses
              maxTokens: 4000, // Increased for longer, more detailed responses
              experimental_activeTools: [],
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
                    
                    // Map citations to their actual sources and categorization
                    const citationSourceMap: any = {};
                    const citationAnalysisData = (globalThis as any).__citationAnalysisData;
                    const categorizedCitations = citationAnalysisData?.categorizedCitations || [];
                    
                    uniqueCitations.forEach((citation: string) => {
                      const citationIndex = parseInt(citation.replace(/\[CIT(\d+)\]/, '$1')) - 1;
                      if (usedContext[citationIndex]) {
                        const analysis = categorizedCitations.find((c: any) => c.originalCitation === usedContext[citationIndex]);
                        
                        citationSourceMap[citation] = {
                          text: usedContext[citationIndex].text?.substring(0, 200) + '...',
                          metadata: usedContext[citationIndex].metadata,
                          namespace: usedContext[citationIndex].namespace,
                          score: usedContext[citationIndex].score,
                          // NEW: Add categorization data
                          category: analysis?.category || 'uncategorized',
                          categoryDescription: analysis?.description || 'No categorization available',
                          categoryReasoning: analysis?.reasoning || 'No reasoning available',
                          relevanceScore: analysis?.relevanceScore || (usedContext[citationIndex].score || 0)
                        };
                      }
                    });
                    
                    // Calculate categorization statistics for used citations
                    const usedCitationCategories = {
                      direct: 0,
                      context: 0,
                      irrelevant: 0,
                      uncategorized: 0
                    };
                    
                    Object.values(citationSourceMap).forEach((citation: any) => {
                      usedCitationCategories[citation.category as keyof typeof usedCitationCategories]++;
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
                        // NEW: Complete response with sources, categorization, and refund info
                        finalResponse: {
                          fullText: fullResponseText.substring(0, 1000) + (fullResponseText.length > 1000 ? '...' : ''),
                          citationsUsed: uniqueCitations,
                          citationCount: uniqueCitations.length,
                          citationSourceMap,
                          hasContext: usedContext.length > 0,
                          contextSourceCount: usedContext.length,
                          isInsufficientInfoResponse,
                          messageRefunded: isInsufficientInfoResponse && messageConsumed,
                          // NEW: Citation categorization data
                          citationCategorization: {
                            totalCategorized: categorizedCitations.length,
                            usedCitationCategories,
                            categorizationDuration: citationAnalysisData?.categorizationDuration || 0,
                            averageRelevanceScore: categorizedCitations.length > 0 ? 
                              categorizedCitations.reduce((sum: number, c: any) => sum + c.relevanceScore, 0) / categorizedCitations.length : 0,
                            categoryDistribution: {
                              direct: categorizedCitations.filter((c: any) => c.category === 'direct').length,
                              context: categorizedCitations.filter((c: any) => c.category === 'context').length,
                              irrelevant: categorizedCitations.filter((c: any) => c.category === 'irrelevant').length
                            }
                          }
                        }
                      }
                    }));
                    
                    // Clean up global citation analysis data
                    delete (globalThis as any).__citationAnalysisData;
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
              model: fallbackProvider.languageModel('chat-model-reasoning'),
              system: modifiedSystemPrompt,
              messages: messages,
              maxSteps: 5,
              temperature: 0.7, // Slightly higher for more detailed responses
              maxTokens: 4000, // Increased for longer, more detailed responses
              experimental_activeTools: [],
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
                    
                    // Map citations to their actual sources and categorization for fallback
                    const citationSourceMapFallback: any = {};
                    const citationAnalysisDataFallback = (globalThis as any).__citationAnalysisData;
                    const categorizedCitationsFallback = citationAnalysisDataFallback?.categorizedCitations || [];
                    
                    uniqueCitationsFallback.forEach((citation: string) => {
                      const citationIndex = parseInt(citation.replace(/\[CIT(\d+)\]/, '$1')) - 1;
                      if (usedContextFallback[citationIndex]) {
                        const analysis = categorizedCitationsFallback.find((c: any) => c.originalCitation === usedContextFallback[citationIndex]);
                        
                        citationSourceMapFallback[citation] = {
                          text: usedContextFallback[citationIndex].text?.substring(0, 200) + '...',
                          metadata: usedContextFallback[citationIndex].metadata,
                          namespace: usedContextFallback[citationIndex].namespace,
                          score: usedContextFallback[citationIndex].score,
                          // NEW: Add categorization data for fallback
                          category: analysis?.category || 'uncategorized',
                          categoryDescription: analysis?.description || 'No categorization available',
                          categoryReasoning: analysis?.reasoning || 'No reasoning available',
                          relevanceScore: analysis?.relevanceScore || (usedContextFallback[citationIndex].score || 0)
                        };
                      }
                    });
                    
                    // Calculate categorization statistics for used citations in fallback
                    const usedCitationCategoriesFallback = {
                      direct: 0,
                      context: 0,
                      irrelevant: 0,
                      uncategorized: 0
                    };
                    
                    Object.values(citationSourceMapFallback).forEach((citation: any) => {
                      usedCitationCategoriesFallback[citation.category as keyof typeof usedCitationCategoriesFallback]++;
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
                        // NEW: Complete response with sources, categorization, and refund info for fallback provider
                        finalResponse: {
                          fullText: fullResponseTextFallback.substring(0, 1000) + (fullResponseTextFallback.length > 1000 ? '...' : ''),
                          citationsUsed: uniqueCitationsFallback,
                          citationCount: uniqueCitationsFallback.length,
                          citationSourceMap: citationSourceMapFallback,
                          hasContext: usedContextFallback.length > 0,
                          contextSourceCount: usedContextFallback.length,
                          isInsufficientInfoResponse,
                          messageRefunded: isInsufficientInfoResponse && messageConsumed,
                          // NEW: Citation categorization data for fallback provider
                          citationCategorization: {
                            totalCategorized: categorizedCitationsFallback.length,
                            usedCitationCategories: usedCitationCategoriesFallback,
                            categorizationDuration: citationAnalysisDataFallback?.categorizationDuration || 0,
                            averageRelevanceScore: categorizedCitationsFallback.length > 0 ? 
                              categorizedCitationsFallback.reduce((sum: number, c: any) => sum + c.relevanceScore, 0) / categorizedCitationsFallback.length : 0,
                            categoryDistribution: {
                              direct: categorizedCitationsFallback.filter((c: any) => c.category === 'direct').length,
                              context: categorizedCitationsFallback.filter((c: any) => c.category === 'context').length,
                              irrelevant: categorizedCitationsFallback.filter((c: any) => c.category === 'irrelevant').length
                            }
                          }
                        }
                      }
                    }));
                    
                    // Clean up global citation analysis data for fallback
                    delete (globalThis as any).__citationAnalysisData;
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
