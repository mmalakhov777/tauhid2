import { expect, test } from '../fixtures';
import { generateUUID } from '@/lib/utils';

// Test configuration
const TEST_CHAT_MODEL = 'chat-model';
const TEST_VISIBILITY = 'private';

// Test queries specifically for fatwa content
const FATWA_TEST_QUERIES = [
  {
    name: 'Prayer timing question',
    query: 'What is the ruling on praying before the actual prayer time?',
    expectedType: 'fatwa'
  },
  {
    name: 'Marriage ruling question',
    query: 'Is it permissible to marry without parents consent in Islam?',
    expectedType: 'fatwa'
  },
  {
    name: 'Business transaction question',
    query: 'What is the Islamic ruling on cryptocurrency trading?',
    expectedType: 'fatwa'
  },
  {
    name: 'Worship practice question',
    query: 'Can I combine prayers when traveling?',
    expectedType: 'fatwa'
  },
  {
    name: 'Family law question',
    query: 'What are the conditions for divorce in Islamic law?',
    expectedType: 'fatwa'
  }
];

test.describe('Fatwa Vector Search Tests', () => {
  
  test('Test fatwa-sites index connectivity', async ({ adaContext }) => {
    const chatId = generateUUID();
    const messageId = generateUUID();
    
    const response = await adaContext.request.post('/api/chat', {
      data: {
        id: chatId,
        message: {
          id: messageId,
          role: 'user',
          content: FATWA_TEST_QUERIES[0].query,
          parts: [
            {
              type: 'text',
              text: FATWA_TEST_QUERIES[0].query,
            },
          ],
          createdAt: new Date().toISOString(),
        },
        selectedChatModel: TEST_CHAT_MODEL,
        selectedVisibilityType: TEST_VISIBILITY,
      },
    });

    expect(response.status()).toBe(200);
    
    // Check that the response contains data
    const responseText = await response.text();
    expect(responseText).toBeTruthy();
    expect(responseText.length).toBeGreaterThan(0);
    
    console.log('✅ Fatwa index connectivity test passed');
  });

  test('Test vector search with fatwa query parameter', async ({ adaContext }) => {
    const chatId = generateUUID();
    const messageId = generateUUID();
    
    // First, test the vector search endpoint directly
    const vectorSearchResponse = await adaContext.request.post('/api/chat?vector=1', {
      data: {
        id: chatId,
        message: {
          id: messageId,
          role: 'user',
          content: FATWA_TEST_QUERIES[1].query,
          parts: [
            {
              type: 'text',
              text: FATWA_TEST_QUERIES[1].query,
            },
          ],
          createdAt: new Date().toISOString(),
        },
        selectedChatModel: TEST_CHAT_MODEL,
        selectedVisibilityType: TEST_VISIBILITY,
      },
    });

    expect(vectorSearchResponse.status()).toBe(200);
    
    const searchData = await vectorSearchResponse.json();
    expect(searchData).toHaveProperty('messageId');
    expect(searchData).toHaveProperty('citations');
    expect(searchData).toHaveProperty('improvedQueries');
    
    // Check if we got fatwa citations
    const fatwaCitations = searchData.citations.filter((citation: any) => 
      citation.metadata?.type === 'fatwa' || citation.metadata?.type === 'FAT'
    );
    
    console.log(`📊 Vector search results:`, {
      totalCitations: searchData.citations.length,
      fatwaCitations: fatwaCitations.length,
      improvedQueries: searchData.improvedQueries.length
    });
    
    // We should have some citations (not necessarily fatwa, but some results)
    expect(searchData.citations.length).toBeGreaterThan(0);
    
    console.log('✅ Vector search endpoint test passed');
  });

  // Test each fatwa query
  FATWA_TEST_QUERIES.forEach((testCase, index) => {
    test(`Test fatwa query ${index + 1}: ${testCase.name}`, async ({ adaContext }) => {
      const chatId = generateUUID();
      const messageId = generateUUID();
      
      console.log(`🔍 Testing query: "${testCase.query}"`);
      
             // Test vector search first
       const vectorResponse = await adaContext.request.post('/api/chat?vector=1', {
        data: {
          id: chatId,
          message: {
            id: messageId,
            role: 'user',
            content: testCase.query,
            parts: [
              {
                type: 'text',
                text: testCase.query,
              },
            ],
            createdAt: new Date().toISOString(),
          },
          selectedChatModel: TEST_CHAT_MODEL,
          selectedVisibilityType: TEST_VISIBILITY,
        },
      });

      expect(vectorResponse.status()).toBe(200);
      
      const vectorData = await vectorResponse.json();
      
      console.log(`📈 Results for "${testCase.name}":`, {
        totalCitations: vectorData.citations?.length || 0,
        citationTypes: vectorData.citations?.map((c: any) => c.metadata?.type || 'unknown') || [],
        improvedQueries: vectorData.improvedQueries?.length || 0
      });
      
      // Basic validation
      expect(vectorData).toHaveProperty('messageId');
      expect(vectorData).toHaveProperty('citations');
      expect(Array.isArray(vectorData.citations)).toBe(true);
      
      // Log citation details for debugging
      if (vectorData.citations && vectorData.citations.length > 0) {
        vectorData.citations.forEach((citation: any, i: number) => {
          console.log(`Citation ${i + 1}:`, {
            id: citation.id,
            type: citation.metadata?.type || 'unknown',
            score: citation.score,
            textPreview: citation.text?.substring(0, 100) + '...' || 'No text'
          });
        });
      }
      
      console.log(`✅ Query "${testCase.name}" test completed`);
    });
  });

  test('Test fatwa citations in full chat response', async ({ adaContext }) => {
    const chatId = generateUUID();
    const messageId = generateUUID();
    
    console.log('🔄 Testing full chat response with fatwa content');
    
    const response = await adaContext.request.post('/api/chat', {
      data: {
        id: chatId,
        message: {
          id: messageId,
          role: 'user',
          content: 'What is the Islamic ruling on music and singing?',
          parts: [
            {
              type: 'text',
              text: 'What is the Islamic ruling on music and singing?',
            },
          ],
          createdAt: new Date().toISOString(),
        },
        selectedChatModel: TEST_CHAT_MODEL,
        selectedVisibilityType: TEST_VISIBILITY,
      },
    });

    expect(response.status()).toBe(200);
    
    const responseText = await response.text();
    
    // Check for fatwa citations in the response
    const hasFatwaCitations = responseText.includes('[FAT]') || responseText.includes('fatwa');
    
    console.log('📝 Full chat response analysis:', {
      responseLength: responseText.length,
      hasFatwaCitations,
      hasAnyCitations: /\[CIT\d+\]/.test(responseText),
      responsePreview: responseText.substring(0, 200) + '...'
    });
    
    // The response should contain some content
    expect(responseText.length).toBeGreaterThan(100);
    
    console.log('✅ Full chat response test completed');
  });

  test('Test fatwa index environment variables', async () => {
    // Test that the fatwa index environment variable is properly configured
    const fatwaIndexName = process.env.PINECONE_FATWA_INDEX || 'fatwa-sites';
    
    console.log('🔧 Environment configuration:', {
      fatwaIndexName,
      hasPineconeApiKey: !!process.env.PINECONE_API_KEY,
      hasRailwayEmbeddingUrl: !!process.env.RAILWAY_EMBEDDING_SERVICE_URL
    });
    
    expect(fatwaIndexName).toBe('fatwa-sites');
    expect(process.env.PINECONE_API_KEY).toBeTruthy();
    expect(process.env.RAILWAY_EMBEDDING_SERVICE_URL).toBeTruthy();
    
    console.log('✅ Environment variables test passed');
  });

  test('Test fatwa search performance', async ({ adaContext }) => {
    const chatId = generateUUID();
    const messageId = generateUUID();
    
    console.log('⏱️ Testing fatwa search performance');
    
    const startTime = Date.now();
    
    const response = await adaContext.request.post('/api/chat?vector=1', {
      data: {
        id: chatId,
        message: {
          id: messageId,
          role: 'user',
          content: 'What are the conditions for valid prayer in Islam?',
          parts: [
            {
              type: 'text',
              text: 'What are the conditions for valid prayer in Islam?',
            },
          ],
          createdAt: new Date().toISOString(),
        },
        selectedChatModel: TEST_CHAT_MODEL,
        selectedVisibilityType: TEST_VISIBILITY,
      },
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    console.log('📊 Performance metrics:', {
      searchDuration: `${duration}ms`,
      citationsFound: data.citations?.length || 0,
      queriesImproved: data.improvedQueries?.length || 0,
      averageScore: data.citations?.length > 0 
        ? (data.citations.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / data.citations.length).toFixed(3)
        : 'N/A'
    });
    
    // Performance expectations (adjust as needed)
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    
    console.log('✅ Performance test completed');
  });
}); 