import 'dotenv/config';

// Test the improveUserQueries function directly with detailed logging
async function testImproveUserQueries() {
  console.log('🔍 Testing improveUserQueries function directly...\n');
  
  const testQuery = "Отношения вне брака";
  const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'https://vectorservice-production.up.railway.app';
  
  console.log(`📝 Query: "${testQuery}"`);
  console.log(`🌐 Service URL: ${RAILWAY_EMBEDDING_SERVICE_URL}`);
  
  try {
    // Simulate the exact same logic as improveUserQueries
    console.log('\n🔄 Step 1: Cleaning query (remove brackets)...');
    const cleanQuery = testQuery.replace(/\[.*?\]/g, '').trim();
    console.log(`✅ Cleaned query: "${cleanQuery}"`);
    
    console.log('\n🔄 Step 2: Building request body...');
    const requestBody = { 
      query: cleanQuery, 
      history: '', 
      selectedChatModel: 'gpt-4.1-nano'
    };
    console.log('✅ Request body:', JSON.stringify(requestBody, null, 2));
    
    console.log('\n🔄 Step 3: Calling improve-queries endpoint...');
    const response = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response ok: ${response.ok}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response: ${errorText}`);
      throw new Error(`Query improvement service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Response data:', JSON.stringify(data, null, 2));
    
    if (!data.success || !data.improvedQuery) {
      console.log('❌ Invalid response structure');
      throw new Error('Invalid query improvement response');
    }

    console.log('\n🎉 SUCCESS!');
    console.log(`📝 Original: "${testQuery}"`);
    console.log(`🔤 Improved: "${data.improvedQuery}"`);
    console.log(`✅ Translation worked: ${data.improvedQuery !== testQuery}`);
    
    return data.improvedQuery;
    
  } catch (error) {
    console.error('\n❌ Error in improveUserQueries simulation:', error);
    
    // This is what the real function does on error
    const cleanQuery = testQuery.replace(/\[.*?\]/g, '').trim();
    console.log(`🔄 Fallback to cleaned query: "${cleanQuery}"`);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    
    return cleanQuery;
  }
}

// Run the test
testImproveUserQueries().then((result) => {
  console.log(`\n🏁 Final result: "${result}"`);
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
}); 