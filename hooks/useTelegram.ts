'use client';

import { useEffect, useState } from 'react';

interface WebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

interface WebAppInitData {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat?: any;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: WebAppInitData;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isActive: boolean;
  isExpanded: boolean;
  isFullscreen: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  // Bot API 8.0+ methods
  lockOrientation?: () => void;
  requestFullscreen?: () => void;
  // Bot API 7.7+ methods  
  disableVerticalSwipes?: () => void;
  // Bot API 6.1+ methods
  setBackgroundColor?: (color: string) => void;
  // Additional useful methods
  expand?: () => void;
  enableClosingConfirmation?: () => void;
  // Event methods
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
}

export const useTelegram = () => {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<WebAppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initTelegram = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          setWebApp(tg);
          setUser(tg.initDataUnsafe?.user || null);
          setError(null);
        } catch (e: any) {
          setError(`Error initializing Telegram WebApp: ${e.message}`);
          console.error("Telegram WebApp initialization error:", e);
        }
      } else {
        setError('Telegram WebApp not available');
      }
      setIsLoading(false);
    };

    // Check if Telegram script is already loaded
    if ((window as any).Telegram?.WebApp) {
      initTelegram();
    } else {
      // Wait for script to load
      const timeout = setTimeout(() => {
        initTelegram();
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, []);

  const isTelegramAvailable = webApp !== null && user !== null;

  return {
    webApp,
    user,
    isLoading,
    error,
    isTelegramAvailable,
  };
}; 