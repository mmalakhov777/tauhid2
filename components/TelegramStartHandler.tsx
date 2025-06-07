'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

export function TelegramStartHandler() {
  const router = useRouter();
  const { webApp } = useTelegram();

  useEffect(() => {
    // Check multiple possible locations for the start parameter
    let startParam = null;
    
    // Method 1: From initDataUnsafe
    if (webApp && (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param) {
      startParam = (window as any).Telegram.WebApp.initDataUnsafe.start_param;
      console.log('[TelegramStartHandler] Start parameter from initDataUnsafe:', startParam);
    }
    
    // Method 2: From URL query parameters (tgWebAppStartParam)
    if (!startParam) {
      const urlParams = new URLSearchParams(window.location.search);
      startParam = urlParams.get('tgWebAppStartParam');
      console.log('[TelegramStartHandler] Start parameter from URL:', startParam);
    }
    
    // Method 3: From hash parameters
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
        
        // Navigate to the shared chat
        router.push(`/chat/${chatId}`);
        
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