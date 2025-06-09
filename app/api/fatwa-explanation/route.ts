import { streamText } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { myProvider, fallbackProvider } from '@/lib/ai/providers';
import { ChatSDKError } from '@/lib/errors';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

export const maxDuration = 30;

interface FatwaExplanationRequest {
  originalText: string;
  userQuestion: string;
  responseContent: string;
  selectedLanguage: string;
  citationNumber: number;
  sourceName?: string;
}

const languageNames: { [key: string]: string } = {
  'en': 'English',
  'tr': 'Turkish',
  'ar': 'Arabic',
  'ru': 'Russian',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      console.log('[fatwa-explanation] Unauthorized: No session');
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    let body: FatwaExplanationRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[fatwa-explanation] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { 
      originalText, 
      userQuestion, 
      responseContent, 
      selectedLanguage, 
      citationNumber,
      sourceName 
    } = body;

    console.log('[fatwa-explanation] Request received:', {
      hasOriginalText: !!originalText,
      originalTextLength: originalText?.length || 0,
      hasUserQuestion: !!userQuestion,
      userQuestionLength: userQuestion?.length || 0,
      hasResponseContent: !!responseContent,
      responseContentLength: responseContent?.length || 0,
      selectedLanguage,
      citationNumber,
      sourceName
    });

    // Add detailed logging of actual content
    console.log('[fatwa-explanation] Detailed request data:');
    console.log('originalText:', originalText);
    console.log('userQuestion:', userQuestion);
    console.log('responseContent:', responseContent);
    console.log('selectedLanguage:', selectedLanguage);
    console.log('citationNumber:', citationNumber);
    console.log('sourceName:', sourceName);

    // Validate required fields
    if (!originalText || !userQuestion || !responseContent) {
      console.error('[fatwa-explanation] Missing required fields:', {
        originalText: !originalText ? 'missing' : 'present',
        userQuestion: !userQuestion ? 'missing' : 'present',
        responseContent: !responseContent ? 'missing' : 'present'
      });
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          details: {
            originalText: !originalText ? 'missing' : 'present',
            userQuestion: !userQuestion ? 'missing' : 'present',
            responseContent: !responseContent ? 'missing' : 'present'
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const languageName = languageNames[selectedLanguage || 'en'] || 'English';

    // Create a focused prompt for explaining the fatwa
    const systemPrompt = `You are an Islamic knowledge assistant specializing in explaining how classical Islamic texts and fatwas answer modern questions.

Your task is to explain how the provided source text specifically supports the main answer, focusing ONLY on this particular citation. 

CRITICAL INSTRUCTIONS:
1. DO NOT repeat any information that was already provided in the AI's original response
2. Focus EXCLUSIVELY on what THIS specific source contributes to answering the question
3. Identify UNIQUE insights, evidence, or reasoning from this source that adds NEW value
4. Explain the specific Islamic principles, methodology, or evidence in this source
5. Show how this source's approach or perspective uniquely supports the overall answer
6. If this source provides additional context, nuances, or supporting evidence not mentioned in the original response, highlight those

RESPONSE STYLE REQUIREMENTS:
- Be extremely factual and direct
- NO welcome phrases, greetings, or introductory sentences
- NO transitional phrases like "Furthermore," "Additionally," "In conclusion," etc.
- NO concluding statements or summary sentences
- Start immediately with the factual explanation
- Use concise, information-dense sentences
- Present only the essential facts and analysis
- Avoid any conversational or explanatory tone

IMPORTANT: Respond in ${languageName}.

Your explanation should provide ADDITIONAL value beyond what the user already read in the AI response. Focus on the unique contribution of this specific source. Be direct and factual only.`;

    const userPrompt = `Here is the context:

USER'S QUESTION: "${userQuestion}"

AI'S ORIGINAL RESPONSE (DO NOT REPEAT THIS INFORMATION):
"${responseContent}"

CURRENT SOURCE [Citation ${citationNumber}${sourceName ? ` from ${sourceName}` : ''}]:
"${originalText}"

Explain what UNIQUE information from this specific source supports the main answer. Focus only on what this source adds that wasn't already covered in the AI's response above. What specific insights, evidence, or Islamic reasoning does THIS source provide?`;

    console.log('[fatwa-explanation] Generating explanation:', {
      userQuestionLength: userQuestion.length,
      originalTextLength: originalText.length,
      responseContentLength: responseContent.length,
      language: selectedLanguage,
      citationNumber,
      sourceName
    });

    try {
      // Try primary provider first
      const result = await streamText({
        model: myProvider.languageModel(DEFAULT_CHAT_MODEL),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3, // Lower temperature for more focused explanations
        maxTokens: 1000, // Reasonable limit for explanations
      });

      return result.toTextStreamResponse();
    } catch (primaryError) {
      console.warn('[fatwa-explanation] Primary provider failed, trying fallback:', primaryError);
      
      // Fallback to secondary provider
      const result = await streamText({
        model: fallbackProvider.languageModel(DEFAULT_CHAT_MODEL),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 1000,
      });

      return result.toTextStreamResponse();
    }
  } catch (error) {
    console.error('[fatwa-explanation] Error generating explanation:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate explanation' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 