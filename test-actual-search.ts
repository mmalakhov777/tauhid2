import 'dotenv/config';

// Test the actual vector search function
async function testActualVectorSearch() {
  console.log('🚀 Testing ACTUAL Vector Search with Real Results...\n');
  
  const testQuery = "Отношения вне брака";
  
  try {
    // Import the actual vector search function
    const { performVectorSearch } = await import('./lib/ai/vector-search');
    
    console.log(`📝 Testing Russian Query: "${testQuery}"`);
    console.log('🔍 Calling actual performVectorSearch function...\n');
    
    const startTime = Date.now();
    
    // Call the real vector search with all sources enabled
    const result = await performVectorSearch(
      testQuery,
      '', // empty conversation history
      'gpt-4.1-nano',
      {
        classic: true,
        risale: true,
        youtube: true,
        fatwa: true
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ REAL Vector Search Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Search Duration: ${duration}ms`);
    console.log(`🆔 Message ID: ${result.messageId}`);
    console.log(`📊 Total Citations Found: ${result.citations.length}`);
    console.log(`🔤 Improved Queries Used: ${JSON.stringify(result.improvedQueries)}`);
    
    // Analyze citations by source
    const citationsBySource = result.citations.reduce((acc: Record<string, number>, citation) => {
      const source = citation.namespace || citation.metadata?.source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📚 Citations Found by Source:');
    Object.entries(citationsBySource).forEach(([source, count]) => {
      console.log(`   📖 ${source}: ${count} citations`);
    });
    
    // Show top citations with scores
    console.log('\n🏆 Top Citations (by relevance score):');
    const topCitations = result.citations
      .filter(c => c.score !== undefined)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
    
    topCitations.forEach((citation, index) => {
      console.log(`\n   ${index + 1}. Citation ID: ${citation.id}`);
      console.log(`      Score: ${citation.score?.toFixed(4) || 'N/A'}`);
      console.log(`      Source: ${citation.namespace || citation.metadata?.source || 'unknown'}`);
      console.log(`      Text Preview: "${citation.text.substring(0, 150)}..."`);
    });
    
    // Show context block preview
    console.log('\n📄 Context Block Preview:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const contextPreview = result.contextBlock.substring(0, 800);
    console.log(contextPreview);
    if (result.contextBlock.length > 800) {
      console.log(`\n... (${result.contextBlock.length - 800} more characters)`);
    }
    
    // Analysis
    console.log('\n🎯 Search Analysis:');
    console.log(`   Russian Input: "${testQuery}"`);
    console.log(`   English Translation: "${result.improvedQueries[0]}"`);
    console.log(`   Total Results: ${result.citations.length}`);
    console.log(`   Sources Searched: Classic, Risale-i Nur, YouTube, Fatwa`);
    console.log(`   Search Success: ${result.citations.length > 0 ? '✅ YES' : '❌ NO'}`);
    
    if (result.citations.length > 0) {
      const avgScore = result.citations
        .filter(c => c.score !== undefined)
        .reduce((sum, c) => sum + (c.score || 0), 0) / result.citations.length;
      console.log(`   Average Relevance Score: ${avgScore.toFixed(4)}`);
      
      console.log('\n🎉 SUCCESS! The search found relevant Islamic content about relationships outside marriage!');
    } else {
      console.log('\n⚠️  No results found. This might indicate:');
      console.log('   • The topic is not well covered in the indexed sources');
      console.log('   • The similarity threshold (0.4) is too high');
      console.log('   • The translation needs improvement');
    }
    
  } catch (error) {
    console.error('\n❌ Actual search test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testActualVectorSearch().then(() => {
  console.log('\n🏁 Actual vector search test finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
}); 