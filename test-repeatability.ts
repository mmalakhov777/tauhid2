import 'dotenv/config';

interface SearchResult {
  messageId: string;
  citations: any[];
  improvedQueries: string[];
  contextBlock: string;
  duration: number;
  timestamp: string;
}

interface RepeatabilityStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  averageCitations: number;
  translationConsistency: number;
  citationConsistency: number;
  uniqueTranslations: Set<string>;
  uniqueCitationIds: Set<string>;
}

// Test the repeatability and consistency of vector search results
async function testRepeatability() {
  console.log('🔄 Testing Vector Search Repeatability & Consistency...\n');
  
  const testQueries = [
    "Отношения вне брака",           // Relationships outside marriage
    "Что такое намаз?",              // What is prayer?
    "Как правильно поститься?",      // How to fast correctly?
    "Закят в исламе",                // Zakat in Islam
    "Хадж и его правила"             // Hajj and its rules
  ];
  
  const runsPerQuery = 3; // Test each query multiple times
  const results: Record<string, SearchResult[]> = {};
  
  try {
    // Import the vector search function
    const { performVectorSearch } = await import('./lib/ai/vector-search');
    
    console.log(`📊 Testing ${testQueries.length} Russian queries, ${runsPerQuery} runs each`);
    console.log(`🎯 Total tests: ${testQueries.length * runsPerQuery}\n`);
    
    // Test each query multiple times
    for (const query of testQueries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      results[query] = [];
      
      for (let run = 1; run <= runsPerQuery; run++) {
        console.log(`   Run ${run}/${runsPerQuery}...`);
        
        const startTime = Date.now();
        
        try {
          const result = await performVectorSearch(
            query,
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
          
          results[query].push({
            messageId: result.messageId,
            citations: result.citations,
            improvedQueries: result.improvedQueries,
            contextBlock: result.contextBlock,
            duration,
            timestamp: new Date().toISOString()
          });
          
          console.log(`   ✅ Run ${run}: ${result.citations.length} citations, ${duration}ms`);
          
        } catch (error) {
          console.log(`   ❌ Run ${run} failed:`, error instanceof Error ? error.message : String(error));
          results[query].push({
            messageId: '',
            citations: [],
            improvedQueries: [],
            contextBlock: '',
            duration: 0,
            timestamp: new Date().toISOString()
          });
        }
        
        // Small delay between runs to avoid overwhelming the service
        if (run < runsPerQuery) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Analyze results for each query
    console.log('\n' + '='.repeat(80));
    console.log('📊 REPEATABILITY ANALYSIS');
    console.log('='.repeat(80));
    
    for (const [query, queryResults] of Object.entries(results)) {
      console.log(`\n🔍 Query: "${query}"`);
      console.log('─'.repeat(60));
      
      const stats = analyzeQueryResults(queryResults);
      
      console.log(`📈 Success Rate: ${stats.successfulRuns}/${stats.totalRuns} (${(stats.successfulRuns/stats.totalRuns*100).toFixed(1)}%)`);
      console.log(`⏱️  Average Duration: ${stats.averageDuration.toFixed(0)}ms`);
      console.log(`📚 Average Citations: ${stats.averageCitations.toFixed(1)}`);
      console.log(`🔤 Translation Consistency: ${(stats.translationConsistency*100).toFixed(1)}%`);
      console.log(`📋 Citation Consistency: ${(stats.citationConsistency*100).toFixed(1)}%`);
      
      // Show translations
      console.log(`🌐 Translations Found:`);
      stats.uniqueTranslations.forEach(translation => {
        const count = queryResults.filter(r => r.improvedQueries[0] === translation).length;
        console.log(`   "${translation}" (${count}/${stats.totalRuns} runs)`);
      });
      
      // Show citation details for successful runs
      const successfulRuns = queryResults.filter(r => r.citations.length > 0);
      if (successfulRuns.length > 0) {
        console.log(`📊 Citation Details:`);
        successfulRuns.forEach((result, index) => {
          const citationsBySource = result.citations.reduce((acc: Record<string, number>, citation) => {
            const source = citation.namespace || citation.metadata?.source || 'unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
          }, {});
          
          console.log(`   Run ${index + 1}: ${result.citations.length} total - ${Object.entries(citationsBySource).map(([source, count]) => `${source}:${count}`).join(', ')}`);
        });
      }
    }
    
    // Overall analysis
    console.log('\n' + '='.repeat(80));
    console.log('🎯 OVERALL SYSTEM ANALYSIS');
    console.log('='.repeat(80));
    
    const overallStats = analyzeOverallResults(results);
    
    console.log(`📊 Total Tests: ${overallStats.totalTests}`);
    console.log(`✅ Successful Tests: ${overallStats.successfulTests}`);
    console.log(`❌ Failed Tests: ${overallStats.failedTests}`);
    console.log(`📈 Overall Success Rate: ${(overallStats.successRate*100).toFixed(1)}%`);
    console.log(`⏱️  Average Response Time: ${overallStats.avgDuration.toFixed(0)}ms`);
    console.log(`📚 Average Citations per Success: ${overallStats.avgCitations.toFixed(1)}`);
    console.log(`🔤 Translation Success Rate: ${(overallStats.translationSuccessRate*100).toFixed(1)}%`);
    
    // Reliability assessment
    console.log('\n🎯 RELIABILITY ASSESSMENT:');
    if (overallStats.successRate >= 0.9) {
      console.log('🟢 EXCELLENT: System is highly reliable (≥90% success rate)');
    } else if (overallStats.successRate >= 0.7) {
      console.log('🟡 GOOD: System is reliable (≥70% success rate)');
    } else if (overallStats.successRate >= 0.5) {
      console.log('🟠 FAIR: System has moderate reliability (≥50% success rate)');
    } else {
      console.log('🔴 POOR: System reliability needs improvement (<50% success rate)');
    }
    
    // Performance assessment
    console.log('\n⚡ PERFORMANCE ASSESSMENT:');
    if (overallStats.avgDuration <= 3000) {
      console.log('🟢 FAST: Average response time ≤3 seconds');
    } else if (overallStats.avgDuration <= 5000) {
      console.log('🟡 MODERATE: Average response time ≤5 seconds');
    } else {
      console.log('🟠 SLOW: Average response time >5 seconds');
    }
    
    // Translation consistency assessment
    console.log('\n🌐 TRANSLATION ASSESSMENT:');
    if (overallStats.translationSuccessRate >= 0.95) {
      console.log('🟢 EXCELLENT: Translations are highly consistent');
    } else if (overallStats.translationSuccessRate >= 0.8) {
      console.log('🟡 GOOD: Translations are mostly consistent');
    } else {
      console.log('🟠 INCONSISTENT: Translation results vary significantly');
    }
    
    console.log('\n🎉 Repeatability test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Repeatability test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

function analyzeQueryResults(results: SearchResult[]): RepeatabilityStats {
  const successfulRuns = results.filter(r => r.citations.length > 0);
  const totalRuns = results.length;
  
  const uniqueTranslations = new Set(results.map(r => r.improvedQueries[0] || '').filter(Boolean));
  const uniqueCitationIds = new Set();
  
  results.forEach(result => {
    result.citations.forEach(citation => {
      if (citation.id) uniqueCitationIds.add(String(citation.id));
    });
  });
  
  const avgDuration = results.filter(r => r.duration > 0).reduce((sum, r) => sum + r.duration, 0) / Math.max(1, results.filter(r => r.duration > 0).length);
  const avgCitations = successfulRuns.reduce((sum, r) => sum + r.citations.length, 0) / Math.max(1, successfulRuns.length);
  
  // Translation consistency: how often the same translation appears
  const mostCommonTranslation = Array.from(uniqueTranslations).reduce((a, b) => 
    results.filter(r => r.improvedQueries[0] === a).length > results.filter(r => r.improvedQueries[0] === b).length ? a : b
  , '');
  const translationConsistency = results.filter(r => r.improvedQueries[0] === mostCommonTranslation).length / totalRuns;
  
  // Citation consistency: how much overlap in citations between runs
  const citationConsistency = successfulRuns.length > 1 ? 
    calculateCitationOverlap(successfulRuns) : 1;
  
  return {
    totalRuns,
    successfulRuns: successfulRuns.length,
    failedRuns: totalRuns - successfulRuns.length,
    averageDuration: avgDuration,
    averageCitations: avgCitations,
    translationConsistency,
    citationConsistency,
    uniqueTranslations,
    uniqueCitationIds
  };
}

function calculateCitationOverlap(results: SearchResult[]): number {
  if (results.length < 2) return 1;
  
  let totalOverlap = 0;
  let comparisons = 0;
  
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const ids1 = new Set(results[i].citations.map(c => String(c.id || '')).filter(Boolean));
      const ids2 = new Set(results[j].citations.map(c => String(c.id || '')).filter(Boolean));
      
      const intersection = new Set([...ids1].filter(x => ids2.has(x)));
      const union = new Set([...ids1, ...ids2]);
      
      const overlap = union.size > 0 ? intersection.size / union.size : 0;
      totalOverlap += overlap;
      comparisons++;
    }
  }
  
  return comparisons > 0 ? totalOverlap / comparisons : 0;
}

function analyzeOverallResults(results: Record<string, SearchResult[]>) {
  const allResults = Object.values(results).flat();
  const successfulResults = allResults.filter(r => r.citations.length > 0);
  
  const totalTests = allResults.length;
  const successfulTests = successfulResults.length;
  const failedTests = totalTests - successfulTests;
  
  const avgDuration = allResults.filter(r => r.duration > 0).reduce((sum, r) => sum + r.duration, 0) / Math.max(1, allResults.filter(r => r.duration > 0).length);
  const avgCitations = successfulResults.reduce((sum, r) => sum + r.citations.length, 0) / Math.max(1, successfulResults.length);
  
  // Count how many results have valid translations (different from original)
  const translatedResults = allResults.filter(r => {
    const original = Object.keys(results).find(query => 
      results[query].some(result => result.messageId === r.messageId)
    );
    return original && r.improvedQueries[0] && r.improvedQueries[0] !== original;
  });
  
  return {
    totalTests,
    successfulTests,
    failedTests,
    successRate: totalTests > 0 ? successfulTests / totalTests : 0,
    avgDuration,
    avgCitations,
    translationSuccessRate: totalTests > 0 ? translatedResults.length / totalTests : 0
  };
}

// Run the test
testRepeatability().then(() => {
  console.log('\n🏁 Repeatability test finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
}); 