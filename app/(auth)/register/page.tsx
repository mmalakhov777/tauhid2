'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';

import { register, type RegisterActionState } from '../actions';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { useTranslations } from '@/lib/i18n';

// Telegram Binding Step Component
const TelegramBindingStep = ({ user, onComplete }: {
  user: { id: string; email?: string | null };
  onComplete: () => void;
}) => {
  const { t } = useTranslations();
  const [bindingCode, setBindingCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingBinding, setIsCheckingBinding] = useState(false);
  const [bindingStatus, setBindingStatus] = useState<'pending' | 'checking' | 'completed' | 'failed'>('pending');

  // Generate binding code on mount
  useEffect(() => {
    console.log('useEffect triggered - bindingCode:', bindingCode, 'isLoading:', isLoading);
    if (!bindingCode) {
      console.log('Calling generateBindingCode...');
      generateBindingCode();
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = expiresAt.getTime();
      const remaining = Math.max(0, expiry - now);
      
      setTimeLeft(Math.floor(remaining / 1000));
      
      if (remaining <= 0) {
        clearInterval(timer);
        toast({ type: 'error', description: t('auth.telegram.codeExpired') });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  // Polling mechanism to check if binding is completed
  useEffect(() => {
    if (bindingCode && bindingStatus === 'pending') {
      const pollInterval = setInterval(async () => {
        await checkBindingStatus();
      }, 5000); // Increased to 5 seconds to reduce frequency

      return () => clearInterval(pollInterval);
    }
  }, [bindingCode, bindingStatus]);

  const generateBindingCode = async () => {
    setIsGenerating(true);
    setIsLoading(true);
    setBindingStatus('pending');

    try {
      console.log('Generating binding code for user:', user);
      const response = await fetch('/api/telegram/generate-binding-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response result:', result);

      if (result.success) {
        setBindingCode(result.bindingCode);
        setExpiresAt(new Date(result.expiresAt));
        console.log('Binding code generated successfully:', result.bindingCode);
      } else {
        console.error('Failed to generate binding code:', result.error);
        toast({ type: 'error', description: result.error || t('auth.telegram.failedToGenerateCode') });
      }
    } catch (error) {
      console.error('Error generating binding code:', error);
      toast({ type: 'error', description: t('auth.telegram.failedToGenerateCode') });
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const checkBindingStatus = async () => {
    if (isCheckingBinding || bindingStatus !== 'pending') return; // Prevent multiple simultaneous checks
    
    setIsCheckingBinding(true);
    
    try {
      // Use a dedicated endpoint instead of session to check binding status
      const response = await fetch('/api/telegram/check-binding-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bindingCode }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.isCompleted) {
          setBindingStatus('completed');
          toast({ type: 'success', description: t('auth.telegram.telegramAccountLinked') });
          
          // Wait a moment then complete the process
          setTimeout(() => {
            onComplete();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking binding status:', error);
    } finally {
      setIsCheckingBinding(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(bindingCode);
      toast({ type: 'success', description: t('auth.telegram.codeCopiedToClipboard') });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({ type: 'error', description: t('auth.telegram.failedToCopyCode') });
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-6xl relative my-16">
      <div className="absolute inset-0 bg-white/20 dark:bg-white/10 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-white/20 shadow-2xl shadow-black/10 dark:shadow-black/30"></div>
      <div className="relative z-10 p-8 sm:p-10">
        {/* Centered Header */}
        <div className="flex flex-col items-center justify-center gap-3 text-center mb-8">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
            bindingStatus === 'completed' ? 'bg-green-500' : 'bg-blue-500'
          }`}>
            {bindingStatus === 'completed' ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.923 1.101-1.517.683 0 0-2.271-1.702-3.414-2.559-.24-.18-.513-.54-.24-.96l2.34-2.277c.26-.252.52-.756 0-.756-.52 0-3.414 2.277-3.414 2.277-.817.533-1.75.684-1.75.684l-3.293-.906s-.414-.252-.274-.756c.14-.504.793-.756.793-.756s7.776-2.834 10.428-3.788.793-.286 1.793-.133 1.793 1.125z"/>
              </svg>
            )}
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            {bindingStatus === 'completed' ? t('auth.telegram.telegramConnected') : t('auth.telegram.oneMoreStep')}
          </h3>
          {bindingStatus !== 'completed' && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('auth.telegram.connectDescription')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left side - Main content */}
          <div className="flex flex-col gap-8">
            {bindingStatus === 'completed' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
                  {t('auth.telegram.successfullyConnected')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.telegram.redirectingToApp')}
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">{t('auth.telegram.generatingBindingCode')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* How to connect instructions */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 text-center">
                    {t('auth.telegram.howToConnect')}
                  </h4>
                                          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                          <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                            <span className="hidden lg:inline">{t('auth.telegram.step1Desktop')} <a href={`https://t.me/tauhid_app_bot?start=register_${bindingCode}`} target="_blank" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 hover:underline">@tauhid_app_bot</a> {t('auth.telegram.orScanQr')}</span>
                            <span className="lg:hidden">{t('auth.telegram.step1Mobile')}</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                            <span>{t('auth.telegram.step2')} <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-xs"> {bindingCode}</code></span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                            <span>{t('auth.telegram.step3')}</span>
                          </li>
                          <li className="flex items-start gap-3 lg:flex">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold hidden lg:flex">4</span>
                            <span className="hidden lg:inline">{t('auth.telegram.step4')}</span>
                          </li>
                        </ol>
                </div>

                {/* Binding Code - Hidden on mobile */}
                <div className="text-center hidden lg:block">
                 
                  <div 
                    className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 border-2 border-dashed border-gray-300 dark:border-zinc-600 relative cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                    onClick={copyToClipboard}
                  >
                    <div className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                      {bindingCode}
                    </div>
                    <button className="absolute top-2 right-2 p-1 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded transition-colors">
                      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Timer */}
                                      {timeLeft > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {t('auth.telegram.codeExpiresIn')} <span className="font-mono font-semibold text-red-500">{formatTime(timeLeft)}</span>
                            {' • '}
                            <button
                              onClick={generateBindingCode}
                              disabled={isGenerating}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isGenerating ? t('auth.telegram.generating') : t('auth.telegram.generateNewCode')}
                            </button>
                          </p>
                        </div>
                      )}

                {/* Mobile Telegram Button (mobile/tablet only, max-width: 1023px) */}
                <div className="lg:hidden">
                  <button
                    onClick={() => window.open(`https://t.me/tauhid_app_bot?start=register_${bindingCode}`, '_blank')}
                    className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.923 1.101-1.517.683 0 0-2.271-1.702-3.414-2.559-.24-.18-.513-.54-.24-.96l2.34-2.277c.26-.252.52-.756 0-.756-.52 0-3.414 2.277-3.414 2.277-.817.533-1.75.684-1.75.684l-3.293-.906s-.414-.252-.274-.756c.14-.504.793-.756.793-.756s7.776-2.834 10.428-3.788-.793-.286 1.793-.133 1.793 1.125z"/>
                    </svg>
                    {t('auth.telegram.openTelegramBot')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right side - QR Code (desktop only, min-width: 1024px) */}
          {bindingStatus !== 'completed' && !isLoading && (
            <div className="hidden lg:flex flex-col gap-6">
              {/* Real QR Code */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 text-center">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                  {t('auth.telegram.scanQrCode')}
                </h4>
                <div className="flex justify-center mb-4">
                  <QRCodeGenerator 
                    url={`https://t.me/tauhid_app_bot?start=register_${bindingCode}`}
                    size={192}
                    className="mx-auto"
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.telegram.scanWithPhone')}
                </p>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default function Page() {
  const router = useRouter();
  const { t } = useTranslations();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [showTelegramBinding, setShowTelegramBinding] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  const [shouldUpdateSession, setShouldUpdateSession] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: 'idle',
    },
  );

  const { data: session, update: updateSession } = useSession();

  // Handle registration success
  useEffect(() => {
    if (state.status === 'user_exists') {
      toast({ type: 'error', description: t('auth.signUpError') });
    } else if (state.status === 'failed') {
      toast({ type: 'error', description: t('auth.signUpError') });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: t('auth.signUpError'),
      });
    } else if (state.status === 'success' && !hasProcessedSuccess) {
      setHasProcessedSuccess(true);
      toast({ type: 'success', description: t('auth.accountCreated') });
      setIsSuccessful(true);
      setShouldUpdateSession(true);
    }
  }, [state.status, hasProcessedSuccess, t]);

  // Handle session update separately
  useEffect(() => {
    if (shouldUpdateSession) {
      setShouldUpdateSession(false);
      updateSession().then(() => {
        // Wait for session to be updated
        setTimeout(() => {
          // Check if we have session data
          const currentSession = session;
          if (currentSession?.user?.id) {
            setRegisteredUser({
              id: currentSession.user.id,
              email: currentSession.user.email
            });
            setShowTelegramBinding(true);
          } else {
            // If no session, just redirect
            router.push('/');
            router.refresh();
          }
        }, 1000);
      }).catch((error) => {
        console.error('Error updating session:', error);
        router.push('/');
        router.refresh();
      });
    }
  }, [shouldUpdateSession, updateSession, router]); // Don't include session in deps

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    setHasProcessedSuccess(false); // Reset the flag when submitting
    formAction(formData);
  };

  const handleTelegramComplete = () => {
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex h-dvh w-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {showTelegramBinding && registeredUser ? (
        /* Full width for Telegram binding */
        <div className="flex-1 flex items-start justify-center px-8 py-0 relative min-h-0">
          <TelegramBindingStep 
            user={registeredUser}
            onComplete={handleTelegramComplete}
          />
        </div>
      ) : (
        <>
          {/* Left side - Form */}
          <div className="flex-1 flex items-center justify-center p-8 relative">
            {/* Glass container */}
            <div className="w-full max-w-md relative">
              <div className="absolute inset-0 bg-white/20 dark:bg-white/10 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-white/20 shadow-2xl shadow-black/10 dark:shadow-black/30"></div>
              <div className="relative z-10 p-8 sm:p-10">
                <div className="flex flex-col gap-8">
                                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    {t('auth.register.title')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {t('auth.register.description')}
                  </p>
                </div>

                  {/* Email/Password Form */}
                  <AuthForm action={handleSubmit} defaultEmail={email}>
                                    <SubmitButton isSuccessful={isSuccessful}>{t('auth.signUp')}</SubmitButton>
                <p className="text-center text-sm text-gray-600 mt-6 dark:text-gray-400">
                  {t('auth.register.alreadyHaveAccount')}{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200 hover:underline"
                  >
                    {t('auth.register.signInInstead')}
                  </Link>
                  {' '}{t('auth.register.instead')}
                </p>
                  </AuthForm>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side - Image */}
          <div className="flex-1 relative hidden md:block">
            <div className="absolute inset-4 rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="/assets/loginimage.webp"
                alt="Register illustration"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
