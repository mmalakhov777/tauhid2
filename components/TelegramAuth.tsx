'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from './icons';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      is_bot?: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      allows_write_to_pm?: boolean;
      photo_url?: string;
    };
    auth_date: number;
    hash: string;
  };
  ready: () => void;
}

export default function TelegramAuth({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authenticateTelegramUser = async () => {
      // Skip if already authenticated or in process
      if (status === 'loading' || isAuthenticating || session?.user) {
        return;
      }

      const tg = (window as any).Telegram?.WebApp as TelegramWebApp | undefined;
      if (!tg || !tg.initDataUnsafe?.user) {
        return;
      }

      const telegramUser = tg.initDataUnsafe.user;
      const authData = tg.initDataUnsafe;
      
      // Check if this is a Telegram user that needs authentication
      if (telegramUser.id) {
        setIsAuthenticating(true);
        try {
          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: telegramUser.id,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name,
              username: telegramUser.username,
              photo_url: telegramUser.photo_url,
              language_code: telegramUser.language_code,
              is_premium: telegramUser.is_premium,
              allows_write_to_pm: telegramUser.allows_write_to_pm,
              auth_date: authData.auth_date,
              hash: authData.hash,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || 'Failed to authenticate with Telegram');
            console.error('Telegram auth error:', result);
          } else {
            // Update the session and refresh
            await update();
            router.refresh();
          }
        } catch (error) {
          setError('Authentication error occurred');
          console.error('Telegram auth exception:', error);
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    // Wait a bit for Telegram WebApp to initialize
    const timeoutId = setTimeout(() => {
      authenticateTelegramUser();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [status, session, isAuthenticating, router, update]);

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <LoaderIcon size={32} />
          <p className="text-sm text-muted-foreground">Authenticating with Telegram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">Authentication Error</p>
          <p className="text-xs text-red-500 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 