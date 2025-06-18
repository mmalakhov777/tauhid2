import 'dotenv/config';

interface CitationTest {
  runNumber: number;
  citationCount: number;
  enhancedQuery: string;
  duration: number;
  citationsBySource: Record<string, number>;
  success: boolean;
  error?: string;
}

// Test the specific query "Прелюбодеяние" (adultery)
async function testAdulteryQuery() {
  console.log('📊 Testing Citation Repeatability for "Прелюбодеяние" (Adultery)...\n');
  
  const testQuery = "Прелюбодеяние"; // Adultery in Russian
  const numberOfRuns = 5;
  const results: CitationTest[] = [];
  
  console.log(`🔍 Testing Query: "${testQuery}"`);
  console.log(`🎯 Number of Runs: ${numberOfRuns}`);
  console.log(`📝 Query Meaning: Adultery (Russian)\n`);
  
  try {
    const { performVectorSearch } = await import('./lib/ai/vector-search');
    
    // Run the test multiple times
    for (let run = 1; run <= numberOfRuns; run++) {
      console.log(`\n🔄 Run ${run}/${numberOfRuns}...`);
      
      const startTime = Date.now();
      
      try {
        const result = await performVectorSearch(
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
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Analyze citations by source
        const citationsBySource = result.citations.reduce((acc: Record<string, number>, citation) => {
          const source = citation.namespace || citation.metadata?.source || 'unknown';
          const simplifiedSource = simplifySourceName(source);
          acc[simplifiedSource] = (acc[simplifiedSource] || 0) + 1;
          return acc;
        }, {});
        
        const testResult: CitationTest = {
          runNumber: run,
          citationCount: result.citations.length,
          enhancedQuery: result.improvedQueries[0] || '',
          duration,
          citationsBySource,
          success: true
        };
        
        results.push(testResult);
        
        console.log(`   ✅ Success: ${result.citations.length} citations in ${duration}ms`);
        console.log(`   🌐 Enhanced: "${result.improvedQueries[0]?.substring(0, 100)}..."`);
        console.log(`   📊 Sources: ${Object.entries(citationsBySource).map(([source, count]) => `${source}:${count}`).join(', ')}`);
        
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const testResult: CitationTest = {
          runNumber: run,
          citationCount: 0,
          enhancedQuery: '',
          duration,
          citationsBySource: {},
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        
        results.push(testResult);
        console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Small delay between runs
      if (run < numberOfRuns) {
        console.log('   ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Analyze results
    console.log('\n' + '='.repeat(80));
    console.log('📊 CITATION ANALYSIS FOR "Прелюбодеяние"');
    console.log('='.repeat(80));
    
    const successfulResults = results.filter(r => r.success);
    const citationCounts = successfulResults.map(r => r.citationCount);
    
    if (successfulResults.length > 0) {
      const avgCitations = citationCounts.reduce((sum, count) => sum + count, 0) / successfulResults.length;
      const minCitations = Math.min(...citationCounts);
      const maxCitations = Math.max(...citationCounts);
      const variance = citationCounts.reduce((sum, count) => sum + Math.pow(count - avgCitations, 2), 0) / successfulResults.length;
      
      console.log(`\n📈 Statistics:`);
      console.log(`   🎯 Success Rate: ${successfulResults.length}/${numberOfRuns} (${(successfulResults.length/numberOfRuns*100).toFixed(1)}%)`);
      console.log(`   📚 Average Citations: ${avgCitations.toFixed(1)}`);
      console.log(`   📊 Citation Range: ${minCitations} - ${maxCitations}`);
      console.log(`   📉 Citation Variance: ${variance.toFixed(2)}`);
      
      // Show detailed results
      console.log(`\n📋 Detailed Results:`);
      results.forEach((result) => {
        if (result.success) {
          console.log(`   Run ${result.runNumber}: ${result.citationCount} citations (${result.duration}ms)`);
          console.log(`      Sources: ${Object.entries(result.citationsBySource).map(([source, count]) => `${source}:${count}`).join(', ')}`);
        } else {
          console.log(`   Run ${result.runNumber}: FAILED - ${result.error}`);
        }
      });
      
      // Enhanced query analysis
      const uniqueEnhancements = new Set(successfulResults.map(r => r.enhancedQuery));
      console.log(`\n🌐 Enhanced Query Analysis:`);
      console.log(`   📝 Unique Enhancements: ${uniqueEnhancements.size}`);
      
      uniqueEnhancements.forEach((enhancement, index) => {
        const count = results.filter(r => r.enhancedQuery === enhancement).length;
        console.log(`   ${index + 1}. "${enhancement.substring(0, 150)}..." (${count}/${numberOfRuns} runs)`);
      });
      
      // Source consistency
      console.log(`\n📊 Source Consistency:`);
      const allSources = new Set<string>();
      results.forEach(result => {
        Object.keys(result.citationsBySource).forEach(source => allSources.add(source));
      });
      
      allSources.forEach(source => {
        const appearances = results.filter(r => r.citationsBySource[source] > 0).length;
        const totalCitations = results.reduce((sum, r) => sum + (r.citationsBySource[source] || 0), 0);
        const avgCitations = totalCitations / successfulResults.length;
        console.log(`   ${source}: appears in ${appearances}/${successfulResults.length} runs, avg ${avgCitations.toFixed(1)} citations`);
      });
      
      // Assessment
      console.log(`\n🎯 Assessment:`);
      if (variance < 1) {
        console.log('🟢 EXCELLENT: Very consistent citation counts');
      } else if (variance < 4) {
        console.log('🟡 GOOD: Reasonably consistent citation counts');
      } else {
        console.log('🟠 VARIABLE: Some variation in citation counts');
      }
      
      if (minCitations >= 10) {
        console.log('🟢 HIGH QUALITY: Consistently finding many relevant citations');
      } else if (minCitations >= 5) {
        console.log('🟡 MODERATE QUALITY: Finding adequate citations');
      } else {
        console.log('🟠 LOW QUALITY: Sometimes finding few citations');
      }
      
    } else {
      console.log('❌ All runs failed - no data to analyze');
    }
    
    console.log('\n🎉 Adultery query test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

function simplifySourceName(source: string): string {
  if (source.includes('Discussion') || source.includes('Sections')) {
    return 'Classical Texts';
  }
  if (source.includes('bediuzzaman') || source.includes('nursi')) {
    return 'Risale-i Nur';
  }
  if (source === 'fatwa-collection') {
    return 'Fatwa Collection';
  }
  return source;
}

// Run the test
testAdulteryQuery().then(() => {
  console.log('\n🏁 Adultery query test finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
}); 