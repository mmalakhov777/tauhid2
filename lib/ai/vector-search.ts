import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMBED_MODEL = 'text-embedding-3-large';

// Index names
const CLASSIC_INDEX_NAME = process.env.PINECONE_CLASSIC_INDEX || 'cls-books';
const MODERN_INDEX_NAME = process.env.PINECONE_MODERN_INDEX || 'islamqadtaset';
const RISALENUR_INDEX_NAME = process.env.PINECONE_RISALE_INDEX || 'risale';
const YOUTUBE_INDEX_NAME = process.env.PINECONE_YOUTUBE_INDEX || 'yt-db';

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

// Initialize clients
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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

async function getTopKContext(
  indexName: string, 
  query: string, 
  k = 2
): Promise<VectorSearchResult[]> {
  try {
    // Get embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Query Pinecone
    const index = pinecone.index(indexName);
    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK: k * 2, // Retrieve more results to account for filtering
      includeMetadata: true,
      includeValues: false,
    });

    // Extract and filter results
    return (searchResponse.matches || [])
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
      })
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
  } catch (error) {
    console.error(`Error querying index ${indexName}:`, error);
    return [];
  }
}

async function getTopKContextAllNamespaces(
  indexName: string, 
  namespaces: string[], 
  query: string, 
  k = 2
): Promise<VectorSearchResult[]> {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Run queries in parallel for all namespaces
    const results = await Promise.all(
      namespaces.map(async (namespace) => {
        const index = pinecone.index(indexName).namespace(namespace);
        const searchResponse = await index.query({
          vector: queryEmbedding,
          topK: k * 2,
          includeMetadata: true,
          includeValues: false,
        });
        return (searchResponse.matches || [])
          .map((m: any, i: number) => ({
            text: m.metadata?.text || '',
            metadata: m.metadata,
            id: m.id || `unknown-id-${i+1}`,
            namespace,
            score: m.score,
            query: query
          }))
          .filter(m => m.text && m.score && m.score >= 0.4);
      })
    );

    // Flatten and sort by score
    const allMatches = results.flat();
    allMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return allMatches.slice(0, k);
  } catch (error) {
    console.error(`Error querying namespaces in ${indexName}:`, error);
    return [];
  }
}

export function buildContextBlock(
  classic: VectorSearchResult[],
  modern: VectorSearchResult[],
  risale: VectorSearchResult[],
  youtube: VectorSearchResult[]
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
  
  let contextBlock = 'IMPORTANT: Cite sources using [CITn] format. Use HTML output only.\n\n';
  contextBlock += 'Context types: [CLS]=Classical, [RIS]=Risale-i Nur, [MOD]=Modern, [YT]=YouTube\n';
  contextBlock += 'Priority: [CLS] > [RIS] > [MOD] > [YT]\n\n';
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
  limitedModern.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  limitedYoutube.forEach((ctx) => {
    contextBlock += `[CIT${++i}] ${ctx.id}\n`;
  });
  contextBlock += '\n';
  
  return contextBlock;
}

export async function improveUserQueries(
  query: string, 
  history: string,
  selectedChatModel: string
): Promise<string[]> {
  try {
    const prompt = `Given the following conversation history, generate exactly 3 improved versions of the last user question. 
Each improved query MUST be truly distinct in meaning, focus, or angle—not just rephrasings or minor variations. 
For example, you can:
- Ask for a definition in one, a practical example in another, and a historical background in a third.
- Change the scope: one broad, one narrow, one comparative.
- Change the perspective: one theological, one legal, one social.

Do NOT simply reword the same question. Each query should explore a different aspect, subtopic, or interpretation of the user's question, or approach it from a different angle or intent. 
Each should be fully self-contained, avoid ambiguous pronouns, and be as different as possible while still being relevant to the original question.

ALSO, make each query as compact and concise as possible, using the minimum words needed to be clear and specific.

Return ONLY the improved questions as a JSON array of exactly 3 strings. If you cannot generate 3, repeat or split the original question to reach 3.

Conversation history:
${history}

Last user question:
${query}`;

    // Use OpenAI for query improvement
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);
    let queries: string[] = [];
    
    // Handle various response formats
    if (Array.isArray(result)) {
      queries = result;
    } else if (result.queries && Array.isArray(result.queries)) {
      queries = result.queries;
    } else if (result.questions && Array.isArray(result.questions)) {
      queries = result.questions;
    } else if (typeof result === 'object') {
      // Handle numeric keys like {"1": "query1", "2": "query2", "3": "query3"}
      const numericKeys = Object.keys(result).filter(key => /^\d+$/.test(key)).sort();
      if (numericKeys.length > 0) {
        queries = numericKeys.map(key => result[key]);
      }
    }
    
    // Ensure exactly 3 queries
    if (!queries || queries.length === 0) {
      queries = [query, query, query];
    } else if (queries.length === 1) {
      queries = [queries[0], queries[0], queries[0]];
    } else if (queries.length === 2) {
      queries = [queries[0], queries[1], query];
    } else if (queries.length > 3) {
      queries = queries.slice(0, 3);
    }
    
    // Additional validation: check if all queries are identical
    const uniqueQueries = [...new Set(queries)];
    if (uniqueQueries.length === 1) {
      // Create simple variations if all queries are the same
      const baseQuery = queries[0].trim();
      queries = [
        baseQuery,
        `What are the benefits of ${baseQuery.toLowerCase().replace('?', '')}?`,
        `Can you explain ${baseQuery.toLowerCase().replace('?', '')} in detail?`
      ];
    }
    
    return queries;
  } catch (error) {
    console.error('Error improving queries:', error);
    return [query, query, query]; // fallback to 3x original
  }
}

export function buildConversationHistory(messages: any[]): string {
  let history = '';
  for (const msg of messages.slice(0, -1)) {
    if (msg.role === 'user') {
      history += `User: ${msg.content}\n`;
    } else if (msg.role === 'assistant') {
      history += `Assistant: ${msg.content}\n`;
    }
  }
  return history.trim();
}

// Optimized function with parallel processing
async function performAllVectorSearches(improvedQueries: string[]): Promise<{
  classicContexts: VectorSearchResult[];
  modernContexts: VectorSearchResult[];
  risaleContexts: VectorSearchResult[];
  youtubeContexts: VectorSearchResult[];
}> {
  // Create all search promises in parallel
  const allSearchPromises = [
    // Classic searches for all queries
    ...improvedQueries.map(q => getTopKContext(CLASSIC_INDEX_NAME, q, 2)),
    // Modern searches for all queries
    ...improvedQueries.map(q => getTopKContext(MODERN_INDEX_NAME, q, 2)),
    // Risale searches for all queries
    ...improvedQueries.map(q => getTopKContextAllNamespaces(RISALENUR_INDEX_NAME, RISALENUR_NAMESPACES, q, 2)),
    // YouTube searches for all queries
    ...improvedQueries.map(q => getTopKContextAllNamespaces(YOUTUBE_INDEX_NAME, YOUTUBE_NAMESPACES, q, 2))
  ];

  // Execute all searches in parallel
  const allResults = await Promise.all(allSearchPromises);
  
  // Split results back into categories
  const numQueries = improvedQueries.length;
  const classicResults = allResults.slice(0, numQueries);
  const modernResults = allResults.slice(numQueries, numQueries * 2);
  const risaleResults = allResults.slice(numQueries * 2, numQueries * 3);
  const youtubeResults = allResults.slice(numQueries * 3, numQueries * 4);

  // Deduplicate by id
  const dedup = (arr: VectorSearchResult[][], type: string): VectorSearchResult[] => {
    const flattened = arr.flat();
    const deduplicated = Object.values(
      Object.fromEntries(
        flattened.map((x: VectorSearchResult) => [x.id, x])
      )
    );
    
    // Apply the same filter for classic sources
    if (type === 'Classic') {
      return deduplicated.filter((citation) => {
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
    }
    
    return deduplicated;
  };

  return {
    classicContexts: dedup(classicResults, 'Classic'),
    modernContexts: dedup(modernResults, 'Modern'),
    risaleContexts: dedup(risaleResults, 'Risale'),
    youtubeContexts: dedup(youtubeResults, 'YouTube')
  };
}

export async function performVectorSearchWithProgress(
  userMessage: string,
  conversationHistory: string,
  selectedChatModel: string,
  onProgress?: (progress: any) => void
): Promise<{
  messageId: string;
  citations: VectorSearchResult[];
  improvedQueries: string[];
  contextBlock: string;
}> {
  // Step 1: Query improvement and vector searches in parallel
  if (onProgress) {
    onProgress({ step: 1 });
  }
  
  // Run query improvement and vector searches in parallel
  const [improvedQueries, searchResults] = await Promise.all([
    improveUserQueries(userMessage, conversationHistory, selectedChatModel),
    // We'll run the searches after we get the improved queries, but we can prepare the embedding
    Promise.resolve(null)
  ]);
  
  if (onProgress) {
    onProgress({ step: 1, improvedQueries });
  }
  
  // Step 2: Vector searches with improved queries
  if (onProgress) {
    onProgress({ step: 2, improvedQueries });
  }
  
  const { classicContexts, modernContexts, risaleContexts, youtubeContexts } = 
    await performAllVectorSearches(improvedQueries);
  
  // Send search results count
  if (onProgress) {
    onProgress({
      step: 2,
      improvedQueries,
      searchResults: {
        classic: classicContexts.length,
        modern: modernContexts.length,
        risale: risaleContexts.length,
        youtube: youtubeContexts.length
      }
    });
  }

  // Generate messageId and store context
  const messageId = uuidv4();
  const allContexts = [...classicContexts, ...modernContexts, ...risaleContexts, ...youtubeContexts];
  messageContextMap.set(messageId, allContexts);

  // Build context block
  const contextBlock = buildContextBlock(classicContexts, modernContexts, risaleContexts, youtubeContexts);

  // Step 3: Ready to generate response
  if (onProgress) {
    onProgress({
      step: 3,
      improvedQueries,
      searchResults: {
        classic: classicContexts.length,
        modern: modernContexts.length,
        risale: risaleContexts.length,
        youtube: youtubeContexts.length
      }
    });
  }

  return {
    messageId,
    citations: allContexts,
    improvedQueries,
    contextBlock
  };
}

export async function performVectorSearch(
  userMessage: string,
  conversationHistory: string,
  selectedChatModel: string
): Promise<{
  messageId: string;
  citations: VectorSearchResult[];
  improvedQueries: string[];
  contextBlock: string;
}> {
  return performVectorSearchWithProgress(userMessage, conversationHistory, selectedChatModel);
}

export function getContextByMessageId(messageId: string): any[] {
  return messageContextMap.get(messageId) || [];
} 