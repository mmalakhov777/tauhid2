// Core i18n utilities and types

// Type for the translation keys
export type TranslationKey = string;

// Type for the translations object
export type Translations = Record<string, any>;

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'ru', name: 'Русский' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Cache for loaded translations
const translationCache: Record<string, Translations> = {};

// Load translations for a specific language
export async function loadTranslations(language: SupportedLanguage): Promise<Translations> {
  if (translationCache[language]) {
    return translationCache[language];
  }

  try {
    const response = await fetch(`/locales/${language}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${language}`);
    }
    const translations = await response.json();
    translationCache[language] = translations;
    return translations;
  } catch (error) {
    console.error(`Error loading translations for ${language}:`, error);
    // Fallback to English if available
    if (language !== 'en' && !translationCache['en']) {
      try {
        const fallbackResponse = await fetch('/locales/en.json');
        if (fallbackResponse.ok) {
          const fallbackTranslations = await fallbackResponse.json();
          translationCache['en'] = fallbackTranslations;
          return fallbackTranslations;
        }
      } catch (fallbackError) {
        console.error('Error loading fallback translations:', fallbackError);
      }
    }
    return translationCache['en'] || {};
  }
}

// Get nested value from object using dot notation
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Translation function
export function translate(
  translations: Translations,
  key: TranslationKey,
  fallback?: string
): string {
  const value = getNestedValue(translations, key);
  
  if (value !== undefined) {
    return value;
  }
  
  // Return fallback or the key itself
  return fallback || key;
}

// Re-export the hook from the context
export { useTranslations } from '@/contexts/TranslationContext';

// Server-side translation function for API routes
export async function getServerTranslations(language: SupportedLanguage = 'en'): Promise<Translations> {
  try {
    // In server environment, we need to read from file system
    const fs = await import('fs');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'locales', `${language}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading server translations for ${language}:`, error);
    return {};
  }
}

// Server-side translate function
export function serverTranslate(
  translations: Translations,
  key: TranslationKey,
  fallback?: string
): string {
  return translate(translations, key, fallback);
} 