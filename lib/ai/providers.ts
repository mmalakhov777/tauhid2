import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';
import { isTestEnvironment } from '../constants';
import {
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

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
        'title-model': groq('llama-3.3-70b-versatile'),
      },
    });
