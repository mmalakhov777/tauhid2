import { TelegramTranslations } from './types';
import { en } from './en';
import { ru } from './ru';
import { es } from './es';
import { fr } from './fr';
import { tr } from './tr';
import { ar } from './ar';

// Language map
const translations: Record<string, TelegramTranslations> = {
  en,
  ru,
  es,
  fr,
  tr,
  ar
};

// Default language
const DEFAULT_LANGUAGE = 'en';

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'ru', 'es', 'fr', 'tr', 'ar'];

/**
 * Get user's language from Telegram language code
 */
export function getUserLanguage(telegramLanguageCode?: string): string {
  if (!telegramLanguageCode) return DEFAULT_LANGUAGE;
  
  // Extract the main language code (e.g., 'en' from 'en-US')
  const mainLanguage = telegramLanguageCode.split('-')[0].toLowerCase();
  
  // Return the language if supported, otherwise default
  return SUPPORTED_LANGUAGES.includes(mainLanguage) ? mainLanguage : DEFAULT_LANGUAGE;
}

/**
 * Get translations for a specific language
 */
export function getTranslations(languageCode: string): TelegramTranslations {
  return translations[languageCode] || translations[DEFAULT_LANGUAGE];
}

/**
 * Format text with variables (e.g., replace {userName} with actual value)
 */
export function formatText(text: string, variables: Record<string, string | number> = {}): string {
  let formattedText = text;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    formattedText = formattedText.replace(new RegExp(placeholder, 'g'), String(value));
  }
  
  return formattedText;
}

// Export types and individual language files
export type { TelegramTranslations } from './types';
export { en, ru, es, fr, tr, ar }; 