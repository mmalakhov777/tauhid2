import 'dotenv/config';

// Debug test to trace the vector search pipeline
async function debugVectorSearch() {
  console.log('🔍 DEBUGGING Vector Search Pipeline...\n');
  
  const testQuery = "Отношения вне брака";
  const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'https://vectorservice-production.up.railway.app';
  
  console.log(`📝 Original Query: "${testQuery}"`);
  console.log(`🌐 Service URL: ${RAILWAY_EMBEDDING_SERVICE_URL}`);
  
  try {
    // Step 1: Test direct translation call
    console.log('\n🔍 Step 1: Testing direct translation call...');
    const directResponse = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: testQuery,
        history: '',
        selectedChatModel: 'gpt-4.1-nano'
      }),
    });

    if (directResponse.ok) {
      const directData = await directResponse.json();
      console.log(`✅ Direct translation works: "${testQuery}" → "${directData.improvedQuery}"`);
    } else {
      console.log(`❌ Direct translation failed: ${directResponse.status}`);
    }
    
    // Step 2: Test the improveUserQueries function directly
    console.log('\n🔍 Step 2: Testing improveUserQueries function...');
    
    // Import and test the internal function
    const vectorSearchModule = await import('./lib/ai/vector-search');
    
    // We need to access the internal function - let's create a minimal test
    console.log('📊 Vector search module imported successfully');
    
    // Step 3: Test with a simpler English query to see if the issue is translation-specific
    console.log('\n🔍 Step 3: Testing with English query for comparison...');
    
    const englishQuery = "extramarital relationships";
    console.log(`📝 Testing English Query: "${englishQuery}"`);
    
    const englishResult = await vectorSearchModule.performVectorSearch(
      englishQuery,
      '',
      'gpt-4.1-nano',
      {
        classic: true,
        risale: true,
        youtube: true,
        fatwa: true
      }
    );
    
    console.log(`📊 English Query Results: ${englishResult.citations.length} citations found`);
    console.log(`🔤 English Improved Queries: ${JSON.stringify(englishResult.improvedQueries)}`);
    
    // Step 4: Test Russian query again with detailed logging
    console.log('\n🔍 Step 4: Testing Russian query with vector search...');
    
    const russianResult = await vectorSearchModule.performVectorSearch(
      testQuery,
      '',
      'gpt-4.1-nano',
      {
        classic: true,
        risale: true,
        youtube: true,
        fatwa: true
      }
    );
    
    console.log('\n📊 Comparison Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🇷🇺 Russian Query: "${testQuery}"`);
    console.log(`   Improved: "${russianResult.improvedQueries[0]}"`);
    console.log(`   Results: ${russianResult.citations.length} citations`);
    console.log('');
    console.log(`🇺🇸 English Query: "${englishQuery}"`);
    console.log(`   Improved: "${englishResult.improvedQueries[0]}"`);
    console.log(`   Results: ${englishResult.citations.length} citations`);
    
    // Analysis
    console.log('\n🎯 Debug Analysis:');
    if (russianResult.improvedQueries[0] === testQuery) {
      console.log('❌ ISSUE FOUND: Russian query was NOT translated!');
      console.log('   The improve-queries endpoint is not being called properly');
      console.log('   or the translation is failing silently');
    } else {
      console.log('✅ Translation working: Russian query was translated');
    }
    
    if (englishResult.citations.length > 0 && russianResult.citations.length === 0) {
      console.log('❌ ISSUE CONFIRMED: English works but Russian doesn\'t');
      console.log('   This confirms the translation step is the problem');
    }
    
    // Test the embedding service health
    console.log('\n🔍 Step 5: Testing embedding service health...');
    const healthResponse = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log(`✅ Embedding service is healthy: ${healthData.status}`);
      console.log(`🔧 Configured: ${healthData.configured}`);
    } else {
      console.log(`❌ Embedding service health check failed: ${healthResponse.status}`);
    }
    
  } catch (error) {
    console.error('\n❌ Debug test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the debug test
debugVectorSearch().then(() => {
  console.log('\n🏁 Debug test finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Debug test failed:', error);
  process.exit(1);
}); 