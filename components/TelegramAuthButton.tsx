'use client';

import { useState, useEffect } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { telegramAuth } from '@/app/(auth)/actions';
import { toast } from '@/components/toast';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuthLoading } from '@/contexts/AuthLoadingContext';
import { TelegramEmailForm } from './TelegramEmailForm';

interface TelegramAuthButtonProps {
  onSuccess?: () => void;
}

// Telegram Login Widget data interface
interface TelegramLoginData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export const TelegramAuthButton = ({ onSuccess }: TelegramAuthButtonProps) => {
  const { user, isTelegramAvailable, isLoading, error } = useTelegram();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { isAuthLoading, setIsAuthLoading } = useAuthLoading();

  // Global callback function for Telegram Login Widget - must be set before script loads
  useEffect(() => {
    console.log('[TelegramAuthButton] Setting up global onTelegramAuth callback');
    
    (window as any).onTelegramAuth = async (telegramData: TelegramLoginData) => {
      console.log('[TelegramAuthButton] onTelegramAuth callback triggered with data:', telegramData);
      setIsAuthenticating(true);
      setIsAuthLoading(true); // Set global loading state like TelegramAutoAuth
      
      try {
        const result = await telegramAuth({
          telegramId: telegramData.id,
          telegramUsername: telegramData.username,
          telegramFirstName: telegramData.first_name,
          telegramLastName: telegramData.last_name,
          telegramPhotoUrl: telegramData.photo_url,
        });

        if (result.status === 'success') {
          toast({ type: 'success', description: `Welcome back, ${telegramData.first_name}!` });
          updateSession();
          
          // Don't clear loading state here - let the chat component do it like TelegramAutoAuth
          setIsAuthenticating(false);
          router.refresh();
          onSuccess?.();
        } else if (result.status === 'needs_email') {
          // New user - create them with dummy email immediately, like in TelegramAutoAuth
          console.log('New user detected via widget, creating with dummy email...');
          
          const skipResult = await telegramAuth({
            telegramId: telegramData.id,
            telegramUsername: telegramData.username,
            telegramFirstName: telegramData.first_name,
            telegramLastName: telegramData.last_name,
            telegramPhotoUrl: telegramData.photo_url,
            skipEmail: true,
          });

          if (skipResult.status === 'success') {
            toast({ type: 'success', description: `Welcome, ${telegramData.first_name}! You can start chatting right away.` });
            updateSession();
            
            // Don't clear loading state here - let the chat component do it like TelegramAutoAuth
            setIsAuthenticating(false);
            router.refresh();
            onSuccess?.();
          } else {
            toast({ type: 'error', description: 'Failed to complete account setup' });
            setIsAuthLoading(false); // Clear loading on error
          }
        } else {
          toast({ type: 'error', description: 'Failed to authenticate with Telegram' });
          setIsAuthLoading(false); // Clear loading on error
        }
      } catch (error) {
        console.error('Telegram auth error:', error);
        toast({ type: 'error', description: 'An error occurred during authentication' });
        setIsAuthLoading(false); // Clear loading on error
      } finally {
        setIsAuthenticating(false);
      }
    };

    return () => {
      // Cleanup
      console.log('[TelegramAuthButton] Cleaning up onTelegramAuth callback');
      delete (window as any).onTelegramAuth;
    };
  }, [updateSession, router, onSuccess, setIsAuthLoading]);

  // Load Telegram Login Widget script - after callback is set
  useEffect(() => {
    // Only load widget if not in Telegram Mini App and callback is ready
    if (!isTelegramAvailable && !isLoading && !error && (window as any).onTelegramAuth) {
      console.log('[TelegramAuthButton] Loading Telegram Login Widget...');
      
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', 'tauhid_app_bot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth');
      script.setAttribute('data-request-access', 'write');
      
      script.onload = () => {
        console.log('[TelegramAuthButton] Telegram widget script loaded successfully');
        setWidgetLoaded(true);
      };
      
      script.onerror = (error) => {
        console.error('[TelegramAuthButton] Failed to load Telegram widget script:', error);
      };
      
      // Add the script to a container
      const container = document.getElementById('telegram-login-container');
      if (container && !container.hasChildNodes()) {
        container.appendChild(script);
        console.log('[TelegramAuthButton] Telegram widget script added to DOM');
      } else if (!container) {
        console.error('[TelegramAuthButton] Container element not found');
      } else {
        console.log('[TelegramAuthButton] Widget already loaded');
        setWidgetLoaded(true);
      }
    }
  }, [isTelegramAvailable, isLoading, error]);

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

  // If in Telegram Mini App, show the original button
  if (isTelegramAvailable) {
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
  }

  // For regular browsers, show the Telegram Login Widget
  return (
    <>
      <div className="w-full">
        {(isAuthenticating || isAuthLoading) && (
          <div className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg mb-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            {isAuthLoading && !isAuthenticating ? 'Loading Chat...' : 'Authenticating with Telegram...'}
          </div>
        )}
        
        <div 
          id="telegram-login-container" 
          className="w-full flex justify-center"
          style={{ minHeight: '40px' }}
          onClick={(e) => {
            console.log('[TelegramAuthButton] Widget container clicked', e.target);
            console.log('[TelegramAuthButton] onTelegramAuth function exists:', typeof (window as any).onTelegramAuth);
          }}
        />
        
        {!widgetLoaded && !isAuthenticating && !isAuthLoading && (
          <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p className="font-medium">Loading Telegram Login...</p>
            <p className="text-xs mt-1">Please wait while we load the Telegram authentication widget</p>
          </div>
        )}
      </div>

      {showEmailForm && (
        <TelegramEmailForm 
          telegramUser={{
            id: 0, // Will be set by the callback
            first_name: '',
            last_name: '',
            username: '',
            photo_url: ''
          }} 
          onComplete={handleEmailFormComplete}
          onSkip={handleEmailFormSkip}
        />
      )}
    </>
  );
}; 