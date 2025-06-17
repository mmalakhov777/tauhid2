'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '@/components/toast';
import { useTranslations } from '@/lib/i18n';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';

interface TelegramBindingModalProps {
  user: {
    id: string;
    email?: string | null;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export const TelegramBindingModal = ({ user, onClose, onSuccess }: TelegramBindingModalProps) => {
  const { t } = useTranslations();
  const [bindingCode, setBindingCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingBinding, setIsCheckingBinding] = useState(false);
  const [bindingStatus, setBindingStatus] = useState<'pending' | 'checking' | 'completed' | 'failed'>('pending');
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate binding code on mount
  useEffect(() => {
    console.log('Modal useEffect triggered - mounted:', mounted, 'bindingCode:', bindingCode, 'isLoading:', isLoading);
    if (mounted && !bindingCode) {
      console.log('Modal calling generateBindingCode...');
      generateBindingCode();
    }
  }, [mounted]);

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
  }, [expiresAt, t]);

  // Polling mechanism to check if binding is completed
  useEffect(() => {
    if (bindingCode && bindingStatus === 'pending') {
      const pollInterval = setInterval(async () => {
        await checkBindingStatus();
      }, 5000); // Check every 5 seconds

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
    if (isCheckingBinding || bindingStatus !== 'pending') return;
    
    setIsCheckingBinding(true);
    
    try {
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
            if (onSuccess) {
              onSuccess();
            }
            onClose();
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

  if (!mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[99999] transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="pointer-events-auto w-full max-w-6xl mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-background dark:bg-background rounded-3xl border border-border dark:border-border shadow-xl"></div>
            <div className="relative z-10 p-8 sm:p-10">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 dark:hover:bg-white/10 rounded-full transition-colors z-20"
              >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

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
                      <div className="bg-muted dark:bg-muted rounded-xl p-4">
                        <h4 className="font-semibold text-foreground dark:text-foreground mb-3 text-center">
                          {t('auth.telegram.howToConnect')}
                        </h4>
                                                 <ol className="text-sm text-foreground dark:text-foreground space-y-2">
                           <li className="flex items-start gap-3">
                             <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                             <span className="hidden lg:inline">{t('auth.telegram.step1Desktop')} <a href={`https://t.me/tauhid_app_bot?start=register_${bindingCode}`} target="_blank" className="text-foreground dark:text-foreground hover:text-muted-foreground dark:hover:text-muted-foreground transition-colors duration-200 hover:underline">@tauhid_app_bot</a> {t('auth.telegram.orScanQr')}</span>
                             <span className="lg:hidden">{t('auth.telegram.step1Mobile')}</span>
                           </li>
                           <li className="flex items-start gap-3">
                             <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                             <span>{t('auth.telegram.step2')} <code className="bg-accent dark:bg-accent px-1 py-0.5 rounded text-xs"> {bindingCode}</code></span>
                           </li>
                           <li className="flex items-start gap-3">
                             <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                             <span>{t('auth.telegram.step3')}</span>
                           </li>
                           <li className="flex items-start gap-3 lg:flex">
                             <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold hidden lg:flex">4</span>
                             <span className="hidden lg:inline">{t('auth.telegram.step4')}</span>
                           </li>
                         </ol>
                      </div>

                      {/* Binding Code - Hidden on mobile */}
                      <div className="text-center hidden lg:block">
                        <div 
                          className="bg-muted dark:bg-muted rounded-xl p-4 border-2 border-dashed border-border dark:border-border relative cursor-pointer hover:bg-accent dark:hover:bg-accent transition-colors"
                          onClick={copyToClipboard}
                        >
                          <div className="text-3xl font-mono font-bold text-foreground dark:text-foreground tracking-wider">
                            {bindingCode}
                          </div>
                          <button className="absolute top-2 right-2 p-1 hover:bg-accent dark:hover:bg-accent rounded transition-colors">
                            <svg className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Timer */}
                                             {timeLeft > 0 && (
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                             {t('auth.telegram.codeExpiresIn')} <span className="font-mono font-semibold text-red-500">{formatTime(timeLeft)}</span>
                             {' • '}
                             <button
                               onClick={generateBindingCode}
                               disabled={isGenerating}
                               className="text-foreground dark:text-foreground hover:text-muted-foreground dark:hover:text-muted-foreground underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="bg-card dark:bg-card rounded-xl p-6 text-center border border-border dark:border-border">
                                              <h4 className="font-semibold text-card-foreground dark:text-card-foreground mb-4">
                          {t('auth.telegram.scanQrCode')}
                        </h4>
                      <div className="flex justify-center mb-4">
                        <QRCodeGenerator 
                          url={`https://t.me/tauhid_app_bot?start=register_${bindingCode}`}
                          size={192}
                          className="mx-auto"
                        />
                      </div>
                                              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                          {t('auth.telegram.scanWithPhone')}
                        </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}; 