'use client';

import { useState } from 'react';
import { TelegramEmailForm } from './TelegramEmailForm';
import { useTelegram } from '@/hooks/useTelegram';
import { toast } from '@/components/toast';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface EmailSetupBannerProps {
  user: {
    email?: string | null;
  };
}

export const EmailSetupBanner = ({ user }: EmailSetupBannerProps) => {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { user: telegramUser } = useTelegram();
  const router = useRouter();
  const { update: updateSession } = useSession();

  // Check if user has a dummy email (needs setup)
  const needsEmailSetup = user.email?.startsWith('telegram_') && user.email?.endsWith('@telegram.local');

  if (!needsEmailSetup || !telegramUser) {
    return null;
  }

  const handleCompleteSetup = () => {
    setShowEmailForm(true);
  };

  const handleEmailFormComplete = () => {
    setShowEmailForm(false);
    toast({ type: 'success', description: 'Email setup completed! You can now access the web app.' });
    updateSession();
    router.refresh();
  };

  const handleEmailFormSkip = () => {
    setShowEmailForm(false);
  };

  return (
    <>
      <div className="mx-2 mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Email Setup Pending
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Complete your email setup to access the web app outside Telegram
            </p>
            <button
              onClick={handleCompleteSetup}
              className="mt-2 text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded transition-colors"
            >
              Complete Setup
            </button>
          </div>
        </div>
      </div>

      {showEmailForm && telegramUser && (
        <TelegramEmailForm 
          telegramUser={telegramUser} 
          onComplete={handleEmailFormComplete}
          onSkip={handleEmailFormSkip}
        />
      )}
    </>
  );
}; 