'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '@/components/toast';

interface TelegramBindingModalProps {
  user: {
    id: string;
    email?: string | null;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export const TelegramBindingModal = ({ user, onClose, onSuccess }: TelegramBindingModalProps) => {
  const [bindingCode, setBindingCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate binding code on mount
  useEffect(() => {
    if (mounted) {
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
        toast({ type: 'error', description: 'Binding code expired. Please generate a new one.' });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const generateBindingCode = async () => {
    setIsGenerating(true);
    setIsLoading(true);

    try {
      const response = await fetch('/api/telegram/generate-binding-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setBindingCode(result.bindingCode);
        setExpiresAt(new Date(result.expiresAt));
        toast({ type: 'success', description: 'Binding code generated successfully!' });
      } else {
        toast({ type: 'error', description: result.error || 'Failed to generate binding code' });
      }
    } catch (error) {
      console.error('Error generating binding code:', error);
      toast({ type: 'error', description: 'Failed to generate binding code. Please try again.' });
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(bindingCode);
      toast({ type: 'success', description: 'Code copied to clipboard!' });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({ type: 'error', description: 'Failed to copy code. Please copy manually.' });
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
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[99999] transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="pointer-events-auto w-full max-w-md mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.923 1.101-1.517.683 0 0-2.271-1.702-3.414-2.559-.24-.18-.513-.54-.24-.96l2.34-2.277c.26-.252.52-.756 0-.756-.52 0-3.414 2.277-3.414 2.277-.817.533-1.75.684-1.75.684l-3.293-.906s-.414-.252-.274-.756c.14-.504.793-.756.793-.756s7.776-2.834 10.428-3.788c.793-.286 1.793-.133 1.793 1.125z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold dark:text-zinc-50">
                      Connect Telegram
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                      Link your account with this code
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-zinc-400">Generating binding code...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Binding Code */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
                      Your binding code:
                    </p>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 border-2 border-dashed border-gray-300 dark:border-zinc-600">
                      <div className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                        {bindingCode}
                      </div>
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 mx-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Code
                    </button>
                  </div>

                  {/* Timer */}
                  {timeLeft > 0 && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-zinc-400">
                        Code expires in: <span className="font-mono font-semibold text-red-500">{formatTime(timeLeft)}</span>
                      </p>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      How to connect:
                    </h4>
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>1. Open Telegram and find our bot</li>
                      <li>2. Send the command: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/bind {bindingCode}</code></li>
                      <li>3. Your accounts will be linked automatically</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-6 border-t border-gray-200 dark:border-zinc-700">
              <div className="flex gap-3">
                <button
                  onClick={generateBindingCode}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : 'Generate New Code'}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}; 