import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'http://localhost:3001';

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
async function getEmbedding(text: string): Promise<number[]> {
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
      throw new Error(`Embedding service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.success || !data.embedding) {
      console.error('[vector-search] Invalid embedding response:', data);
      throw new Error('Invalid embedding response');
    }

    console.log(`[vector-search] Successfully received embedding with ${data.embedding.length} dimensions`);
    return data.embedding;
  } catch (error) {
    console.error('Error getting embedding from Railway service:', error);
    console.error('Service URL:', RAILWAY_EMBEDDING_SERVICE_URL);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function improveUserQueries(
  query: string, 
  history: string,
  selectedChatModel: string
): Promise<string[]> {
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
      throw new Error(`Query improvement service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.success || !data.improvedQueries) {
      console.error('[vector-search] Invalid query improvement response:', data);
      throw new Error('Invalid query improvement response');
    }

    console.log('[vector-search] Improved queries from Railway service:', {
      originalQuery: query,
      historyLength: history.length,
      improvedQueries: data.improvedQueries
    });

    return data.improvedQueries;
  } catch (error) {
    console.error('Error improving queries via Railway service:', error);
    console.error('Service URL:', RAILWAY_EMBEDDING_SERVICE_URL);
    console.error('Falling back to original query repeated 3 times');
    return [query, query, query]; // fallback to 3x original
  }
}

async function getTopKContext(
  indexName: string, 
  query: string, 
  k = 2
): Promise<VectorSearchResult[]> {
  console.log(`[vector-search] 🔍 Starting search in index: ${indexName}`, {
    query: query.substring(0, 100) + '...',
    k,
    timestamp: new Date().toISOString()
  });

  try {
    // Get embedding for the query using Railway service
    console.log(`[vector-search] 🧮 Getting embedding for query in ${indexName}`);
    const queryEmbedding = await getEmbedding(query);
    
    console.log(`[vector-search] ✅ Embedding received for ${indexName}:`, {
      embeddingLength: queryEmbedding.length,
      embeddingPreview: queryEmbedding.slice(0, 5)
    });

    // Query Pinecone
    console.log(`[vector-search] 📊 Querying Pinecone index: ${indexName}`);
    const index = pinecone.index(indexName);
    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK: k * 2, // Retrieve more results to account for filtering
      includeMetadata: true,
      includeValues: false,
    });

    console.log(`[vector-search] ✅ Pinecone query completed for ${indexName}:`, {
      matchesCount: searchResponse.matches?.length || 0,
      topScores: searchResponse.matches?.slice(0, 3).map(m => m.score) || []
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
        
        // Ensure textContent is populated if it was in fullMetadata after merge
        if (!textContent && fullMetadata.text) {
          textContent = fullMetadata.text;
        }

        return {
          text: textContent,
          metadata: fullMetadata,
          id: m.id || `unknown-id-${i+1}`,
          score: m.score,
          query: query
        };
      });

    console.log(`[vector-search] 🔄 Mapped ${mappedResults.length} results for ${indexName}`);

    const filteredResults = mappedResults
      .filter((mappedMatch) => { // Filter for specific classic sources
        if (indexName === CLASSIC_INDEX_NAME && mappedMatch.metadata) {
          const metadataKeys = Object.keys(mappedMatch.metadata);
          const specificKeys = ['answer', 'question', 'text'];

          const hasExactlySpecificKeys =
              metadataKeys.length === specificKeys.length &&
              specificKeys.every(key => metadataKeys.includes(key));

          if (hasExactlySpecificKeys) {
            return false; // Filter out
          }
        }
        return true; // Keep otherwise
      })
      .filter((m) => {
        // Use a lower threshold for classical sources since they tend to have lower scores
        const scoreThreshold = indexName === CLASSIC_INDEX_NAME ? 0.25 : 0.4;
        return m.text && m.score && m.score >= scoreThreshold;
      })
      .slice(0, k);

    console.log(`[vector-search] ✅ Search completed for ${indexName}:`, {
      initialMatches: searchResponse.matches?.length || 0,
      afterMapping: mappedResults.length,
      afterFiltering: filteredResults.length,
      finalResults: filteredResults.length,
      scoreRange: filteredResults.length > 0 ? 
        `${Math.min(...filteredResults.map(r => r.score || 0)).toFixed(3)} - ${Math.max(...filteredResults.map(r => r.score || 0)).toFixed(3)}` : 
        'N/A'
    });

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
  k = 2
): Promise<VectorSearchResult[]> {
  console.log(`[vector-search] 🔍 Starting namespace search in index: ${indexName}`, {
    query: query.substring(0, 100) + '...',
    namespacesCount: namespaces.length,
    namespaces: namespaces.slice(0, 3), // Show first 3 namespaces
    k,
    timestamp: new Date().toISOString()
  });

  try {
    console.log(`[vector-search] 🧮 Getting embedding for namespace search in ${indexName}`);
    const queryEmbedding = await getEmbedding(query);
    
    console.log(`[vector-search] ✅ Embedding received for namespace search:`, {
      embeddingLength: queryEmbedding.length,
      indexName
    });

    // Run queries in parallel for all namespaces
    console.log(`[vector-search] ⚡ Running parallel queries across ${namespaces.length} namespaces in ${indexName}`);
    const results = await Promise.all(
      namespaces.map(async (namespace, i) => {
        console.log(`[vector-search] 📋 Querying namespace ${i + 1}/${namespaces.length}: ${namespace} in ${indexName}`);
        
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
            .filter(m => m.text && m.score && m.score >= 0.4);
          
          console.log(`[vector-search] ✅ Namespace ${namespace} search completed:`, {
            matches: searchResponse.matches?.length || 0,
            filtered: namespaceResults.length,
            topScore: namespaceResults.length > 0 ? namespaceResults[0].score?.toFixed(3) : 'N/A'
          });
          
          return namespaceResults;
        } catch (namespaceError) {
          console.error(`[vector-search] ❌ Error in namespace ${namespace}:`, {
            error: namespaceError instanceof Error ? namespaceError.message : String(namespaceError),
            namespace,
            indexName
          });
          return [];
        }
      })
    );

    console.log(`[vector-search] 📊 All namespace queries completed for ${indexName}:`, {
      namespacesQueried: namespaces.length,
      resultsPerNamespace: results.map(r => r.length),
      totalResultsBeforeSort: results.flat().length
    });

    // Flatten and sort by score
    const allMatches = results.flat();
    allMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const finalResults = allMatches.slice(0, k);
    
    console.log(`[vector-search] ✅ Namespace search completed for ${indexName}:`, {
      totalMatches: allMatches.length,
      finalResults: finalResults.length,
      scoreRange: finalResults.length > 0 ? 
        `${Math.min(...finalResults.map(r => r.score || 0)).toFixed(3)} - ${Math.max(...finalResults.map(r => r.score || 0)).toFixed(3)}` : 
        'N/A',
      namespacesWithResults: results.filter(r => r.length > 0).length
    });
    
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
  // Filter classic citations one more time to be absolutely sure
  const filteredClassic = classic.filter((ctx) => {
    if (ctx.metadata) {
      const metadataKeys = Object.keys(ctx.metadata);
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
  
  // Limit citations to reduce token usage - max 3 per category
  const limitedClassic = filteredClassic.slice(0, 3);
  const limitedRisale = risale.slice(0, 3);
  const limitedModern = modern.slice(0, 2);
  const limitedYoutube = youtube.slice(0, 2);
  const limitedFatwa = fatwa.slice(0, 2);
  
  let contextBlock = 'IMPORTANT: Cite sources using [CITn] format. Use HTML output only.\n\n';
  contextBlock += 'Context types: [CLS]=Classical, [RIS]=Risale-i Nur, [MOD]=Modern, [YT]=YouTube, [FAT]=Fatwa Sites\n';
  contextBlock += 'Priority: [CLS] > [RIS] > [FAT] > [MOD] > [YT]\n\n';
  contextBlock += 'Context:\n\n';
  
  let i = 0;
  limitedClassic.forEach((ctx) => {
    // Truncate very long texts to reduce tokens
    const text = ctx.text.length > 800 ? ctx.text.substring(0, 800) + '...' : ctx.text;
    contextBlock += `[CIT${++i}][CLS] ${text}\n\n`;
  });
  limitedRisale.forEach((ctx) => {
    const text = ctx.text.length > 800 ? ctx.text.substring(0, 800) + '...' : ctx.text;
    contextBlock += `[CIT${++i}][RIS] ${text}\n\n`;
  });
  limitedFatwa.forEach((ctx) => {
    const text = ctx.text.length > 600 ? ctx.text.substring(0, 600) + '...' : ctx.text;
    contextBlock += `[CIT${++i}][FAT] ${text}\n\n`;
  });
  limitedModern.forEach((ctx) => {
    const text = ctx.text.length > 600 ? ctx.text.substring(0, 600) + '...' : ctx.text;
    contextBlock += `[CIT${++i}][MOD] ${text}\n\n`;
  });
  limitedYoutube.forEach((ctx) => {
    const text = ctx.text.length > 600 ? ctx.text.substring(0, 600) + '...' : ctx.text;
    contextBlock += `[CIT${++i}][YT] ${text}\n\n`;
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
  selectedSources?: SourceSelection
): Promise<{
  classicContexts: VectorSearchResult[];
  modernContexts: VectorSearchResult[];
  risaleContexts: VectorSearchResult[];
  youtubeContexts: VectorSearchResult[];
  fatwaContexts: VectorSearchResult[];
}> {
  // Default to all sources if not specified
  const sources = selectedSources || {
    classic: true,
    modern: true,
    risale: true,
    youtube: true,
    fatwa: true,
  };

  console.log('[vector-search] 🔄 Starting parallel vector searches:', {
    improvedQueriesCount: improvedQueries.length,
    queries: improvedQueries.map(q => q.substring(0, 50) + '...'),
    selectedSources: sources,
    timestamp: new Date().toISOString()
  });

  try {
    // Create all search promises in parallel based on selected sources
    console.log('[vector-search] 📋 Creating search promises for selected indexes and namespaces');
    const allSearchPromises: Promise<VectorSearchResult[]>[] = [];

    // Classic searches for all queries (if enabled)
    if (sources.classic) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          console.log(`[vector-search] 📚 Creating classic search promise ${i + 1}/${improvedQueries.length} for query: ${q.substring(0, 50)}...`);
          return getTopKContext(CLASSIC_INDEX_NAME, q, 2);
        })
      );
    }

    // Modern searches removed - not needed

    // Risale searches for all queries (if enabled)
    if (sources.risale) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          console.log(`[vector-search] 📖 Creating Risale search promise ${i + 1}/${improvedQueries.length} for query: ${q.substring(0, 50)}...`);
          return getTopKContextAllNamespaces(RISALENUR_INDEX_NAME, RISALENUR_NAMESPACES, q, 2);
        })
      );
    }

    // YouTube searches for all queries (if enabled)
    if (sources.youtube) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          console.log(`[vector-search] 🎥 Creating YouTube search promise ${i + 1}/${improvedQueries.length} for query: ${q.substring(0, 50)}...`);
          return getTopKContextAllNamespaces(YOUTUBE_INDEX_NAME, YOUTUBE_NAMESPACES, q, 2);
        })
      );
    }

    // Fatwa searches for all queries (if enabled)
    if (sources.fatwa) {
      allSearchPromises.push(
        ...improvedQueries.map((q, i) => {
          console.log(`[vector-search] ⚖️ Creating Fatwa search promise ${i + 1}/${improvedQueries.length} for query: ${q.substring(0, 50)}...`);
          return getTopKContextAllNamespaces(FATWA_INDEX_NAME, FATWA_NAMESPACES, q, 2);
        })
      );
    }

    console.log('[vector-search] ⚡ Executing all searches in parallel:', {
      totalPromises: allSearchPromises.length,
      expectedResults: improvedQueries.length * 5,
      timestamp: new Date().toISOString()
    });

    // Execute all searches in parallel
    const allResults = await Promise.all(allSearchPromises);
    
    console.log('[vector-search] ✅ All parallel searches completed:', {
      totalResults: allResults.length,
      resultLengths: allResults.map(r => r.length),
      timestamp: new Date().toISOString()
    });
    
    // Split results back into categories based on enabled sources
    const numQueries = improvedQueries.length;
    console.log('[vector-search] 📊 Splitting results into categories:', {
      numQueries,
      totalResults: allResults.length,
      enabledSources: Object.entries(sources).filter(([_, enabled]) => enabled).map(([name, _]) => name)
    });
    
    let resultIndex = 0;
    const classicResults = sources.classic ? allResults.slice(resultIndex, resultIndex += numQueries) : [];
    const modernResults: VectorSearchResult[][] = []; // Modern removed - empty array
    const risaleResults = sources.risale ? allResults.slice(resultIndex, resultIndex += numQueries) : [];
    const youtubeResults = sources.youtube ? allResults.slice(resultIndex, resultIndex += numQueries) : [];
    const fatwaResults = sources.fatwa ? allResults.slice(resultIndex, resultIndex += numQueries) : [];

    console.log('[vector-search] 📈 Results split by category:', {
      classic: classicResults.length,
      modern: modernResults.length,
      risale: risaleResults.length,
      youtube: youtubeResults.length,
      fatwa: fatwaResults.length
    });

    // Deduplicate by id
    console.log('[vector-search] 🔄 Starting deduplication process');
    const dedup = (arr: VectorSearchResult[][], type: string): VectorSearchResult[] => {
      const flattened = arr.flat();
      console.log(`[vector-search] 📋 Deduplicating ${type}:`, {
        beforeFlattening: arr.length,
        afterFlattening: flattened.length,
        uniqueIds: new Set(flattened.map(x => x.id)).size
      });
      
      const deduplicated = Object.values(
        Object.fromEntries(
          flattened.map((x: VectorSearchResult) => [x.id, x])
        )
      );
      
      console.log(`[vector-search] ✅ ${type} deduplication complete:`, {
        before: flattened.length,
        after: deduplicated.length,
        removed: flattened.length - deduplicated.length
      });
      
      // Apply the same filter for classic sources
      if (type === 'Classic') {
        const beforeFilter = deduplicated.length;
        const filtered = deduplicated.filter((citation) => {
          if (citation.metadata) {
            const metadataKeys = Object.keys(citation.metadata);
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
        
        console.log(`[vector-search] 🔍 Classic sources filtered:`, {
          before: beforeFilter,
          after: filtered.length,
          filtered: beforeFilter - filtered.length
        });
        
        return filtered;
      }
      
      return deduplicated;
    };

    const finalResults = {
      classicContexts: dedup(classicResults, 'Classic'),
      modernContexts: dedup(modernResults, 'Modern'),
      risaleContexts: dedup(risaleResults, 'Risale'),
      youtubeContexts: dedup(youtubeResults, 'YouTube'),
      fatwaContexts: dedup(fatwaResults, 'Fatwa')
    };

    console.log('[vector-search] 🎉 Parallel vector searches completed successfully:', {
      classic: finalResults.classicContexts.length,
      modern: finalResults.modernContexts.length,
      risale: finalResults.risaleContexts.length,
      youtube: finalResults.youtubeContexts.length,
      fatwa: finalResults.fatwaContexts.length,
      total: finalResults.classicContexts.length + finalResults.modernContexts.length + 
             finalResults.risaleContexts.length + finalResults.youtubeContexts.length + 
             finalResults.fatwaContexts.length,
      timestamp: new Date().toISOString()
    });

    return finalResults;
    
  } catch (error) {
    console.error('[vector-search] ❌ Error in parallel vector searches:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      improvedQueriesCount: improvedQueries.length,
      timestamp: new Date().toISOString()
    });
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
  onProgress?: (progress: any) => void
): Promise<{
  messageId: string;
  citations: VectorSearchResult[];
  improvedQueries: string[];
  contextBlock: string;
}> {
  console.log('[vector-search] 🚀 Starting vector search with progress:', {
    userMessage: userMessage.substring(0, 100) + '...',
    conversationHistoryLength: conversationHistory.length,
    selectedChatModel,
    selectedSources: selectedSources,
    selectedSourcesType: typeof selectedSources,
    selectedSourcesKeys: selectedSources ? Object.keys(selectedSources) : 'null',
    hasProgressCallback: !!onProgress,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    railwayServiceUrl: RAILWAY_EMBEDDING_SERVICE_URL
  });

  // Step 1: Query improvement and vector searches in parallel
  console.log('[vector-search] 📝 Step 1: Starting query improvement');
  if (onProgress) {
    console.log('[vector-search] 📡 Sending progress update - Step 1');
    onProgress({ step: 1 });
  }
  
  try {
    // Run query improvement and vector searches in parallel
    console.log('[vector-search] 🔄 Running query improvement in parallel');
    const [improvedQueries, searchResults] = await Promise.all([
      improveUserQueries(userMessage, conversationHistory, selectedChatModel),
      // We'll run the searches after we get the improved queries, but we can prepare the embedding
      Promise.resolve(null)
    ]);
    
    console.log('[vector-search] ✅ Query improvement completed:', {
      originalQuery: userMessage.substring(0, 50) + '...',
      improvedQueriesCount: improvedQueries.length,
      improvedQueries: improvedQueries.map(q => q.substring(0, 50) + '...')
    });
    
    if (onProgress) {
      console.log('[vector-search] 📡 Sending progress update - Step 1 with improved queries');
      onProgress({ step: 1, improvedQueries });
    }
    
    // Step 2: Vector searches with improved queries
    console.log('[vector-search] 🔍 Step 2: Starting vector searches');
    if (onProgress) {
      console.log('[vector-search] 📡 Sending progress update - Step 2');
      onProgress({ step: 2, improvedQueries });
    }
    
    console.log('[vector-search] 🔄 Performing all vector searches in parallel');
    const { classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts } = 
      await performAllVectorSearches(improvedQueries, selectedSources);
    
    console.log('[vector-search] ✅ Vector searches completed:', {
      classicCount: classicContexts.length,
      modernCount: modernContexts.length,
      risaleCount: risaleContexts.length,
      youtubeCount: youtubeContexts.length,
      fatwaCount: fatwaContexts.length,
      totalResults: classicContexts.length + modernContexts.length + risaleContexts.length + youtubeContexts.length + fatwaContexts.length
    });
    
    // Send search results count
    const searchResultsCount = {
      classic: classicContexts.length,
      modern: modernContexts.length,
      risale: risaleContexts.length,
      youtube: youtubeContexts.length,
      fatwa: fatwaContexts.length
    };
    
    if (onProgress) {
      console.log('[vector-search] 📡 Sending progress update - Step 2 with search results');
      onProgress({
        step: 2,
        improvedQueries,
        searchResults: searchResultsCount
      });
    }

    // Generate messageId and store context
    console.log('[vector-search] 🆔 Generating message ID and storing context');
    const messageId = uuidv4();
    const allContexts = [...classicContexts, ...modernContexts, ...risaleContexts, ...youtubeContexts, ...fatwaContexts];
    messageContextMap.set(messageId, allContexts);
    
    console.log('[vector-search] 💾 Context stored:', {
      messageId,
      totalContexts: allContexts.length,
      contextMapSize: messageContextMap.size
    });

    // Build context block
    console.log('[vector-search] 🏗️ Building context block');
    const contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts, fatwaContexts);
    
    console.log('[vector-search] ✅ Context block built:', {
      contextBlockLength: contextBlock.length,
      contextBlockPreview: contextBlock.substring(0, 200) + '...'
    });

    // Step 3: Ready to generate response
    console.log('[vector-search] ⚡ Step 3: Ready to generate response');
    if (onProgress) {
      console.log('[vector-search] 📡 Sending progress update - Step 3');
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
    
    console.log('[vector-search] 🎉 Vector search completed successfully:', {
      messageId,
      citationsCount: allContexts.length,
      improvedQueriesCount: improvedQueries.length,
      contextBlockLength: contextBlock.length,
      timestamp: new Date().toISOString()
    });

    return result;
    
  } catch (error) {
    console.error('[vector-search] ❌ Error in vector search process:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userMessage: userMessage.substring(0, 100),
      selectedChatModel,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function performVectorSearch(
  userMessage: string,
  conversationHistory: string,
  selectedChatModel: string,
  selectedSources?: SourceSelection
): Promise<{
  messageId: string;
  citations: VectorSearchResult[];
  improvedQueries: string[];
  contextBlock: string;
}> {
  return performVectorSearchWithProgress(userMessage, conversationHistory, selectedChatModel, selectedSources);
}

export function getContextByMessageId(messageId: string): any[] {
  return messageContextMap.get(messageId) || [];
} 