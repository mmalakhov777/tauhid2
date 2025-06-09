import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// We'll use dynamic import for pdfjs-dist to avoid build issues
export async function POST(request: NextRequest) {
  try {
    const { bookName, pageNumber } = await request.json();

    if (!bookName || !pageNumber) {
      return NextResponse.json(
        { error: 'Book name and page number are required' },
        { status: 400 }
      );
    }

    // Construct the text file path
    const textFilePath = path.join(
      process.cwd(),
      'public',
      'text-extracts',
      `${bookName}.txt`
    );

    const metadataFilePath = path.join(
      process.cwd(),
      'public',
      'text-extracts',
      `${bookName}_metadata.json`
    );

    console.log('[pdf-text] Reading text from:', textFilePath);

    // Check if text file exists
    try {
      await fs.access(textFilePath);
    } catch {
      return NextResponse.json(
        { error: 'Text file not found. PDF text may not have been extracted yet.' },
        { status: 404 }
      );
    }

    // Read the text file and metadata
    const textContent = await fs.readFile(textFilePath, 'utf8');
    
    let metadata = null;
    try {
      const metadataContent = await fs.readFile(metadataFilePath, 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch {
      console.log('[pdf-text] No metadata file found');
    }

    // Split text by page markers
    const pages = textContent.split(/=== PAGE \d+ ===/);
    // Remove the first empty element
    pages.shift();

    const totalPages = metadata?.totalPages || pages.length;

    // Get surrounding pages (current page + 2 before + 2 after)
    const startPage = Math.max(1, pageNumber - 2);
    const endPage = Math.min(totalPages, pageNumber + 2);

    // Extract text from the page range
    let extractedText = '';
    
    for (let i = startPage; i <= endPage; i++) {
      if (i <= pages.length) {
        extractedText += `\n\n=== PAGE ${i} ===\n\n`;
        extractedText += pages[i - 1]?.trim() || '[Page content not available]';
      }
    }

    // Clean up the text
    const cleanedText = extractedText
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();

    return NextResponse.json({
      success: true,
      text: cleanedText,
      currentPage: pageNumber,
      pageRange: `${startPage}-${endPage}`,
      totalPages: totalPages,
      bookName: bookName,
      extractedAt: metadata?.extractedAt || 'Unknown'
    });

  } catch (error) {
    console.error('[pdf-text] Error reading text file:', error);
    return NextResponse.json(
      { 
        error: 'Failed to read extracted text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 