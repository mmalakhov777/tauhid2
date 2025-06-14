'use client';

import { useState } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { telegramAuth } from '@/app/(auth)/actions';
import { toast } from '@/components/toast';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TelegramEmailForm } from './TelegramEmailForm';

interface TelegramAuthButtonProps {
  onSuccess?: () => void;
}

export const TelegramAuthButton = ({ onSuccess }: TelegramAuthButtonProps) => {
  const { user, isTelegramAvailable, isLoading, error } = useTelegram();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const router = useRouter();
  const { update: updateSession } = useSession();

  const handleTelegramAuth = async () => {
    if (!user) {
      toast({ type: 'error', description: 'Telegram user data not available' });
      return;
    }

    setIsAuthenticating(true);

    try {
      const result = await telegramAuth({
        telegramId: user.id,
        telegramUsername: user.username,
        telegramFirstName: user.first_name,
        telegramLastName: user.last_name,
        telegramPhotoUrl: user.photo_url,
        telegramLanguageCode: user.language_code,
        telegramIsPremium: user.is_premium,
        telegramAllowsWriteToPm: user.allows_write_to_pm,
      });

      if (result.status === 'success') {
        toast({ type: 'success', description: 'Successfully authenticated with Telegram!' });
        updateSession();
        router.refresh();
        onSuccess?.();
      } else if (result.status === 'needs_email') {
        // User exists but needs email/password for web access
        setShowEmailForm(true);
      } else {
        toast({ type: 'error', description: 'Failed to authenticate with Telegram' });
      }
    } catch (error) {
      console.error('Telegram auth error:', error);
      toast({ type: 'error', description: 'An error occurred during authentication' });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmailFormComplete = () => {
    setShowEmailForm(false);
    onSuccess?.();
  };

  const handleEmailFormSkip = async () => {
    if (!user) return;

    try {
      // Create user with dummy email and sign them in
      const result = await telegramAuth({
        telegramId: user.id,
        telegramUsername: user.username,
        telegramFirstName: user.first_name,
        telegramLastName: user.last_name,
        telegramPhotoUrl: user.photo_url,
        telegramLanguageCode: user.language_code,
        telegramIsPremium: user.is_premium,
        telegramAllowsWriteToPm: user.allows_write_to_pm,
        skipEmail: true,
      });

      if (result.status === 'success') {
        toast({ type: 'success', description: 'Signed in with Telegram! You can complete email setup later.' });
        updateSession();
        router.refresh();
        setShowEmailForm(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error('Skip auth error:', error);
      toast({ type: 'error', description: 'An error occurred during authentication' });
    }
  };

  if (isLoading) {
    return (
      <button 
        disabled 
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
      >
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Loading Telegram...
      </button>
    );
  }

  if (error || !isTelegramAvailable) {
    return (
      <div className="w-full p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
        <p className="font-medium">Telegram authentication unavailable</p>
        <p className="text-xs mt-1">This feature is only available in Telegram Mini Apps</p>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleTelegramAuth}
        disabled={isAuthenticating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
      >
        {isAuthenticating ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Authenticating...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.923 1.101-1.517.683 0 0-2.271-1.702-3.414-2.559-.24-.18-.513-.54-.24-.96l2.34-2.277c.26-.252.52-.756 0-.756-.52 0-3.414 2.277-3.414 2.277-.817.533-1.75.684-1.75.684l-3.293-.906s-.414-.252-.274-.756c.14-.504.793-.756.793-.756s7.776-2.834 10.428-3.788c.793-.286 1.793-.133 1.793 1.125z"/>
            </svg>
            Continue with Telegram
          </>
        )}
      </button>

      {showEmailForm && user && (
        <TelegramEmailForm 
          telegramUser={user} 
          onComplete={handleEmailFormComplete}
          onSkip={handleEmailFormSkip}
        />
      )}
    </>
  );
}; 