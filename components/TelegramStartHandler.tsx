'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

export function TelegramStartHandler() {
  const router = useRouter();
  const { webApp } = useTelegram();

  useEffect(() => {
    console.log('[TelegramStartHandler] Starting detection...');
    console.log('[TelegramStartHandler] Current URL:', window.location.href);
    console.log('[TelegramStartHandler] URL Search:', window.location.search);
    console.log('[TelegramStartHandler] URL Hash:', window.location.hash);
    
    // Log all Telegram WebApp data
    if ((window as any).Telegram?.WebApp) {
      console.log('[TelegramStartHandler] Telegram WebApp available');
      console.log('[TelegramStartHandler] initData:', (window as any).Telegram.WebApp.initData);
      console.log('[TelegramStartHandler] initDataUnsafe:', (window as any).Telegram.WebApp.initDataUnsafe);
    }
    
    // Check multiple possible locations for the start parameter
    let startParam = null;
    
    // Method 1: From initDataUnsafe
    if (webApp && (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param) {
      startParam = (window as any).Telegram.WebApp.initDataUnsafe.start_param;
      console.log('[TelegramStartHandler] Start parameter from initDataUnsafe:', startParam);
    }
    
    // Method 2: Parse from initData string
    if (!startParam && (window as any).Telegram?.WebApp?.initData) {
      const initDataParams = new URLSearchParams((window as any).Telegram.WebApp.initData);
      startParam = initDataParams.get('start_param');
      console.log('[TelegramStartHandler] Start parameter from initData string:', startParam);
    }
    
    // Method 3: From URL query parameters (tgWebAppStartParam)
    if (!startParam) {
      const urlParams = new URLSearchParams(window.location.search);
      startParam = urlParams.get('tgWebAppStartParam');
      console.log('[TelegramStartHandler] Start parameter from URL:', startParam);
    }
    
    // Method 4: From hash parameters
    if (!startParam && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      startParam = hashParams.get('tgWebAppStartParam');
      console.log('[TelegramStartHandler] Start parameter from hash:', startParam);
    }
    
    if (startParam) {
      console.log('[TelegramStartHandler] Final start parameter:', startParam);
      
      // Check if it's a chat share link
      if (startParam.startsWith('chat_')) {
        const chatId = startParam.replace('chat_', '');
        console.log('[TelegramStartHandler] Navigating to chat:', chatId);
        
        // Small delay to ensure app is fully initialized
        setTimeout(() => {
          router.push(`/chat/${chatId}`);
        }, 100);
        
        // Clear the start parameter to prevent re-navigation
        if ((window as any).Telegram?.WebApp?.initDataUnsafe) {
          (window as any).Telegram.WebApp.initDataUnsafe.start_param = undefined;
        }
      }
    } else {
      console.log('[TelegramStartHandler] No start parameter found');
    }
  }, [webApp, router]);

  return null;
} 