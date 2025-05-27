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
        // Log metadata keys for classical sources
        if (indexName === CLASSIC_INDEX_NAME && m.metadata) {
          console.log(`[vector-search.ts] Classic source metadata keys (before any processing):`, Object.keys(m.metadata));
          // Log the actual structure to see if some fields are outside metadata
          // console.log(`[vector-search.ts] Classic source full match structure keys:`, Object.keys(m));
          if (i === 0 && indexName === CLASSIC_INDEX_NAME) { // Ensure logging only for classic for this detailed log
            // console.log(`[vector-search.ts] First classic source full data (raw match):`, JSON.stringify(m, null, 2));
            // console.log(`[vector-search.ts] First classic metadata.text (raw match):`, m.metadata.text ? m.metadata.text.substring(0, 100) + '...' : 'NO RAW METADATA.TEXT');
          }
        }
        
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

        if (indexName === CLASSIC_INDEX_NAME && i === 0) {
            // console.log(`[vector-search.ts] First classic source fullMetadata (after merge):`, JSON.stringify(fullMetadata, null, 2));
            // console.log(`[vector-search.ts] First classic final textContent:`, textContent ? textContent.substring(0,100) + '...' : 'NO FINAL TEXT');
        }

        return {
          text: textContent,
          metadata: fullMetadata,
          id: m.id || `unknown-id-${i+1}`,
          score: m.score,
          query: query
        };
      })
      .filter((mappedMatch) => { // New filter for specific classic sources
        if (indexName === CLASSIC_INDEX_NAME && mappedMatch.metadata) {
          const metadataKeys = Object.keys(mappedMatch.metadata);
          const specificKeys = ['answer', 'question', 'text'];

          const hasExactlySpecificKeys =
              metadataKeys.length === specificKeys.length &&
              specificKeys.every(key => metadataKeys.includes(key));

          if (hasExactlySpecificKeys) {
            // This means metadata ONLY contains 'answer', 'question', 'text'
            // and importantly, it implies it's missing 'source_file' or other distinguishing fields for a valid CLS.
            console.log(`[vector-search.ts] 🗑️ Filtering out classic citation due to minimal metadata (only answer, question, text):`, {id: mappedMatch.id, metadataKeys});
            return false; // Filter out
          }
        }
        return true; // Keep otherwise
      })
      .filter((m) => {
        // Use a lower threshold for classical sources since they tend to have lower scores
        const scoreThreshold = indexName === CLASSIC_INDEX_NAME ? 0.25 : 0.4;
        const passesFilter = m.text && m.score && m.score >= scoreThreshold;
        
        if (indexName === CLASSIC_INDEX_NAME && !passesFilter) {
          console.log(`[vector-search.ts] Classic source filtered out:`, {
            id: m.id,
            hasText: !!m.text,
            textLength: m.text ? m.text.length : 0,
            score: m.score,
            passesScoreThreshold: m.score >= scoreThreshold
          });
        }
        return passesFilter;
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
        console.log(`[buildContextBlock] 🚫 Blocking classic citation with minimal metadata from context:`, {
          id: ctx.id,
          metadataKeys
        });
        return false;
      }
    }
    return true;
  });
  
  console.log(`[buildContextBlock] Citation counts - Classic: ${filteredClassic.length} (was ${classic.length}), Modern: ${modern.length}, Risale: ${risale.length}, YouTube: ${youtube.length}`);
  
  let contextBlock = 'IMPORTANT: You MUST cite at least one context passage in every answer, using [CITn] (for example, [CIT1], [CIT2], etc). If you do not cite, your answer is incomplete and invalid. Do not answer without using [CITn] citations. If a paragraph or statement can be supported by several context passages, add multiple citations separated by commas, like [CIT3], [CIT4], etc.';
  contextBlock += ' When you use several [CITn] in a row, always separate them with commas (e.g., [CIT1], [CIT2], [CIT3], etc.). Place a comma after each [CITn] except the last in the sequence.';
  contextBlock += ' Mention as many citations as possible wherever relevant. If information is supported by several sources, explicitly emphasize this in your answer. Do your best to base your answer on as many different sources as possible—the more sources, the better.\n\n';
  contextBlock += 'You are an expert assistant. Use ONLY the provided context to answer the question. When you use information from a context chunk, cite it in your answer using [CITn]. Only use information you can cite. Your entire answer MUST be valid HTML (not markdown). Do NOT use markdown syntax. Output only HTML.\n\n';
  contextBlock += 'CONTEXT TYPES:\n';
  contextBlock += '- [CLS]: Classical sources (primary, most authoritative)\n';
  contextBlock += '- [RIS]: Risale-i Nur and related works (secondary)\n';
  contextBlock += '- [MOD]: Modern sources (tertiary)\n';
  contextBlock += '- [YT]: Popular YouTube scholars (complementary)\n\n';
  contextBlock += 'HIERARCHY: Always prioritize [CLS] context first, then [RIS], then [MOD], then [YT].\n\n';
  contextBlock += 'Write your answer as several paragraphs, not as a single block of text.\n\n';
  contextBlock += 'Relevant context from knowledge base:\n\n';
  
  let i = 0;
  filteredClassic.forEach((ctx) => {
    contextBlock += `[CIT${++i}][CLS] ${ctx.text}\n\n`;
  });
  risale.forEach((ctx) => {
    contextBlock += `[CIT${++i}][RIS] ${ctx.text}\n\n`;
  });
  modern.forEach((ctx) => {
    contextBlock += `[CIT${++i}][MOD] ${ctx.text}\n\n`;
  });
  youtube.forEach((ctx) => {
    contextBlock += `[CIT${++i}][YT] ${ctx.text}\n\n`;
  });
  
  contextBlock += 'Citations:\n';
  i = 0;
  filteredClassic.forEach((ctx) => {
    contextBlock += `[CIT${++i}][CLS] ID: ${ctx.id}`;
    if (ctx.metadata?.block_id) contextBlock += `, block_id: ${ctx.metadata.block_id}`;
    if (ctx.metadata?.end_page) contextBlock += `, end_page: ${ctx.metadata.end_page}`;
    contextBlock += '\n';
  });
  risale.forEach((ctx) => {
    contextBlock += `[CIT${++i}][RIS] ID: ${ctx.id}`;
    if (ctx.metadata?.block_id) contextBlock += `, block_id: ${ctx.metadata.block_id}`;
    if (ctx.metadata?.end_page) contextBlock += `, end_page: ${ctx.metadata.end_page}`;
    contextBlock += '\n';
  });
  modern.forEach((ctx) => {
    contextBlock += `[CIT${++i}][MOD] ID: ${ctx.id}`;
    if (ctx.metadata?.block_id) contextBlock += `, block_id: ${ctx.metadata.block_id}`;
    if (ctx.metadata?.end_page) contextBlock += `, end_page: ${ctx.metadata.end_page}`;
    contextBlock += '\n';
  });
  youtube.forEach((ctx) => {
    contextBlock += `[CIT${++i}][YT] ID: ${ctx.id}`;
    if (ctx.metadata?.source) contextBlock += `, source: ${ctx.metadata.source}`;
    if (ctx.metadata?.title) contextBlock += `, title: ${ctx.metadata.title}`;
    if (ctx.namespace) contextBlock += `, channel: ${ctx.namespace}`;
    contextBlock += '\n';
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
    console.log('OpenAI response content:', content);
    const result = JSON.parse(content);
    console.log('Parsed result:', result);
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
    console.log('Extracted queries:', queries);
    // Ensure exactly 3 queries
    if (!queries || queries.length === 0) {
      console.log('No queries found, using fallback');
      queries = [query, query, query];
    } else if (queries.length === 1) {
      console.log('Only 1 query found, duplicating');
      queries = [queries[0], queries[0], queries[0]];
    } else if (queries.length === 2) {
      console.log('Only 2 queries found, adding original');
      queries = [queries[0], queries[1], query];
    } else if (queries.length > 3) {
      console.log('More than 3 queries found, trimming');
      queries = queries.slice(0, 3);
    }
    
    // Additional validation: check if all queries are identical
    const uniqueQueries = [...new Set(queries)];
    if (uniqueQueries.length === 1) {
      console.warn('All queries are identical, attempting to create variations');
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
    console.error('Error improving queries - Full error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
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
  // Step 1: Query improvement
  if (onProgress) {
    onProgress({ step: 1 });
  }
  
  const improvedQueries = await improveUserQueries(userMessage, conversationHistory, selectedChatModel);
  
  if (onProgress) {
    onProgress({ step: 1, improvedQueries });
  }
  
  // Step 2: Vector searches
  if (onProgress) {
    onProgress({ step: 2, improvedQueries });
  }
  
  let classicContexts: VectorSearchResult[] = [];
  let modernContexts: VectorSearchResult[] = [];
  let risaleContexts: VectorSearchResult[] = [];
  let youtubeContexts: VectorSearchResult[] = [];

  try {
    const classicResults = await Promise.all(
      improvedQueries.map(q => getTopKContext(CLASSIC_INDEX_NAME, q, 2))
    );
    console.log('[vector-search.ts] Raw classicResults from Promise.all:', classicResults.map(arr => 
      arr.map(r => ({
        id: r.id,
        metadataKeys: r.metadata ? Object.keys(r.metadata) : [],
        hasAllFields: r.metadata ? Object.keys(r.metadata).length === 13 : false
      }))
    ));
    
    const modernResults = await Promise.all(
      improvedQueries.map(q => getTopKContext(MODERN_INDEX_NAME, q, 2))
    );
    console.log('[vector-search.ts] Raw modernResults from Promise.all:', modernResults.map(arr => 
      arr.map(r => ({
        id: r.id,
        metadataKeys: r.metadata ? Object.keys(r.metadata) : [],
        firstFewCharsOfText: r.text ? r.text.substring(0, 50) + '...' : 'NO TEXT'
      }))
    ));
    const risaleResults = await Promise.all(
      improvedQueries.map(q => getTopKContextAllNamespaces(RISALENUR_INDEX_NAME, RISALENUR_NAMESPACES, q, 2))
    );
    const youtubeResults = await Promise.all(
      improvedQueries.map(q => getTopKContextAllNamespaces(YOUTUBE_INDEX_NAME, YOUTUBE_NAMESPACES, q, 2))
    );

    // Deduplicate by id
    const dedup = (arr: VectorSearchResult[][], type: string): VectorSearchResult[] => {
      console.log(`[vector-search.ts] Before dedup - ${type} results count:`, arr.flat().length);
      
      const flattened = arr.flat();
      const deduplicated = Object.values(
        Object.fromEntries(
          flattened.map((x: VectorSearchResult) => [x.id, x])
        )
      );
      
      console.log(`[vector-search.ts] After dedup - ${type} results count:`, deduplicated.length);
      
      // Apply the same filter here to ensure consistency
      if (type === 'Classic') {
        const filtered = deduplicated.filter((citation) => {
          if (citation.metadata) {
            const metadataKeys = Object.keys(citation.metadata);
            const specificKeys = ['answer', 'question', 'text'];
            const hasExactlySpecificKeys =
                metadataKeys.length === specificKeys.length &&
                specificKeys.every(key => metadataKeys.includes(key));
            
            if (hasExactlySpecificKeys) {
              console.log(`[vector-search.ts] 🗑️ Filtering out classic citation in dedup (only answer/question/text):`, {
                id: citation.id,
                metadataKeys
              });
              return false;
            }
          }
          return true;
        });
        console.log(`[vector-search.ts] After filtering in dedup - Classic results count:`, filtered.length);
        return filtered;
      }
      
      return deduplicated;
    };

    classicContexts = dedup(classicResults, 'Classic');
    modernContexts = dedup(modernResults, 'Modern');
    risaleContexts = dedup(risaleResults, 'Risale');
    youtubeContexts = dedup(youtubeResults, 'YouTube');
    
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
  } catch (err) {
    console.error('Error during Pinecone/OpenAI vector search:', err);
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