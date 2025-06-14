'use client';

import { useState } from 'react';

interface TelegramBindingBannerProps {
  user: {
    email?: string | null;
    telegramId?: number | null;
  };
  onClick?: () => void;
}

export const TelegramBindingBanner = ({ user, onClick }: TelegramBindingBannerProps) => {
  const [isClicked, setIsClicked] = useState(false);

  // Check if user has email but no Telegram data (needs Telegram binding)
  const needsTelegramBinding = user.email && 
                               !user.telegramId && 
                               !user.email.startsWith('guest_') && 
                               !user.email.startsWith('telegram_');

  if (!needsTelegramBinding) {
    return null;
  }

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200); // Visual feedback
    onClick?.();
  };

  return (
    <div 
      className={`mx-2 mb-2 p-3 bg-blue-500/10 dark:bg-blue-500/5 backdrop-blur-md border border-blue-500/20 dark:border-blue-500/10 rounded-xl shadow-lg cursor-pointer transition-all duration-200 ${
        isClicked 
          ? 'scale-95 bg-blue-500/25 dark:bg-blue-500/15' 
          : 'hover:bg-blue-500/15 dark:hover:bg-blue-500/8 hover:scale-[1.02] active:scale-[0.98]'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-blue-400 dark:text-blue-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.923 1.101-1.517.683 0 0-2.271-1.702-3.414-2.559-.24-.18-.513-.54-.24-.96l2.34-2.277c.26-.252.52-.756 0-.756-.52 0-3.414 2.277-3.414 2.277-.817.533-1.75.684-1.75.684l-3.293-.906s-.414-.252-.274-.756c.14-.504.793-.756.793-.756s7.776-2.834 10.428-3.788c.793-.286 1.793-.133 1.793 1.125z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/90">
            Connect Telegram Account {isClicked && '✓'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Link your Telegram to access chat features and notifications
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}; 