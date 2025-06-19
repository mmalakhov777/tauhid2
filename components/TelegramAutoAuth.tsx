'use client';

import { useEffect, useState, useRef } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { telegramAuth } from '@/app/(auth)/actions';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useAuthLoading } from '@/contexts/AuthLoadingContext';
import { TelegramEmailForm } from './TelegramEmailForm';

export const TelegramAutoAuth = () => {
  const { user: telegramUser, webApp, isTelegramAvailable, isLoading } = useTelegram();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasAttemptedAuth = useRef(false);
  const hasOptimizedWebApp = useRef(false);
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { theme } = useTheme();
  const { isAuthLoading, setIsAuthLoading } = useAuthLoading();
  const [isLoaderVisible, setIsLoaderVisible] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Sync loader visibility with loading states
  useEffect(() => {
    if (isAuthenticating || isAuthLoading) {
      setIsLoaderVisible(true);
    } else {
      // Delay hiding to allow for fade out
      const timer = setTimeout(() => {
        setIsLoaderVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticating, isAuthLoading]);

  // Telegram WebApp optimizations
  useEffect(() => {
    if (webApp && isTelegramAvailable && !hasOptimizedWebApp.current) {
      hasOptimizedWebApp.current = true;
      
      try {
        // Lock orientation to current mode for stable experience
        if (typeof webApp.lockOrientation === 'function') {
          webApp.lockOrientation();
          console.log('🔒 Telegram: Orientation locked');
        }

        // Disable vertical swipes to prevent conflicts with app gestures
        if (typeof webApp.disableVerticalSwipes === 'function') {
          webApp.disableVerticalSwipes();
          console.log('🚫 Telegram: Vertical swipes disabled');
        }

        // Set background color based on theme
        if (typeof webApp.setBackgroundColor === 'function') {
          const backgroundColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';
          webApp.setBackgroundColor(backgroundColor);
          console.log('🎨 Telegram: Background color set to', backgroundColor);
        }

        // Expand the app to full height
        if (typeof webApp.expand === 'function') {
          webApp.expand();
          console.log('📱 Telegram: App expanded');
        }

        // Enable closing confirmation to prevent accidental exits
        if (typeof webApp.enableClosingConfirmation === 'function') {
          webApp.enableClosingConfirmation();
          console.log('⚠️ Telegram: Closing confirmation enabled');
        }

      } catch (error) {
        console.error('Telegram WebApp optimization error:', error);
      }
    }
  }, [webApp, isTelegramAvailable, theme]);

  // Update background color when theme changes
  useEffect(() => {
    if (webApp && isTelegramAvailable && typeof webApp.setBackgroundColor === 'function') {
      const backgroundColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';
      webApp.setBackgroundColor(backgroundColor);
      console.log('🎨 Telegram: Background color updated to', backgroundColor);
    }
  }, [theme, webApp, isTelegramAvailable]);

  useEffect(() => {
    const autoAuthenticate = async () => {
      // Show debug info via Telegram WebApp alerts
      if (webApp && isTelegramAvailable) {
        webApp.showAlert(`Debug Info:
- hasAttempted: ${hasAttemptedAuth.current}
- isLoading: ${isLoading}
- isTelegramAvailable: ${isTelegramAvailable}
- telegramUser: ${telegramUser ? 'YES' : 'NO'}
- session: ${session?.user ? 'YES' : 'NO'}
- telegramUserId: ${telegramUser?.id || 'N/A'}`);
      }
      
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
        setIsAuthLoading(true); // Set global loading state

        // Check for start parameter to navigate to specific chat after auth
        let targetChatId = null;
        if (webApp && (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param) {
          const startParam = (window as any).Telegram.WebApp.initDataUnsafe.start_param;
          console.log('[TelegramAutoAuth] Start parameter detected:', startParam);
          
          if (startParam.startsWith('chat_')) {
            targetChatId = startParam.replace('chat_', '');
            console.log('[TelegramAutoAuth] Target chat ID:', targetChatId);
          }
        }

        try {
          console.log('[TelegramAutoAuth] Starting authentication with data:', {
            telegramId: telegramUser.id,
            username: telegramUser.username,
            firstName: telegramUser.first_name
          });
          
          const result = await telegramAuth({
            telegramId: telegramUser.id,
            telegramUsername: telegramUser.username,
            telegramFirstName: telegramUser.first_name,
            telegramLastName: telegramUser.last_name,
            telegramPhotoUrl: telegramUser.photo_url,
            telegramLanguageCode: telegramUser.language_code,
            telegramIsPremium: telegramUser.is_premium,
            telegramAllowsWriteToPm: telegramUser.allows_write_to_pm,
            skipEmail: true, // Always skip email for auto-auth
          });

          console.log('[TelegramAutoAuth] Auth result:', result);

          if (result.status === 'success') {
            console.log('[TelegramAutoAuth] Auth successful, updating session...');
            if (webApp) {
              webApp.showAlert('✅ Auth successful! Updating session...');
            }
            
            console.log('[TelegramAutoAuth] Calling updateSession...');
            await updateSession();
            console.log('[TelegramAutoAuth] Session updated');
            
            // Don't clear loading state here - let the chat component do it
            setIsAuthenticating(false);
            
            // Navigate to specific chat if start parameter was provided
            if (targetChatId) {
              console.log('[TelegramAutoAuth] Navigating to target chat:', targetChatId);
              
              // Small delay to ensure state updates are processed
              setTimeout(() => {
                router.push(`/chat/${targetChatId}`);
                
                // Clear the start parameter to prevent re-navigation
                if ((window as any).Telegram?.WebApp?.initDataUnsafe) {
                  (window as any).Telegram.WebApp.initDataUnsafe.start_param = undefined;
                }
              }, 100);
            } else {
              // If no target chat, clear loading immediately
              setIsAuthLoading(false);
              router.refresh();
            }
          } else if (result.status === 'needs_email') {
            // New user - create them with dummy email immediately, no form shown
            console.log('[TelegramAutoAuth] New user detected, creating account...');
            if (webApp) {
              webApp.showAlert('🆕 New user detected, creating account...');
            }
            
            const skipResult = await telegramAuth({
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

            console.log('[TelegramAutoAuth] Skip email result:', skipResult);

            if (skipResult.status === 'success') {
              console.log('[TelegramAutoAuth] New user created successfully');
              if (webApp) {
                webApp.showAlert('✅ New user created successfully!');
              }
              
              console.log('[TelegramAutoAuth] Updating session for new user...');
              await updateSession();
              console.log('[TelegramAutoAuth] Session updated for new user');
              
              // Don't clear loading state here - let the chat component do it
              setIsAuthenticating(false);
              
              // Navigate to specific chat if start parameter was provided
              if (targetChatId) {
                console.log('[TelegramAutoAuth] Navigating to target chat for new user:', targetChatId);
                
                // Small delay to ensure state updates are processed
                setTimeout(() => {
                  router.push(`/chat/${targetChatId}`);
                  
                  // Clear the start parameter to prevent re-navigation
                  if ((window as any).Telegram?.WebApp?.initDataUnsafe) {
                    (window as any).Telegram.WebApp.initDataUnsafe.start_param = undefined;
                  }
                }, 100);
              } else {
                // If no target chat, clear loading immediately
                setIsAuthLoading(false);
                router.refresh();
              }
            } else {
              console.error('[TelegramAutoAuth] Failed to create new user:', skipResult);
              if (webApp) {
                webApp.showAlert(`❌ Failed to create new user: ${skipResult.status}`);
              }
              setIsAuthLoading(false);
            }
          } else {
            console.error('[TelegramAutoAuth] Unexpected auth result:', result);
            if (webApp) {
              webApp.showAlert(`❌ Unexpected auth result: ${result.status}`);
            }
            setIsAuthLoading(false);
          }
        } catch (error) {
          console.error('[TelegramAutoAuth] Auto-authentication error:', error);
          if (webApp) {
            webApp.showAlert(`❌ Auth Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          // Silent fail - user can still use manual auth buttons
          setIsAuthLoading(false); // Clear loading on error
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    autoAuthenticate();
  }, [isLoading, isTelegramAvailable, telegramUser, session, updateSession, router, webApp, setIsAuthLoading]);

  // Add debug function to window for Telegram debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).telegramDebug = () => {
        const debugInfo = {
          hasAttemptedAuth: hasAttemptedAuth.current,
          isLoading,
          isTelegramAvailable,
          telegramUser: telegramUser ? {
            id: telegramUser.id,
            first_name: telegramUser.first_name,
            username: telegramUser.username
          } : null,
          session: session?.user ? {
            id: session.user.id,
            email: session.user.email,
            type: session.user.type,
            telegramId: session.user.telegramId
          } : null,
          webApp: webApp ? 'Available' : 'Not Available'
        };
        
        if (webApp) {
          webApp.showAlert(`Debug Info:\n${JSON.stringify(debugInfo, null, 2)}`);
        }
        
        return debugInfo;
      };
      
      (window as any).toggleTelegramDebug = () => {
        setShowDebug(prev => !prev);
        if (webApp) {
          webApp.showAlert(`Debug overlay ${showDebug ? 'hidden' : 'shown'}`);
        }
      };
    }
  }, [hasAttemptedAuth.current, isLoading, isTelegramAvailable, telegramUser, session, webApp, showDebug]);

  // Show loading indicator while authenticating or auth is loading globally
  if (isLoaderVisible) {
    return (
      <div className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${
        isAuthenticating || isAuthLoading ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="flex flex-col items-center gap-6 p-8 transition-transform duration-300 transform">
          {/* Animated Telegram Logo */}
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
              <svg 
                className="w-12 h-12 text-white" 
                viewBox="0 0 24 24" 
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-.38.24-1.07.72-.96.66-1.97 1.35-1.97 1.35s-.22.14-.63.02c-.4-.12-.9-.28-1.62-.52-.88-.3-1.57-.46-1.51-.97.03-.26.38-.53 1.05-.81 2.127-.98 3.53-1.63 4.21-1.94 2.48-1.18 3-.98 3.54-.98.12 0 .39.03.56.18.14.12.18.28.2.4-.01.06.01.24-.04.37z"/>
              </svg>
            </div>
            {/* Rotating ring around logo */}
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          
          {/* Loading text */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              {isAuthLoading && !isAuthenticating ? 'Loading Chat' : 'Connecting to Telegram'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {isAuthLoading && !isAuthenticating 
                ? 'Preparing your conversation...' 
                : 'Setting up your secure connection and personalizing your experience...'}
            </p>
          </div>
          
          {/* Animated dots */}
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Debug overlay
  if (showDebug) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg text-xs max-w-xs">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Telegram Debug</h3>
          <button 
            onClick={() => setShowDebug(false)}
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-1">
          <div>Auth Attempted: {hasAttemptedAuth.current ? '✅' : '❌'}</div>
          <div>Loading: {isLoading ? '⏳' : '✅'}</div>
          <div>Telegram Available: {isTelegramAvailable ? '✅' : '❌'}</div>
          <div>Telegram User: {telegramUser ? `✅ ${telegramUser.first_name}` : '❌'}</div>
          <div>Session: {session?.user ? `✅ ${session.user.email}` : '❌'}</div>
          <div>User Type: {session?.user?.type || 'N/A'}</div>
          <div>Telegram ID: {session?.user?.telegramId || 'N/A'}</div>
          <div>Auth Loading: {isAuthLoading ? '⏳' : '✅'}</div>
          <div>Authenticating: {isAuthenticating ? '⏳' : '✅'}</div>
        </div>
      </div>
    );
  }

  return null;
}; 