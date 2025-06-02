import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // 60 seconds timeout for audio processing

export async function POST(request: NextRequest) {
  try {
    // Get the audio from form data
    const formData = await request.formData();
    const audio = formData.get('audio');

    // Validate the audio input
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing or invalid audio file' },
        { status: 400 }
      );
    }

    // Check for Groq API key
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Missing GROQ_API_KEY environment variable' },
        { status: 500 }
      );
    }

    // Prepare the request to Groq's Whisper API
    const groqUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
    const groqForm = new FormData();
    groqForm.append('file', audio, 'voice.webm');
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');
    // Language parameter omitted for auto-detection

    // Make the request to Groq
    const groqRes = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: groqForm,
    });

    // Handle Groq API errors
    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq Whisper API error:', errText);
      return NextResponse.json(
        { error: 'Groq Whisper transcription failed', details: errText },
        { status: 500 }
      );
    }

    // Parse and return the transcription
    const data = await groqRes.json();
    return NextResponse.json({ 
      text: data.text ?? '',
      // Include detected language if available in response
      language: data.language ?? undefined
    });

  } catch (error) {
    console.error('Voice transcription error:', error);
    return NextResponse.json(
      { error: 'Internal server error during transcription' },
      { status: 500 }
    );
  }
} 