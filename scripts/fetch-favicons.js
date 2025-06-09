const fs = require('fs');
const path = require('path');
const https = require('https');

// List of domains to fetch favicons for
const domains = [
  'islamqa.org',
  'islamqa.info',
  'muftionline.co.za',
  'daruliftaa.us',
  'askimam.org',
  'hadithanswers.com',
  'daruliftabirmingham.co.uk',
  'seekersguidance.org',
  'darulifta-deoband.com',
  'shariahboard.org',
  'islamweb.net',
  'dar-alifta.org',
  'islamonline.net'
];

// Function to download a file from URL
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Function to fetch favicon for a domain
async function fetchFavicon(domain) {
  try {
    console.log(`Fetching favicon for ${domain}...`);
    
    // Get the largest favicon (256px)
    const faviconUrl = `https://favicone.com/${domain}?s=256`;
    const filename = `${domain}.png`;
    const filepath = path.join(__dirname, '..', 'public', 'favicons', filename);
    
    await downloadFile(faviconUrl, filepath);
    console.log(`✅ Successfully downloaded favicon for ${domain}`);
    
    return { domain, success: true, filename };
  } catch (error) {
    console.error(`❌ Failed to download favicon for ${domain}:`, error.message);
    return { domain, success: false, error: error.message };
  }
}

// Main function to fetch all favicons
async function fetchAllFavicons() {
  console.log('🚀 Starting favicon download process...\n');
  
  const results = [];
  
  for (const domain of domains) {
    const result = await fetchFavicon(domain);
    results.push(result);
    
    // Add a small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Successful: ${results.filter(r => r.success).length}`);
  console.log(`❌ Failed: ${results.filter(r => !r.success).length}`);
  
  if (results.some(r => !r.success)) {
    console.log('\n❌ Failed domains:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.domain}: ${r.error}`);
    });
  }
  
  console.log('\n🎉 Favicon download process completed!');
}

// Run the script
fetchAllFavicons().catch(console.error); 