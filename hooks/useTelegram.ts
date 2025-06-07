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

interface WebAppChat {
  id: number;
  type: 'group' | 'supergroup' | 'channel';
  title: string;
  username?: string;
  photo_url?: string;
}

interface WebAppInitData {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat?: WebAppChat;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
}

interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
}

interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

interface PopupParams {
  title?: string;
  message: string;
  buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text?: string;
  }>;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: WebAppInitData;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: MainButton;
  HapticFeedback: HapticFeedback;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (params: PopupParams) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: Array<'users' | 'bots' | 'groups' | 'channels'>) => void;
  setHeaderColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void;
  setBackgroundColor: (color: string) => void;
  isVersionAtLeast: (version: string) => boolean;
  // Bot API 7.7+ methods
  disableVerticalSwipes?: () => void;
  // Bot API 8.0+ methods
  lockOrientation?: () => void;
  unlockOrientation?: () => void;
  shareMessage?: (msg_id: string, callback?: (success: boolean) => void) => void;
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