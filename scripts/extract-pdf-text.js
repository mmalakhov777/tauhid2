const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse-fork');

async function extractPdfText() {
  const pdfDir = path.join(__dirname, '../public/pdfs/Risale-i Nur Bediuzzaman Said Nursi');
  const outputDir = path.join(__dirname, '../public/text-extracts');
  
  // Create output directory if it doesn't exist
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  try {
    // Get all PDF files
    const files = await fs.readdir(pdfDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    console.log(`Found ${pdfFiles.length} PDF files to process:`);
    pdfFiles.forEach(file => console.log(`  - ${file}`));
    
    for (const pdfFile of pdfFiles) {
      console.log(`\nProcessing: ${pdfFile}`);
      
      try {
        const pdfPath = path.join(pdfDir, pdfFile);
        const dataBuffer = await fs.readFile(pdfPath);
        
        // Extract text from PDF
        const data = await pdf(dataBuffer);
        
        console.log(`  - Total pages: ${data.numpages}`);
        console.log(`  - Total text length: ${data.text.length} characters`);
        
        // Estimate text per page (rough approximation)
        const avgCharsPerPage = data.text.length / data.numpages;
        console.log(`  - Average chars per page: ${Math.round(avgCharsPerPage)}`);
        
        // Create text file with page markers
        let textWithPages = '';
        const allText = data.text;
        
        for (let page = 1; page <= data.numpages; page++) {
          const startPos = Math.floor((page - 1) * avgCharsPerPage);
          const endPos = Math.floor(page * avgCharsPerPage);
          const pageText = allText.substring(startPos, endPos);
          
          textWithPages += `\n\n=== PAGE ${page} ===\n\n`;
          textWithPages += pageText.trim();
        }
        
        // Save to text file
        const textFileName = pdfFile.replace('.pdf', '.txt');
        const textFilePath = path.join(outputDir, textFileName);
        
        await fs.writeFile(textFilePath, textWithPages, 'utf8');
        console.log(`  - Saved: ${textFileName}`);
        
        // Also create a metadata file
        const metadataFileName = pdfFile.replace('.pdf', '_metadata.json');
        const metadataFilePath = path.join(outputDir, metadataFileName);
        
        const metadata = {
          originalFile: pdfFile,
          totalPages: data.numpages,
          totalCharacters: data.text.length,
          avgCharsPerPage: Math.round(avgCharsPerPage),
          extractedAt: new Date().toISOString()
        };
        
        await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');
        console.log(`  - Saved metadata: ${metadataFileName}`);
        
      } catch (error) {
        console.error(`  - Error processing ${pdfFile}:`, error.message);
      }
    }
    
    console.log('\n✅ Text extraction completed!');
    console.log(`📁 Text files saved to: ${outputDir}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the extraction
extractPdfText(); 