'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  type Translations, 
  type TranslationKey, 
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  loadTranslations,
  translate
} from '@/lib/i18n';

interface TranslationContextType {
  t: (key: TranslationKey, fallback?: string) => string;
  language: SupportedLanguage;
  changeLanguage: (language: SupportedLanguage) => void;
  isLoading: boolean;
  translations: Translations;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [translations, setTranslations] = useState<Translations>({});
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage') as SupportedLanguage;
    if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  // Load translations when language changes
  useEffect(() => {
    let isMounted = true;
    
    const loadLanguageTranslations = async () => {
      setIsLoading(true);
      try {
        const newTranslations = await loadTranslations(language);
        if (isMounted) {
          setTranslations(newTranslations);
        }
      } catch (error) {
        console.error('Error loading translations:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadLanguageTranslations();

    return () => {
      isMounted = false;
    };
  }, [language]);

  // Translation function
  const t = useCallback((key: TranslationKey, fallback?: string) => {
    return translate(translations, key, fallback);
  }, [translations]);

  // Change language function
  const changeLanguage = useCallback((newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('selectedLanguage', newLanguage);
    
    // Dispatch a custom event to notify other tabs/windows
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: newLanguage }));
  }, []);

  // Listen for language changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedLanguage' && e.newValue) {
        const newLang = e.newValue as SupportedLanguage;
        if (SUPPORTED_LANGUAGES.some(lang => lang.code === newLang)) {
          setLanguage(newLang);
        }
      }
    };

    const handleLanguageChange = (e: CustomEvent) => {
      const newLang = e.detail as SupportedLanguage;
      if (SUPPORTED_LANGUAGES.some(lang => lang.code === newLang)) {
        setLanguage(newLang);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('languageChanged', handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, []);

  const value: TranslationContextType = {
    t,
    language,
    changeLanguage,
    isLoading,
    translations,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslations() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslations must be used within a TranslationProvider');
  }
  return context;
} 