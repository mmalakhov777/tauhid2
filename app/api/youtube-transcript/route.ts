import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 30;

interface TranscriptItem {
  subtitle: string;
  start: number;
  dur: number;
}

interface YouTubeTranscriptResponse {
  title: string;
  description: string;
  availableLangs: string[];
  lengthInSeconds: string;
  thumbnails: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  transcription: TranscriptItem[];
}

function cleanTranscriptText(transcription: TranscriptItem[]): string {
  if (!transcription || transcription.length === 0) {
    return '';
  }

  // Extract and clean subtitle text
  let cleanedText = transcription
    .map(item => item.subtitle)
    .filter(subtitle => {
      // Remove common noise patterns
      const cleaned = subtitle.trim();
      
      // Skip empty strings
      if (!cleaned) return false;
      
      // Skip common noise patterns
      const noisePatterns = [
        /^\[.*\]$/, // [Applause], [Music], etc.
        /^♪.*♪$/, // Music notes
        /^-+$/, // Just dashes
        /^\.+$/, // Just dots
        /^[♪\[\]()]+$/, // Just symbols
      ];
      
      return !noisePatterns.some(pattern => pattern.test(cleaned));
    })
    .join(' ')
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const estimatedTokens = cleanedText.length / 4;
  const maxTokens = 20000;
  
  // If text is too long, truncate it
  if (estimatedTokens > maxTokens) {
    const maxChars = maxTokens * 4;
    cleanedText = cleanedText.substring(0, maxChars);
    
    // Try to cut at a sentence boundary
    const lastSentenceEnd = Math.max(
      cleanedText.lastIndexOf('.'),
      cleanedText.lastIndexOf('!'),
      cleanedText.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxChars * 0.8) { // If we can cut at a sentence and keep at least 80% of content
      cleanedText = cleanedText.substring(0, lastSentenceEnd + 1);
    }
    
    cleanedText += ' [Transcript truncated due to length]';
  }

  return cleanedText;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      console.log('[youtube-transcript] Unauthorized: No session');
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    let body: { videoId: string };
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[youtube-transcript] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { videoId } = body;

    if (!videoId) {
      console.error('[youtube-transcript] Missing videoId');
      return new Response(
        JSON.stringify({ error: 'Missing videoId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[youtube-transcript] Fetching transcript for video:', videoId);

    // Fetch transcript from RapidAPI
    const response = await fetch(
      `https://youtube-transcriptor.p.rapidapi.com/transcript?video_id=${videoId}&lang=en`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'youtube-transcriptor.p.rapidapi.com',
          'x-rapidapi-key': 'e6623326a6mshdc34ba8cecf8b23p17a021jsne72fd10d7336',
        },
      }
    );

    if (!response.ok) {
      console.error('[youtube-transcript] RapidAPI error:', {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`RapidAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data: YouTubeTranscriptResponse[] = await response.json();
    
    if (!data || data.length === 0) {
      console.error('[youtube-transcript] No transcript data received');
      return new Response(
        JSON.stringify({ error: 'No transcript data available' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const transcriptData = data[0];
    const cleanedText = cleanTranscriptText(transcriptData.transcription);

    console.log('[youtube-transcript] Transcript processed:', {
      videoId,
      originalItems: transcriptData.transcription?.length || 0,
      cleanedTextLength: cleanedText.length,
      estimatedTokens: Math.round(cleanedText.length / 4),
    });

    return new Response(
      JSON.stringify({
        success: true,
        transcript: cleanedText,
        metadata: {
          title: transcriptData.title,
          description: transcriptData.description,
          lengthInSeconds: transcriptData.lengthInSeconds,
          availableLangs: transcriptData.availableLangs,
        },
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[youtube-transcript] Error fetching transcript:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch YouTube transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 