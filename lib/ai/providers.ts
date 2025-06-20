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
    'chat-model': openrouter.chat('meta-llama/llama-4-scout:nitro'),
    'chat-model-reasoning': wrapLanguageModel({
      model: openrouter.chat('deepseek/deepseek-r1-0528:nitro'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': openrouter.chat('meta-llama/llama-4-scout:nitro'),
    'explanation-model': openrouter.chat('meta-llama/llama-4-maverick:nitro'),
  },
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'explanation-model': chatModel, // Use chatModel as fallback in test environment
      },
    })
  : openrouterProvider;

// Export the same provider as fallback (no actual fallback needed now)
export const fallbackProvider = openrouterProvider;
