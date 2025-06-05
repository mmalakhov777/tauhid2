'use client';

import { useCallback } from 'react';

interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export function useTelegramHaptics() {
  const impactOccurred = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    try {
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.impactOccurred(style);
      }
    } catch (error) {
      console.error('Failed to trigger haptic impact:', error);
    }
  }, []);

  const notificationOccurred = useCallback((type: 'error' | 'success' | 'warning') => {
    try {
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred(type);
      }
    } catch (error) {
      console.error('Failed to trigger haptic notification:', error);
    }
  }, []);

  const selectionChanged = useCallback(() => {
    try {
      if ((window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    } catch (error) {
      console.error('Failed to trigger haptic selection:', error);
    }
  }, []);

  return {
    impactOccurred,
    notificationOccurred,
    selectionChanged,
  };
} 