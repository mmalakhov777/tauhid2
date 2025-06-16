'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n';

interface TelegramBindingBannerProps {
  user: {
    email?: string | null;
    telegramId?: number | null;
  };
  onClick?: () => void;
}

export const TelegramBindingBanner = ({ user, onClick }: TelegramBindingBannerProps) => {
  const { t } = useTranslations();
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
      className={`mx-2 mb-2 p-3 bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-xl shadow-lg cursor-pointer transition-all duration-200 ${
        isClicked 
          ? 'scale-95 bg-white/25 dark:bg-white/15' 
          : 'hover:bg-white/15 dark:hover:bg-white/8 hover:scale-[1.02] active:scale-[0.98]'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-amber-400 dark:text-amber-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/90">
            {t('banners.connectTelegram')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('banners.telegramDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}; 