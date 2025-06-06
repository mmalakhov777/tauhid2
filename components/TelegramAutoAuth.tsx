'use client';

import { useEffect, useState, useRef } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { telegramAuth } from '@/app/(auth)/actions';
import { toast } from '@/components/toast';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TelegramEmailForm } from './TelegramEmailForm';

export const TelegramAutoAuth = () => {
  const { user: telegramUser, isTelegramAvailable, isLoading } = useTelegram();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasAttemptedAuth = useRef(false);
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  useEffect(() => {
    const autoAuthenticate = async () => {
      // Only run once, if we have Telegram data, and user is not already authenticated
      if (
        !hasAttemptedAuth.current && 
        !isLoading && 
        isTelegramAvailable && 
        telegramUser && 
        !session?.user
      ) {
        hasAttemptedAuth.current = true;
        setIsAuthenticating(true);

        try {
          const result = await telegramAuth({
            telegramId: telegramUser.id,
            telegramUsername: telegramUser.username,
            telegramFirstName: telegramUser.first_name,
            telegramLastName: telegramUser.last_name,
            telegramPhotoUrl: telegramUser.photo_url,
            telegramLanguageCode: telegramUser.language_code,
            telegramIsPremium: telegramUser.is_premium,
            telegramAllowsWriteToPm: telegramUser.allows_write_to_pm,
          });

          if (result.status === 'success') {
            toast({ type: 'success', description: `Welcome back, ${telegramUser.first_name}!` });
            updateSession();
            router.refresh();
          } else if (result.status === 'needs_email') {
            // New user - show email form
            setShowEmailForm(true);
            toast({ 
              type: 'success', 
              description: 'Welcome! Please complete your account setup to access all features.' 
            });
          }
        } catch (error) {
          console.error('Auto-authentication error:', error);
          // Silent fail - user can still use manual auth buttons
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    autoAuthenticate();
  }, [isLoading, isTelegramAvailable, telegramUser, session, updateSession, router]);

  const handleEmailFormComplete = () => {
    setShowEmailForm(false);
    toast({ type: 'success', description: 'Account setup completed successfully!' });
    updateSession();
    router.refresh();
  };

  const handleEmailFormSkip = async () => {
    if (!telegramUser) return;

    try {
      // Create user with dummy email and sign them in
      const result = await telegramAuth({
        telegramId: telegramUser.id,
        telegramUsername: telegramUser.username,
        telegramFirstName: telegramUser.first_name,
        telegramLastName: telegramUser.last_name,
        telegramPhotoUrl: telegramUser.photo_url,
        telegramLanguageCode: telegramUser.language_code,
        telegramIsPremium: telegramUser.is_premium,
        telegramAllowsWriteToPm: telegramUser.allows_write_to_pm,
        skipEmail: true,
      });

      if (result.status === 'success') {
        toast({ type: 'success', description: `Welcome, ${telegramUser.first_name}! You can complete email setup later.` });
        updateSession();
        router.refresh();
        setShowEmailForm(false);
      }
    } catch (error) {
      console.error('Skip auth error:', error);
      toast({ type: 'error', description: 'An error occurred during authentication' });
    }
  };

  // Show loading indicator while authenticating
  if (isAuthenticating) {
    return (
      <div className="fixed top-4 right-4 bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 flex items-center gap-3 z-50">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Authenticating with Telegram...</span>
      </div>
    );
  }

  // Show email form if needed
  if (showEmailForm && telegramUser) {
    return (
      <TelegramEmailForm 
        telegramUser={telegramUser} 
        onComplete={handleEmailFormComplete}
        onSkip={handleEmailFormSkip}
      />
    );
  }

  return null;
}; 