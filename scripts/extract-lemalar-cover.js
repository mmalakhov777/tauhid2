const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// URLs and paths
const LEMALAR_PDF_URL = 'https://archive.org/download/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/lemalar-bediuzzaman_said_nursi.pdf';
const TEMP_PDF_PATH = path.join(__dirname, 'temp_lemalar.pdf');
const TEMP_PNG_PATH = path.join(__dirname, 'temp_lemalar_page1.png');
const FINAL_WEBP_PATH = path.join(__dirname, '../public/images/risaleinur/lemalar-bediuzzaman_said_nursi.webp');

async function downloadPDF(url, maxRedirects = 5) {
  console.log('Downloading Lemalar PDF...');
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(TEMP_PDF_PATH);
    
    function makeRequest(currentUrl, redirectCount = 0) {
      const isHttps = currentUrl.startsWith('https:');
      const client = isHttps ? https : http;
      
      client.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if (redirectCount >= maxRedirects) {
            reject(new Error('Too many redirects'));
            return;
          }
          
          console.log(`Following redirect to: ${response.headers.location}`);
          makeRequest(response.headers.location, redirectCount + 1);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download PDF: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('PDF downloaded successfully');
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(TEMP_PDF_PATH, () => {}); // Delete the file on error
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    }
    
    makeRequest(url);
  });
}

async function extractFirstPage() {
  console.log('Extracting first page from PDF...');
  
  try {
    // Use pdftoppm to convert first page to PNG (high quality)
    const baseOutputName = path.join(__dirname, 'temp_lemalar_page1');
    await execAsync(`pdftoppm -png -f 1 -l 1 -scale-to-x 800 -scale-to-y -1 "${TEMP_PDF_PATH}" "${baseOutputName}"`);
    
    // pdftoppm creates files with -001, -002, etc. suffix
    const actualPngPath = baseOutputName + '-001.png';
    if (fs.existsSync(actualPngPath)) {
      fs.renameSync(actualPngPath, TEMP_PNG_PATH);
      console.log('First page extracted successfully');
    } else {
      throw new Error(`Expected PNG file not found: ${actualPngPath}`);
    }
  } catch (error) {
    console.error('Error extracting first page:', error);
    throw error;
  }
}

async function convertToWebP() {
  console.log('Converting to WebP format...');
  
  try {
    // Remove old cover image
    if (fs.existsSync(FINAL_WEBP_PATH)) {
      fs.unlinkSync(FINAL_WEBP_PATH);
      console.log('Old cover image deleted');
    }
    
    // Convert PNG to WebP with good quality
    await execAsync(`cwebp -q 85 "${TEMP_PNG_PATH}" -o "${FINAL_WEBP_PATH}"`);
    
    console.log('Cover image converted to WebP successfully');
  } catch (error) {
    console.error('Error converting to WebP:', error);
    throw error;
  }
}

async function cleanup() {
  console.log('Cleaning up temporary files...');
  
  // Remove temporary files
  [TEMP_PDF_PATH, TEMP_PNG_PATH].forEach(filePath => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted: ${filePath}`);
    }
  });
}

async function main() {
  try {
    console.log('Starting Lemalar cover extraction process...');
    
    // Check if required tools are installed
    try {
      await execAsync('pdftoppm -h');
      await execAsync('cwebp -version');
    } catch (error) {
      console.error('Required tools not found. Please install:');
      console.error('- poppler-utils (for pdftoppm): brew install poppler');
      console.error('- webp (for cwebp): brew install webp');
      process.exit(1);
    }
    
    await downloadPDF(LEMALAR_PDF_URL);
    await extractFirstPage();
    await convertToWebP();
    await cleanup();
    
    console.log('✅ Lemalar cover extraction completed successfully!');
    console.log(`New cover saved to: ${FINAL_WEBP_PATH}`);
    
  } catch (error) {
    console.error('❌ Error during cover extraction:', error);
    await cleanup();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main }; 