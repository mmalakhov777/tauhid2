// Test script for Railway embedding service
// Run with: npx tsx lib/ai/test-railway-service.ts

const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'http://localhost:3001';

async function testRailwayService() {
  console.log('🔍 Testing Railway Embedding Service...');
  console.log(`📍 Service URL: ${RAILWAY_EMBEDDING_SERVICE_URL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');

  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const healthResponse = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/health`);
    console.log(`   Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health check passed');
      console.log(`   📊 Response:`, healthData);
    } else {
      console.log('   ❌ Health check failed');
      const errorText = await healthResponse.text();
      console.log(`   Error: ${errorText}`);
    }
  } catch (error) {
    console.log('   ❌ Health check failed with network error');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');

  // Test 2: Embedding endpoint
  console.log('2️⃣ Testing embedding endpoint...');
  try {
    const embeddingResponse = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'test embedding' }),
    });
    
    console.log(`   Status: ${embeddingResponse.status}`);
    
    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      console.log('   ✅ Embedding test passed');
      console.log(`   📊 Embedding dimensions: ${embeddingData.embedding?.length || 'unknown'}`);
      console.log(`   🤖 Provider: ${embeddingData.provider || 'unknown'}`);
    } else {
      console.log('   ❌ Embedding test failed');
      const errorText = await embeddingResponse.text();
      console.log(`   Error: ${errorText}`);
    }
  } catch (error) {
    console.log('   ❌ Embedding test failed with network error');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');

  // Test 3: Query improvement endpoint
  console.log('3️⃣ Testing query improvement endpoint...');
  try {
    const queryResponse = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: 'test query',
        history: '',
        selectedChatModel: 'test-model'
      }),
    });
    
    console.log(`   Status: ${queryResponse.status}`);
    
    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      console.log('   ✅ Query improvement test passed');
      console.log(`   📊 Improved queries count: ${queryData.improvedQueries?.length || 'unknown'}`);
    } else {
      console.log('   ❌ Query improvement test failed');
      const errorText = await queryResponse.text();
      console.log(`   Error: ${errorText}`);
    }
  } catch (error) {
    console.log('   ❌ Query improvement test failed with network error');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');

  // Environment variables check
  console.log('4️⃣ Environment variables check...');
  console.log(`   RAILWAY_EMBEDDING_SERVICE_URL: ${process.env.RAILWAY_EMBEDDING_SERVICE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  
  console.log('');
  console.log('🏁 Test completed!');
}

// Run the test
testRailwayService().catch(console.error); 