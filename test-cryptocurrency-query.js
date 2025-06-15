require('dotenv').config({ path: '.env.local' });

const http = require('http');

const testData = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  message: {
    id: "550e8400-e29b-41d4-a716-446655440001",
    createdAt: new Date().toISOString(),
    role: "user",
    content: "Is cryptocurrency halal or haram in Islam?",
    parts: [
      {
        type: "text",
        text: "Is cryptocurrency halal or haram in Islam?"
      }
    ]
  },
  selectedChatModel: "chat-model",
  selectedVisibilityType: "private",
  selectedLanguage: "en",
  selectedSources: {
    classic: true,
    modern: true,
    risale: true,
    youtube: true,
    fatwa: true
  }
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/external-chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': 'Bearer your-super-secret-api-key-change-this-12345'
  }
};

console.log('🔍 Testing Cryptocurrency Query with External Chat API...');
console.log('Query: Is cryptocurrency halal or haram in Islam?');
console.log('Language: en');
console.log('URL: http://localhost:3000/api/external-chat');
console.log('');

console.log('--- Making External Chat API Request ---');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('--- External Chat API Response Complete ---');
    
    try {
      const parsed = JSON.parse(data);
      console.log('✅ Valid JSON Response:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.citations && Array.isArray(parsed.citations)) {
        console.log('\n📊 Citation Analysis:');
        console.log(`Total Citations: ${parsed.citations.length}`);
        
        const citationTypes = {
          classic: 0,
          modern: 0,
          risale: 0,
          youtube: 0,
          fatwa: 0,
          other: 0
        };
        
        parsed.citations.forEach((citation, index) => {
          const type = citation.metadata?.type || 
                      citation.metadata?.content_type || 
                      (citation.namespace ? 'namespace' : 'unknown');
          
          console.log(`  [${index + 1}] Type: ${type}, Score: ${citation.score?.toFixed(4) || 'N/A'}`);
          
          if (citation.metadata?.content_type === 'islamqa_fatwa' || 
              citation.metadata?.type === 'fatwa' || 
              citation.metadata?.type === 'FAT') {
            citationTypes.fatwa++;
            console.log(`    🎯 FATWA CITATION FOUND! Source: ${citation.metadata?.source_link || citation.metadata?.url || 'Unknown'}`);
          } else if (citation.namespace) {
            if (citation.namespace.includes('Sozler') || citation.namespace.includes('Mektubat')) {
              citationTypes.risale++;
            } else if (['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance'].includes(citation.namespace)) {
              citationTypes.youtube++;
            } else {
              citationTypes.other++;
            }
          } else if (!citation.metadata?.type && !citation.namespace) {
            citationTypes.classic++;
          } else {
            citationTypes.other++;
          }
        });
        
        console.log('\n📈 Citation Summary:');
        console.log(`  Classic: ${citationTypes.classic}`);
        console.log(`  Modern: ${citationTypes.modern}`);
        console.log(`  Risale: ${citationTypes.risale}`);
        console.log(`  YouTube: ${citationTypes.youtube}`);
        console.log(`  🎯 Fatwa: ${citationTypes.fatwa}`);
        console.log(`  Other: ${citationTypes.other}`);
        
        if (citationTypes.fatwa > 0) {
          console.log('\n✅ SUCCESS: Fatwa citations found! The fix is working.');
        } else {
          console.log('\n⚠️  WARNING: No fatwa citations found. May need further investigation.');
        }
      }
      
    } catch (error) {
      console.log('❌ Response is not valid JSON:', error.message);
      console.log('Raw response:', data.substring(0, 500) + (data.length > 500 ? '...' : ''));
      
      if (data.includes('vector-search-progress') || data.includes('Sorry I do not have enough information')) {
        console.log('\n📡 Detected streaming response format');
        
        const progressMatches = data.match(/"searchResults":\{[^}]+\}/g);
        if (progressMatches && progressMatches.length > 0) {
          try {
            const lastProgress = progressMatches[progressMatches.length - 1];
            const searchResults = JSON.parse('{' + lastProgress + '}').searchResults;
            
            console.log('\n🔍 Search Results from Progress:');
            console.log(`  Classic: ${searchResults.classic || 0}`);
            console.log(`  Modern: ${searchResults.modern || 0}`);
            console.log(`  Risale: ${searchResults.risale || 0}`);
            console.log(`  YouTube: ${searchResults.youtube || 0}`);
            console.log(`  🎯 Fatwa: ${searchResults.fatwa || 0}`);
            
            if (searchResults.fatwa > 0) {
              console.log('\n✅ SUCCESS: Fatwa results found in search!');
            } else {
              console.log('\n⚠️  WARNING: No fatwa results found in search.');
            }
          } catch (parseError) {
            console.log('❌ Could not parse search results from progress');
          }
        }
        
        if (data.includes('Sorry I do not have enough information')) {
          console.log('\n❌ ISSUE CONFIRMED: Still getting "insufficient information" response');
          console.log('This suggests the problem is not with citation filtering but with vector search not finding relevant content.');
        }
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error.message);
});

req.write(postData);
req.end(); 