import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';
import { Langfuse, LangfuseTraceClient } from "langfuse";

// Environment variables
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'http://localhost:3001';

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

// Add validation for production
if (process.env.NODE_ENV === 'production' && !process.env.RAILWAY_EMBEDDING_SERVICE_URL) {
  console.error('RAILWAY_EMBEDDING_SERVICE_URL is required in production but not set');
}

// Log the service URL being used (without exposing sensitive info)
console.log(`[vector-search] Using embedding service: ${RAILWAY_EMBEDDING_SERVICE_URL.includes('localhost') ? 'localhost' : 'external service'}`);

// Index names
const CLASSIC_INDEX_NAME = process.env.PINECONE_CLASSIC_INDEX || 'cls-books';
const MODERN_INDEX_NAME = process.env.PINECONE_MODERN_INDEX || 'islamqadtaset';
const RISALENUR_INDEX_NAME = process.env.PINECONE_RISALE_INDEX || 'risale';
const YOUTUBE_INDEX_NAME = process.env.PINECONE_YOUTUBE_INDEX || 'yt-db';
const FATWA_INDEX_NAME = process.env.PINECONE_FATWA_INDEX || 'fatwa-sites';

// Namespaces
const RISALENUR_NAMESPACES = [
  'Sozler-Bediuzzaman_Said_Nursi',
  'Mektubat-Bediuzzaman_Said_Nursi',
  'lemalar-bediuzzaman_said_nursi',
  'Hasir_Risalesi-Bediuzzaman_Said_Nursi',
  'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi',
  'Hastalar_Risalesi-Bediuzzaman_Said_Nursi',
  'ihlas_risaleleri-bediuzzaman_said_nursi',
  'enne_ve_zerre_risalesi-bediuzzaman_said_nursi',
  'tabiat_risalesi-bediuzzaman_said_nursi',
  'kader_risalesi-bediuzzaman_said_nursi'
];

const YOUTUBE_NAMESPACES = [
  '4455',
  'Islam_The_Ultimate_Peace',
  '2238',
  'Islamic_Guidance',
  '2004',
  'MercifulServant',
  '1572',
  'Towards_Eternity'
];

const FATWA_NAMESPACES = [
  'fatwa-collection'
];

// Initialize clients
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

// Per-message context store
export const messageContextMap = new Map<string, any[]>();

export interface VectorSearchResult {
  text: string;
  metadata: any;
  id: string;
  score?: number;
  namespace?: string;
  query?: string;
}

// Railway embedding service functions
async function getEmbedding(text: string, parentTrace?: LangfuseTraceClient): Promise<number[]> {
  const span = parentTrace?.span({
    name: "get-embedding",
    input: { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') },
    metadata: { service: "railway-embedding" }
  });

  try {
    console.log(`[vector-search] Requesting embedding from: ${RAILWAY_EMBEDDING_SERVICE_URL}/embed`);
    
    const response = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    console.log(`[vector-search] Embedding service response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[vector-search] Embedding service error: ${response.status} - ${errorText}`);
      safeTrace(() => span?.update({ 
        output: { error: `${response.status} - ${errorText}` }
      }));
      throw new Error(`Embedding service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.success || !data.embedding) {
      console.error('[vector-search] Invalid embedding response:', data);
      safeTrace(() => span?.update({ 
        output: { error: "Invalid embedding response" }
      }));
      throw new Error('Invalid embedding response');
    }

    console.log(`[vector-search] Successfully received embedding with ${data.embedding.length} dimensions`);
    safeTrace(() => span?.update({ 
      output: { dimensions: data.embedding.length, success: true }
    }));
    return data.embedding;
  } catch (error) {
    console.error('Error getting embedding from Railway service:', error);
    console.error('Service URL:', RAILWAY_EMBEDDING_SERVICE_URL);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    safeTrace(() => span?.update({ 
      output: { error: error instanceof Error ? error.message : String(error) }
    }));
    throw error;
  }
}

async function improveUserQueries(
  query: string, 
  history: string,
  selectedChatModel: string,
  parentTrace?: LangfuseTraceClient
): Promise<string[]> {
  const span = parentTrace?.span({
    name: "improve-user-queries",
    input: { 
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      historyLength: history.length,
      selectedChatModel 
    },
    metadata: { service: "railway-embedding" }
  });

  try {
    console.log(`[vector-search] Requesting query improvement from: ${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`);
    
    const response = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query, 
        history, 
        selectedChatModel 
      }),
    });

    console.log(`[vector-search] Query improvement service response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[vector-search] Query improvement service error: ${response.status} - ${errorText}`);
      safeTrace(() => span?.update({ 
        output: { error: `${response.status} - ${errorText}`, fallback: true }
      }));
      throw new Error(`Query improvement service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.success || !data.improvedQueries) {
      console.error('[vector-search] Invalid query improvement response:', data);
      safeTrace(() => span?.update({ 
        output: { error: "Invalid query improvement response", fallback: true }
      }));
      throw new Error('Invalid query improvement response');
    }

    console.log('[vector-search] Improved queries from Railway service:', {
      originalQuery: query,
      historyLength: history.length,
      improvedQueries: data.improvedQueries
    });

    safeTrace(() => span?.update({ 
      output: { 
        improvedQueries: data.improvedQueries,
        count: data.improvedQueries.length,
        success: true 
      }
    }));

    return data.improvedQueries;
  } catch (error) {
    console.error('Error improving queries via Railway service:', error);
    console.error('Service URL:', RAILWAY_EMBEDDING_SERVICE_URL);
    console.error('Falling back to original query repeated 3 times');
    
    const fallbackQueries = [query, query, query];
    safeTrace(() => span?.update({ 
      output: { 
        error: error instanceof Error ? error.message : String(error),
        fallbackQueries,
        fallback: true 
      }
    }));
    
    return fallbackQueries; // fallback to 3x original
  }
}

// Helper function to create a unique identifier for a source/book
function getSourceIdentifier(result: VectorSearchResult): string | null {
  if (!result.metadata || !result.metadata.source_file) return null;
  
  // Use only source_file field to identify the book
  return String(result.metadata.source_file).toLowerCase().trim();
}

async function getTopKContext(
  indexName: string, 
  query: string, 
  k = 10,
  parentTrace?: LangfuseTraceClient
): Promise<VectorSearchResult[]> {
  try {
    const queryEmbedding = await getEmbedding(query, parentTrace);
    const index = pinecone.index(indexName);
    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK: k * 2, // Retrieve more results to account for filtering
      includeMetadata: true,
      includeValues: false,
    });

    // Extract and filter results
    const mappedResults = (searchResponse.matches || [])
      .map((m: any, i: number) => {
        let fullMetadata = { ...(m.metadata || {}) };
        let textContent = fullMetadata.text || "";

        if (indexName === CLASSIC_INDEX_NAME) {
          const topLevelFieldsToConsider = [
            'answer', 'question', 'text', 'block_id', 'block_num', 
            'end_page', 'interpretation', 'modern_usage', 'original_text', 
            'source', 'source_file', 'start_page', 'volume'
          ];

          topLevelFieldsToConsider.forEach(field => {
            if (m[field] !== undefined) {
              if (fullMetadata[field] === undefined) {
                fullMetadata[field] = m[field];
              }
              if (field === 'text' && !textContent && m[field]) {
                textContent = m[field];
              }
            }
          });
        }
        
        // Use ONLY original_text field
        textContent = fullMetadata.original_text || "";

        return {
          text: textContent,
          metadata: fullMetadata,
          id: m.id || `unknown-id-${i+1}`,
          score: m.score,
          query: query
        };
      });



    const filteredResults = mappedResults
      .filter((m, index) => {
        // Use the same threshold for all sources
        const scoreThreshold = 0.4;
        return m.text && m.score && m.score >= scoreThreshold;
      })
      .filter((result, index, array) => {
        // Filter out duplicates from the same book/source
        const seenSources = new Set<string>();
        return array.slice(0, index + 1).every((r, i) => {
          if (i === index) return true; // Always include current item for comparison
          
          // Create a unique identifier for the source/book
          const currentSource = getSourceIdentifier(result);
          const otherSource = getSourceIdentifier(r);
          
          if (currentSource && otherSource && currentSource === otherSource) {
            return false; // Filter out duplicate from same source
          }
          return true;
        });
      })
      .slice(0, k);

    return filteredResults;
  } catch (error) {
    console.error(`[vector-search] ❌ Error querying index ${indexName}:`, {
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 100),
      k,
      timestamp: new Date().toISOString()
    });
    return [];
  }
}

async function getTopKContextAllNamespaces(
  indexName: string, 
  namespaces: string[], 
  query: string, 
  k = 10,
  parentTrace?: LangfuseTraceClient
): Promise<VectorSearchResult[]> {
  try {
    const queryEmbedding = await getEmbedding(query, parentTrace);
    const results = await Promise.all(
      namespaces.map(async (namespace, i) => {
        try {
          const index = pinecone.index(indexName).namespace(namespace);
          const searchResponse = await index.query({
            vector: queryEmbedding,
            topK: k * 2,
            includeMetadata: true,
            includeValues: false,
          });
          
          const namespaceResults = (searchResponse.matches || [])
            .map((m: any, j: number) => ({
              text: m.metadata?.text || '',
              metadata: m.metadata,
              id: m.id || `unknown-id-${j+1}`,
              namespace,
              score: m.score,
              query: query
            }))
            .filter(m => m.text && m.score && m.score >= 0.4)
            .filter((result, index, array) => {
              // Filter out duplicates from the same book/source within this namespace
              return array.slice(0, index).every(r => {
                const currentSource = getSourceIdentifier(result);
                const otherSource = getSourceIdentifier(r);
                
                if (currentSource && otherSource && currentSource === otherSource) {
                  return false; // Filter out duplicate from same source
                }
                return true;
              });
            });
          
          return namespaceResults;
        } catch (namespaceError) {
          return [];
        }
      })
    );

    // Flatten and sort by score
    const allMatches = results.flat();
    allMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const finalResults = allMatches.slice(0, k);
    
    return finalResults;
  } catch (error) {
    console.error(`[vector-search] ❌ Error querying namespaces in ${indexName}:`, {
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 100),
      namespacesCount: namespaces.length,
      timestamp: new Date().toISOString()
    });
    return [];
  }
}

export function buildContextBlock(
  classic: VectorSearchResult[],
  modern: VectorSearchResult[],
  risale: VectorSearchResult[],
  youtube: VectorSearchResult[],
  fatwa: VectorSearchResult[]
): string {
  // No additional filtering needed - use all results as-is
  const filteredClassic = classic;
  
  // Use ALL citations without any limits
  const limitedClassic = filteredClassic;
  const limitedRisale = risale;
  const limitedModern = modern;
  const limitedYoutube = youtube;
  const limitedFatwa = fatwa;
  
  let contextBlock = 'IMPORTANT: Cite sources using [CITn] format. Use HTML output only.\n\n';
  contextBlock += 'Context types: [CLS]=Classical, [RIS]=Risale-i Nur, [MOD]=Modern, [YT]=YouTube, [FAT]=Fatwa Sites\n';
  contextBlock += 'Priority: [CLS] > [RIS] > [FAT] > [MOD] > [YT]\n\n';
  contextBlock += 'Context:\n\n';
  
  let i = 0;
  limitedClassic.forEach((ctx) => {
    // Use full text without truncation
    contextBlock += `[CIT${++i}][CLS] ${ctx.text}\n\n`;
  });
  limitedRisale.forEach((ctx) => {
    // Use full text without truncation
    contextBlock += `[CIT${++i}][RIS] ${ctx.text}\n\n`;
  });
  limitedFatwa.forEach((ctx) => {
    // Use full text without truncation
    contextBlock += `[CIT${++i}][FAT] ${ctx.text}\n\n`;
  });
  limitedModern.forEach((ctx) => {
    // Use full text without truncation
    contextBlock += `[CIT${++i}][MOD] ${ctx.text}\n\n`;
  });
  limitedYoutube.forEach((ctx) => {
    // Use full text without truncation
    contextBlock += `[CIT${++i}][YT] ${ctx.text}\n\n`;
  });
  
  // Simplified citation metadata
  contextBlock += 'Sources:\n';
  i = 0;
  limitedClassic.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  limitedRisale.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  limitedFatwa.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  limitedModern.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  limitedYoutube.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  contextBlock += '\n';
  
  return contextBlock;
}

export function buildConversationHistory(messages: any[]): string {
  let history = '';
  // Include ALL messages, including the current one
  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      // Extract text from parts array (messages have parts, not direct content)
      let text = '';
      if (msg.parts && Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
          if (part.type === 'text' && part.text) {
            text += part.text;
          }
        }
      } else if (msg.content) {
        // Fallback for older message format
        text = msg.content;
      }
      
      if (text) {
        history += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${text}\n\n`;
      }
    }
  }
  return history.trim();
}

// Optimized function with parallel processing
async function performAllVectorSearches(
  improvedQueries: string[], 
  selectedSources?: SourceSelection,
  parentTrace?: LangfuseTraceClient
): Promise<{
  classicContexts: VectorSearchResult[];
  modernContexts: VectorSearchResult[];
  risaleContexts: VectorSearchResult[];
  youtubeContexts: VectorSearchResult[];
  fatwaContexts: VectorSearchResult[];
}> {
  const span = parentTrace?.span({
    name: "perform-all-vector-searches",
    input: { 
      improvedQueriesCount: improvedQueries.length,
      selectedSources 
    },
    metadata: { 
      searchType: "parallel-vector-search"
    }
  });

  // Default to all sources if not specified
  const sources = selectedSources || {
    classic: true,
    modern: true,
    risale: true,
    youtube: true,
    fatwa: true,
  };

  try {
    const allSearchPromises: Promise<VectorSearchResult[]>[] = [];

    // Classic searches for all queries (if enabled)
    if (sources.classic) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          return getTopKContext(CLASSIC_INDEX_NAME, q, 50, parentTrace);
        })
      );
    }

    // Risale searches for all queries (if enabled)
    if (sources.risale) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          return getTopKContextAllNamespaces(RISALENUR_INDEX_NAME, RISALENUR_NAMESPACES, q, 5, parentTrace);
        })
      );
    }

    // YouTube searches for all queries (if enabled)
    if (sources.youtube) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          return getTopKContextAllNamespaces(YOUTUBE_INDEX_NAME, YOUTUBE_NAMESPACES, q, 5, parentTrace);
        })
      );
    }

    // Fatwa searches for all queries (if enabled)
    if (sources.fatwa) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          return getTopKContextAllNamespaces(FATWA_INDEX_NAME, FATWA_NAMESPACES, q, 5, parentTrace);
        })
      );
    }

    // Execute all searches in parallel
    const allResults = await Promise.all(allSearchPromises);
    
    // Split results back into categories based on enabled sources
    const numQueries = improvedQueries.length;
    let resultIndex = 0;
    const classicResults = sources.classic ? allResults.slice(resultIndex, resultIndex += numQueries) : [];
    const modernResults: VectorSearchResult[][] = []; // Modern removed - empty array
    const risaleResults = sources.risale ? allResults.slice(resultIndex, resultIndex += numQueries) : [];
    const youtubeResults = sources.youtube ? allResults.slice(resultIndex, resultIndex += numQueries) : [];
    const fatwaResults = sources.fatwa ? allResults.slice(resultIndex, resultIndex += numQueries) : [];

    // Deduplicate by id and also by metadata.original_text
    const dedup = (arr: VectorSearchResult[][], type: string): VectorSearchResult[] => {
      const flattened = arr.flat();
      
      // First deduplicate by id
      let deduplicated = Object.values(
        Object.fromEntries(
          flattened.map((x: VectorSearchResult) => [x.id, x])
        )
      );

      // Then deduplicate by metadata.original_text if present
      const seenOriginalText = new Set<string>();
      deduplicated = deduplicated.filter((x: VectorSearchResult) => {
        const originalText = x.metadata?.original_text;
        if (originalText && typeof originalText === 'string') {
          if (seenOriginalText.has(originalText)) {
            return false;
          }
          seenOriginalText.add(originalText);
        }
        return true;
      });
      
      return deduplicated;
    };

    const finalResults = {
      classicContexts: dedup(classicResults, 'Classic'),
      modernContexts: dedup(modernResults, 'Modern'),
      risaleContexts: dedup(risaleResults, 'Risale'),
      youtubeContexts: dedup(youtubeResults, 'YouTube'),
      fatwaContexts: dedup(fatwaResults, 'Fatwa')
    };

    // Compact stats
    console.log('[vector-search] Results:', {
      CLS: finalResults.classicContexts.length,
      RIS: finalResults.risaleContexts.length,
      YT: finalResults.youtubeContexts.length,
      FAT: finalResults.fatwaContexts.length,
      total: finalResults.classicContexts.length + finalResults.risaleContexts.length + 
             finalResults.youtubeContexts.length + finalResults.fatwaContexts.length
    });

    safeTrace(() => span?.update({ 
      output: { 
        searchResultsCount: {
          classic: finalResults.classicContexts.length,
          modern: finalResults.modernContexts.length,
          risale: finalResults.risaleContexts.length,
          youtube: finalResults.youtubeContexts.length,
          fatwa: finalResults.fatwaContexts.length
        },
        totalResults: finalResults.classicContexts.length + finalResults.risaleContexts.length + 
                     finalResults.youtubeContexts.length + finalResults.fatwaContexts.length,
        success: true
      }
    }));

    return finalResults;
    
  } catch (error) {
    console.error('[vector-search] ❌ Error in parallel vector searches:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      improvedQueriesCount: improvedQueries.length,
      timestamp: new Date().toISOString()
    });
    
    safeTrace(() => span?.update({ 
      output: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }));
    
    throw error;
  }
}

export interface SourceSelection {
  classic: boolean;
  risale: boolean;
  youtube: boolean;
  fatwa: boolean;
}

export async function performVectorSearchWithProgress(
  userMessage: string,
  conversationHistory: string,
  selectedChatModel: string,
  selectedSources?: SourceSelection,
  onProgress?: (progress: any) => void,
  parentTrace?: LangfuseTraceClient
): Promise<{
  messageId: string;
  citations: VectorSearchResult[];
  improvedQueries: string[];
  contextBlock: string;
}> {
  const span = parentTrace?.span({
    name: "vector-search-with-progress",
    input: { 
      userMessage: userMessage.substring(0, 200) + (userMessage.length > 200 ? '...' : ''),
      conversationHistoryLength: conversationHistory.length,
      selectedChatModel,
      selectedSources 
    },
    metadata: { 
      hasProgress: !!onProgress,
      timestamp: new Date().toISOString()
    }
  });

  if (onProgress) {
    onProgress({ step: 1 });
  }
  
  try {
    const improvedQueries = await improveUserQueries(userMessage, conversationHistory, selectedChatModel, parentTrace);
    
    if (onProgress) {
      onProgress({ step: 1, improvedQueries });
    }
    
    if (onProgress) {
      onProgress({ step: 2, improvedQueries });
    }
    
    const { classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts } = 
      await performAllVectorSearches(improvedQueries, selectedSources, parentTrace);
    
    // Send search results count
    const searchResultsCount = {
      classic: classicContexts.length,
      modern: modernContexts.length,
      risale: risaleContexts.length,
      youtube: youtubeContexts.length,
      fatwa: fatwaContexts.length
    };
    
    if (onProgress) {
      onProgress({
        step: 2,
        improvedQueries,
        searchResults: searchResultsCount
      });
    }

    // Generate messageId and store context
    const messageId = uuidv4();
    const allContexts = [...classicContexts, ...modernContexts, ...risaleContexts, ...youtubeContexts, ...fatwaContexts];
    messageContextMap.set(messageId, allContexts);

    // Build context block
    const contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts);

    if (onProgress) {
      onProgress({
        step: 3,
        improvedQueries,
        searchResults: searchResultsCount
      });
    }

    const result = {
      messageId,
      citations: allContexts,
      improvedQueries,
      contextBlock
    };

    safeTrace(() => span?.update({ 
      output: { 
        messageId,
        citationsCount: allContexts.length,
        improvedQueriesCount: improvedQueries.length,
        searchResultsCount,
        contextBlockLength: contextBlock.length,
        success: true
      }
    }));

    return result;
    
  } catch (error) {
    console.error('[vector-search] ❌ Error in vector search process:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userMessage: userMessage.substring(0, 100),
      selectedChatModel,
      timestamp: new Date().toISOString()
    });
    
    safeTrace(() => span?.update({ 
      output: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }));
    
    throw error;
  }
}

export async function performVectorSearch(
  userMessage: string,
  conversationHistory: string,
  selectedChatModel: string,
  selectedSources?: SourceSelection,
  parentTrace?: LangfuseTraceClient
): Promise<{
  messageId: string;
  citations: VectorSearchResult[];
  improvedQueries: string[];
  contextBlock: string;
}> {
  return performVectorSearchWithProgress(userMessage, conversationHistory, selectedChatModel, selectedSources, undefined, parentTrace);
}

export function getContextByMessageId(messageId: string): any[] {
  return messageContextMap.get(messageId) || [];
} 