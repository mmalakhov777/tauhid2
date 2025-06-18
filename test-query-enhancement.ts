import 'dotenv/config';

interface QueryEnhancementTest {
  originalQuery: string;
  language: string;
  expectedEnhancements: string[];
  description: string;
}

// Test cases covering different types of queries
const testCases: QueryEnhancementTest[] = [
  {
    originalQuery: "Отношения вне брака",
    language: "Russian",
    expectedEnhancements: ["marriage", "nikah", "relationship", "Islamic law", "jurisprudence"],
    description: "Complex relationship topic in Russian"
  },
  {
    originalQuery: "Что такое намаз?",
    language: "Russian", 
    expectedEnhancements: ["prayer", "salah", "Islamic prayer", "conditions", "requirements"],
    description: "Basic Islamic concept in Russian"
  },
  {
    originalQuery: "prayer rules",
    language: "English",
    expectedEnhancements: ["salah", "Islamic prayer", "conditions", "requirements", "jurisprudence"],
    description: "Simple English query"
  },
  {
    originalQuery: "Can you tell me about fasting?",
    language: "English",
    expectedEnhancements: ["sawm", "Ramadan", "Islamic fasting", "rules", "conditions"],
    description: "Conversational English query"
  },
  {
    originalQuery: "زكاة",
    language: "Arabic",
    expectedEnhancements: ["zakat", "Islamic", "almsgiving", "obligatory", "conditions"],
    description: "Arabic Islamic term"
  }
];

async function testQueryEnhancement() {
  console.log('🔧 Testing Enhanced Query Improvement Mechanism...\n');
  
  try {
    // Test the embedding service directly
    const RAILWAY_EMBEDDING_SERVICE_URL = process.env.RAILWAY_EMBEDDING_SERVICE_URL || 'https://vectorservice-production.up.railway.app';
    
    console.log(`🌐 Testing embedding service at: ${RAILWAY_EMBEDDING_SERVICE_URL}\n`);
    
    for (const [index, testCase] of testCases.entries()) {
      console.log(`\n🔍 Test ${index + 1}/${testCases.length}: ${testCase.description}`);
      console.log(`📝 Original Query (${testCase.language}): "${testCase.originalQuery}"`);
      console.log('─'.repeat(80));
      
      const startTime = Date.now();
      
      try {
        // Test the query enhancement
        const response = await fetch(`${RAILWAY_EMBEDDING_SERVICE_URL}/improve-queries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: testCase.originalQuery,
            history: '',
            selectedChatModel: 'gpt-4.1-nano'
          }),
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`❌ Enhancement failed: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        
        if (!data.success || !data.improvedQuery) {
          console.log(`❌ Invalid response:`, data);
          continue;
        }

        const enhancedQuery = data.improvedQuery;
        
        console.log(`✨ Enhanced Query: "${enhancedQuery}"`);
        console.log(`⏱️  Enhancement Time: ${duration}ms`);
        
        // Analyze the enhancement
        const enhancements = analyzeEnhancement(testCase.originalQuery, enhancedQuery, testCase.expectedEnhancements);
        
        console.log(`\n📊 Enhancement Analysis:`);
        console.log(`   🎯 Translation: ${enhancements.hasTranslation ? '✅ Yes' : '❌ No'}`);
        console.log(`   📚 Islamic Terms Added: ${enhancements.islamicTermsAdded.length > 0 ? '✅ ' + enhancements.islamicTermsAdded.join(', ') : '❌ None'}`);
        console.log(`   🔍 Context Added: ${enhancements.hasContext ? '✅ Yes' : '❌ No'}`);
        console.log(`   📏 Length Increase: ${enhancements.lengthIncrease}x`);
        console.log(`   🎯 Expected Terms Found: ${enhancements.expectedTermsFound}/${testCase.expectedEnhancements.length}`);
        
        // Score the enhancement
        const score = calculateEnhancementScore(enhancements);
        console.log(`   📈 Enhancement Score: ${score}/100`);
        
        if (score >= 80) {
          console.log(`   🟢 EXCELLENT enhancement`);
        } else if (score >= 60) {
          console.log(`   🟡 GOOD enhancement`);
        } else if (score >= 40) {
          console.log(`   🟠 FAIR enhancement`);
        } else {
          console.log(`   🔴 POOR enhancement`);
        }
        
      } catch (error) {
        console.log(`❌ Test failed:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // Test with vector search integration
    console.log('\n' + '='.repeat(80));
    console.log('🔗 TESTING INTEGRATION WITH VECTOR SEARCH');
    console.log('='.repeat(80));
    
    const integrationTestQuery = "Отношения вне брака";
    console.log(`\n🔍 Integration Test Query: "${integrationTestQuery}"`);
    
    try {
      const { performVectorSearch } = await import('./lib/ai/vector-search');
      
      const startTime = Date.now();
      const result = await performVectorSearch(
        integrationTestQuery,
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
      
      console.log(`\n✅ Integration Test Results:`);
      console.log(`   📚 Citations Found: ${result.citations.length}`);
      console.log(`   🌐 Enhanced Query: "${result.improvedQueries[0] || 'N/A'}"`);
      console.log(`   ⏱️  Total Time: ${endTime - startTime}ms`);
      
      // Show citation sources
      const citationsBySource = result.citations.reduce((acc: Record<string, number>, citation) => {
        const source = citation.namespace || citation.metadata?.source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`   📊 Citations by Source:`);
      Object.entries(citationsBySource).forEach(([source, count]) => {
        console.log(`      ${source}: ${count} citations`);
      });
      
    } catch (error) {
      console.log(`❌ Integration test failed:`, error instanceof Error ? error.message : String(error));
    }
    
    console.log('\n🎉 Query enhancement testing completed!');
    
  } catch (error) {
    console.error('\n❌ Query enhancement test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

interface EnhancementAnalysis {
  hasTranslation: boolean;
  islamicTermsAdded: string[];
  hasContext: boolean;
  lengthIncrease: number;
  expectedTermsFound: number;
}

function analyzeEnhancement(original: string, enhanced: string, expectedTerms: string[]): EnhancementAnalysis {
  const originalLower = original.toLowerCase();
  const enhancedLower = enhanced.toLowerCase();
  
  // Check if translation occurred (non-English to English)
  const hasTranslation = /[а-яё]|[أ-ي]/.test(original) && !/[а-яё]|[أ-ي]/.test(enhanced);
  
  // Common Islamic terms to look for
  const islamicTerms = [
    'salah', 'sawm', 'zakat', 'hajj', 'nikah', 'wali', 'mahr', 'fidya', 'kaffara',
    'fiqh', 'jurisprudence', 'islamic law', 'according to islam', 'in islam',
    'quran', 'hadith', 'sunnah', 'sharia', 'halal', 'haram'
  ];
  
  const islamicTermsAdded = islamicTerms.filter(term => 
    !originalLower.includes(term) && enhancedLower.includes(term)
  );
  
  // Check if contextual information was added
  const contextPhrases = [
    'according to', 'in islamic', 'islamic law', 'jurisprudence', 'rules', 'conditions', 'requirements'
  ];
  
  const hasContext = contextPhrases.some(phrase => 
    !originalLower.includes(phrase) && enhancedLower.includes(phrase)
  );
  
  // Calculate length increase
  const lengthIncrease = enhanced.length / Math.max(original.length, 1);
  
  // Count expected terms found
  const expectedTermsFound = expectedTerms.filter(term => 
    enhancedLower.includes(term.toLowerCase())
  ).length;
  
  return {
    hasTranslation,
    islamicTermsAdded,
    hasContext,
    lengthIncrease,
    expectedTermsFound
  };
}

function calculateEnhancementScore(analysis: EnhancementAnalysis): number {
  let score = 0;
  
  // Translation (if needed) - 20 points
  if (analysis.hasTranslation) score += 20;
  
  // Islamic terms added - 30 points (up to 6 terms, 5 points each)
  score += Math.min(analysis.islamicTermsAdded.length * 5, 30);
  
  // Context added - 20 points
  if (analysis.hasContext) score += 20;
  
  // Length increase (good enhancement should be 2-4x longer) - 15 points
  if (analysis.lengthIncrease >= 2 && analysis.lengthIncrease <= 4) {
    score += 15;
  } else if (analysis.lengthIncrease > 1.5) {
    score += 10;
  }
  
  // Expected terms found - 15 points
  score += analysis.expectedTermsFound * 3;
  
  return Math.min(score, 100);
}

// Run the test
testQueryEnhancement().then(() => {
  console.log('\n🏁 Query enhancement test finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  process.exit(1);
}); 