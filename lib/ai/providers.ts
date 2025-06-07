import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { isTestEnvironment } from '../constants';
import {
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

// Initialize OpenRouter provider
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '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',
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': groq('mistral-saba-24b'),
        'chat-model-reasoning': wrapLanguageModel({
          model: groq('mistral-saba-24b'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': groq('mistral-saba-24b'),
        'title-model-fallback': openrouter.chat('meta-llama/llama-3.2-3b-instruct'),
      },
    });
