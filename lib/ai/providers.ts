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

// Create OpenRouter instance as fallback
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

// Primary provider (Groq)
const groqProvider = customProvider({
  languageModels: {
    'chat-model': groq('mistral-saba-24b'),
    'chat-model-reasoning': wrapLanguageModel({
      model: groq('mistral-saba-24b'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': groq('mistral-saba-24b'),
  },
});

// Fallback provider (OpenRouter)
const openrouterProvider = customProvider({
  languageModels: {
    'chat-model': openrouter.chat('mistralai/mistral-7b-instruct'),
    'chat-model-reasoning': wrapLanguageModel({
      model: openrouter.chat('mistralai/mistral-7b-instruct'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': openrouter.chat('mistralai/mistral-7b-instruct'),
  },
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
      },
    })
  : groqProvider;

// Export fallback provider for use when Groq fails
export const fallbackProvider = openrouterProvider;
