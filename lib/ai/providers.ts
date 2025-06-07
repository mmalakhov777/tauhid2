import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { isTestEnvironment } from '../constants';
import {
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

// Create OpenRouter instance as primary provider
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

// Primary provider (OpenRouter)
const openrouterProvider = customProvider({
  languageModels: {
    'chat-model': openrouter.chat('mistralai/mistral-saba:nitro'),
    'chat-model-reasoning': wrapLanguageModel({
      model: openrouter.chat('mistralai/mistral-saba:nitro'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': openrouter.chat('mistralai/mistral-saba:nitro'),
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
  : openrouterProvider;

// Export the same provider as fallback (no actual fallback needed now)
export const fallbackProvider = openrouterProvider;
