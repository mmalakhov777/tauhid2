'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

export function TelegramStartHandler() {
  const router = useRouter();
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp && (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param) {
      const startParam = (window as any).Telegram.WebApp.initDataUnsafe.start_param;
      console.log('[TelegramStartHandler] Start parameter detected:', startParam);
      
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
    }
  }, [webApp, router]);

  return null;
} 