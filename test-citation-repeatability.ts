import 'dotenv/config';

interface CitationTest {
  runNumber: number;
  citationCount: number;
  enhancedQuery: string;
  duration: number;
  timestamp: string;
  citationsBySource: Record<string, number>;
  success: boolean;
  error?: string;
}

interface CitationStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageCitations: number;
  minCitations: number;
  maxCitations: number;
  citationVariance: number;
  averageDuration: number;
  consistencyScore: number;
  uniqueEnhancements: Set<string>;
}

// Test the citation count repeatability for enhanced queries
async function testCitationRepeatability() {
  console.log('📊 Testing Citation Count Repeatability with Enhanced Queries...\n');
  
  const testQuery = "Отношения вне брака"; // The problematic query from before
  const numberOfRuns = 5; // Test multiple times
  const results: CitationTest[] = [];
  
  console.log(`🔍 Testing Query: "${testQuery}"`);
  console.log(`🎯 Number of Runs: ${numberOfRuns}`);
  console.log(`📈 Focus: Citation count consistency with enhanced query mechanism\n`);
  
  try {
    // Import the vector search function
    const { performVectorSearch } = await import('./lib/ai/vector-search');
    
    // Run the test multiple times
    for (let run = 1; run <= numberOfRuns; run++) {
      console.log(`\n🔄 Run ${run}/${numberOfRuns}...`);
      
      const startTime = Date.now();
      
      try {
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
        
        // Analyze citations by source
        const citationsBySource = result.citations.reduce((acc: Record<string, number>, citation) => {
          const source = citation.namespace || citation.metadata?.source || 'unknown';
          // Simplify source names for better readability
          const simplifiedSource = simplifySourceName(source);
          acc[simplifiedSource] = (acc[simplifiedSource] || 0) + 1;
          return acc;
        }, {});
        
        const testResult: CitationTest = {
          runNumber: run,
          citationCount: result.citations.length,
          enhancedQuery: result.improvedQueries[0] || '',
          duration,
          timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
          citationsBySource: {},
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        
        results.push(testResult);
        
        console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Small delay between runs to avoid overwhelming the service
      if (run < numberOfRuns) {
        console.log('   ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Analyze results
    console.log('\n' + '='.repeat(80));
    console.log('📊 CITATION REPEATABILITY ANALYSIS');
    console.log('='.repeat(80));
    
    const stats = analyzeCitationStats(results);
    
    console.log(`\n📈 Overall Statistics:`);
    console.log(`   🎯 Success Rate: ${stats.successfulRuns}/${stats.totalRuns} (${(stats.successfulRuns/stats.totalRuns*100).toFixed(1)}%)`);
    console.log(`   📚 Average Citations: ${stats.averageCitations.toFixed(1)}`);
    console.log(`   📊 Citation Range: ${stats.minCitations} - ${stats.maxCitations}`);
    console.log(`   📉 Citation Variance: ${stats.citationVariance.toFixed(2)}`);
    console.log(`   ⏱️  Average Duration: ${stats.averageDuration.toFixed(0)}ms`);
    console.log(`   🎯 Consistency Score: ${stats.consistencyScore}/100`);
    
    // Show detailed results for each run
    console.log(`\n📋 Detailed Results:`);
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`   Run ${result.runNumber}: ${result.citationCount} citations (${result.duration}ms)`);
        console.log(`      Sources: ${Object.entries(result.citationsBySource).map(([source, count]) => `${source}:${count}`).join(', ')}`);
      } else {
        console.log(`   Run ${result.runNumber}: FAILED - ${result.error}`);
      }
    });
    
    // Enhanced query analysis
    console.log(`\n🌐 Enhanced Query Analysis:`);
    console.log(`   📝 Unique Enhancements: ${stats.uniqueEnhancements.size}`);
    if (stats.uniqueEnhancements.size === 1) {
      console.log(`   ✅ PERFECT: All runs produced identical enhanced queries`);
    } else if (stats.uniqueEnhancements.size <= 2) {
      console.log(`   🟡 GOOD: Minor variations in enhanced queries`);
    } else {
      console.log(`   🟠 VARIABLE: Significant variations in enhanced queries`);
    }
    
    stats.uniqueEnhancements.forEach((enhancement, index) => {
      const count = results.filter(r => r.enhancedQuery === enhancement).length;
      console.log(`   ${index + 1}. "${enhancement.substring(0, 120)}..." (${count}/${stats.totalRuns} runs)`);
    });
    
    // Source consistency analysis
    console.log(`\n📊 Source Consistency Analysis:`);
    const allSources = new Set<string>();
    results.forEach(result => {
      Object.keys(result.citationsBySource).forEach(source => allSources.add(source));
    });
    
    allSources.forEach(source => {
      const appearances = results.filter(r => r.citationsBySource[source] > 0).length;
      const totalCitations = results.reduce((sum, r) => sum + (r.citationsBySource[source] || 0), 0);
      const avgCitations = totalCitations / stats.successfulRuns;
      console.log(`   ${source}: appears in ${appearances}/${stats.successfulRuns} runs, avg ${avgCitations.toFixed(1)} citations`);
    });
    
    // Final assessment
    console.log('\n🎯 REPEATABILITY ASSESSMENT:');
    
    if (stats.consistencyScore >= 90) {
      console.log('🟢 EXCELLENT: Citation counts are highly consistent');
    } else if (stats.consistencyScore >= 75) {
      console.log('🟡 GOOD: Citation counts are mostly consistent');
    } else if (stats.consistencyScore >= 50) {
      console.log('🟠 FAIR: Some variation in citation counts');
    } else {
      console.log('🔴 POOR: High variation in citation counts');
    }
    
    // Compare with previous system
    console.log('\n📈 IMPROVEMENT ANALYSIS:');
    console.log('   Before Enhancement: 1-11 citations (high variation)');
    console.log(`   After Enhancement: ${stats.minCitations}-${stats.maxCitations} citations (current test)`);
    
    const improvementRatio = stats.minCitations / 1; // Compare to previous minimum of 1
    console.log(`   🚀 Minimum Citation Improvement: ${improvementRatio.toFixed(1)}x better`);
    
    if (stats.citationVariance < 4) { // Much lower than previous 25+ variance
      console.log('   ✅ SIGNIFICANT IMPROVEMENT: Much more consistent results');
    } else {
      console.log('   🟡 MODERATE IMPROVEMENT: Some improvement in consistency');
    }
    
    console.log('\n🎉 Citation repeatability test completed!');
    
  } catch (error) {
    console.error('\n❌ Citation repeatability test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

function simplifySourceName(source: string): string {
  // Simplify long source names for better readability
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

function analyzeCitationStats(results: CitationTest[]): CitationStats {
  const successfulResults = results.filter(r => r.success);
  const totalRuns = results.length;
  const successfulRuns = successfulResults.length;
  const failedRuns = totalRuns - successfulRuns;
  
  if (successfulRuns === 0) {
    return {
      totalRuns,
      successfulRuns: 0,
      failedRuns,
      averageCitations: 0,
      minCitations: 0,
      maxCitations: 0,
      citationVariance: 0,
      averageDuration: 0,
      consistencyScore: 0,
      uniqueEnhancements: new Set()
    };
  }
  
  const citationCounts = successfulResults.map(r => r.citationCount);
  const durations = successfulResults.map(r => r.duration);
  const enhancements = new Set(successfulResults.map(r => r.enhancedQuery));
  
  const averageCitations = citationCounts.reduce((sum, count) => sum + count, 0) / successfulRuns;
  const minCitations = Math.min(...citationCounts);
  const maxCitations = Math.max(...citationCounts);
  
  // Calculate variance
  const variance = citationCounts.reduce((sum, count) => sum + Math.pow(count - averageCitations, 2), 0) / successfulRuns;
  
  const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / successfulRuns;
  
  // Calculate consistency score (0-100)
  // Based on: success rate (40%), low variance (40%), reasonable range (20%)
  const successScore = (successfulRuns / totalRuns) * 40;
  const varianceScore = Math.max(0, 40 - (variance * 2)); // Lower variance = higher score
  const rangeScore = Math.max(0, 20 - ((maxCitations - minCitations) * 2)); // Smaller range = higher score
  
  const consistencyScore = Math.round(successScore + varianceScore + rangeScore);
  
  return {
    totalRuns,
    successfulRuns,
    failedRuns,
    averageCitations,
    minCitations,
    maxCitations,
    citationVariance: variance,
    averageDuration,
    consistencyScore,
    uniqueEnhancements: enhancements
  };
}

// Run the test
testCitationRepeatability().then(() => {
  console.log('\n🏁 Citation repeatability test finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
}); 