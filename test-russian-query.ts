import 'dotenv/config';

// Simple test to check if the embedding service can translate Russian
async function testRussianTranslation() {
  console.log('🚀 Testing Russian Query Translation...\n');
  
  const testQuery = "Отношения вне брака";
  const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'https://vectorservice-production.up.railway.app';
  
  console.log(`📝 Original Query: "${testQuery}"`);
  console.log(`🌐 Embedding Service URL: ${RAILWAY_EMBEDDING_SERVICE_URL}`);
  
  try {
    // Test the improve-queries endpoint directly
    console.log('\n🔄 Calling improve-queries endpoint...');
    const response = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`, {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log('\n✅ Translation Results:');
    console.log(`🔤 Original Query: "${data.originalQuery}"`);
    console.log(`🔤 Improved Query: "${data.improvedQuery}"`);
    console.log(`🤖 Model Used: ${data.model}`);
    console.log(`✅ Success: ${data.success}`);
    
    // Test if it was actually translated
    if (data.improvedQuery !== data.originalQuery) {
      console.log('\n🎯 Translation detected! Russian text was successfully translated to English.');
    } else {
      console.log('\n⚠️  No translation detected. Query remained the same.');
    }
    
    // Now test embedding the translated query
    console.log('\n🔍 Testing embedding generation...');
    
    const embedResponse = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: data.improvedQuery
      }),
    });

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text();
      throw new Error(`Embedding error: ${embedResponse.status} - ${errorText}`);
    }

    const embedData = await embedResponse.json();
    
    console.log('\n📊 Embedding Results:');
    console.log(`✅ Success: ${embedData.success}`);
    console.log(`📏 Dimensions: ${embedData.dimensions}`);
    console.log(`🤖 Model: ${embedData.model}`);
    console.log(`📈 Embedding Preview: [${embedData.embedding.slice(0, 5).map((n: number) => n.toFixed(4)).join(', ')}...]`);
    
    console.log('\n🎉 Full test completed successfully!');
    console.log(`\n📋 Summary:`);
    console.log(`   Russian Input: "${testQuery}"`);
    console.log(`   English Output: "${data.improvedQuery}"`);
    console.log(`   Embedding Dimensions: ${embedData.dimensions}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testRussianTranslation().then(() => {
  console.log('\n🏁 Test execution finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
}); 