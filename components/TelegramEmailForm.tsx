'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';

interface TelegramEmailFormProps {
  telegramUser: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    language_code?: string;
    is_premium?: boolean;
    allows_write_to_pm?: boolean;
  };
  onComplete: () => void;
  onSkip?: () => void;
}

export const TelegramEmailForm = ({ telegramUser, onComplete, onSkip }: TelegramEmailFormProps) => {
  // Debug logging
  console.log('TelegramEmailForm received telegramUser:', telegramUser);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const router = useRouter();
  const { update: updateSession } = useSession();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email is required';
    }
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return '';
  };

  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    }
    if (confirmPassword !== password) {
      return 'Passwords do not match';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    // Validate all fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);
    
    // Debug logging
    console.log('Validation results:', {
      email: email,
      emailError,
      password: password ? '[HIDDEN]' : '',
      passwordError,
      confirmPassword: confirmPassword ? '[HIDDEN]' : '',
      confirmPasswordError
    });
    
    if (emailError || passwordError || confirmPasswordError) {
      setErrors({
        email: emailError,
        password: passwordError,
        confirmPassword: confirmPasswordError,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/telegram-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          telegramData: {
            telegramId: telegramUser.id,
            telegramUsername: telegramUser.username,
            telegramFirstName: telegramUser.first_name,
            telegramLastName: telegramUser.last_name,
            telegramPhotoUrl: telegramUser.photo_url,
            telegramLanguageCode: telegramUser.language_code,
            telegramIsPremium: telegramUser.is_premium,
            telegramAllowsWriteToPm: telegramUser.allows_write_to_pm,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ type: 'success', description: 'Account setup completed successfully!' });
        updateSession();
        router.refresh();
        onComplete();
      } else {
        // Handle specific error cases
        if (result.error?.includes('email') && result.error?.includes('already')) {
          setErrors({ email: 'This email is already registered. Please use a different email.' });
        } else if (result.error?.includes('invalid') && result.error?.includes('email')) {
          setErrors({ email: 'Invalid email format. Please check your email address.' });
        } else if (result.error?.includes('password')) {
          setErrors({ password: 'Password error: ' + result.error });
        } else {
          toast({ type: 'error', description: result.error || 'Failed to complete account setup. Please try again.' });
        }
      }
    } catch (error) {
      console.error('Account setup error:', error);
      toast({ type: 'error', description: 'Network error: Unable to connect to the server. Please check your internet connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setIsSkipping(true);
    onSkip?.();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999999] min-h-screen w-full">
      <div className="bg-white dark:bg-zinc-900 rounded-lg w-full h-full md:w-full md:h-full lg:w-[90%] lg:h-[90%] xl:w-[80%] xl:h-[80%] 2xl:w-[70%] 2xl:h-[70%] lg:rounded-xl flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="flex-shrink-0 p-6 md:p-8 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-4">
            {telegramUser.photo_url && (
              <img 
                src={telegramUser.photo_url} 
                alt="Profile" 
                className="w-16 h-16 md:w-20 md:h-20 rounded-full"
              />
            )}
            <div>
              <h3 className="text-xl md:text-2xl font-semibold dark:text-zinc-50">
                Welcome, {telegramUser.first_name}!
              </h3>
              <p className="text-sm md:text-base text-gray-500 dark:text-zinc-400">
                Complete your account setup
              </p>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
            <div>
              <label htmlFor="email" className="block text-sm md:text-base font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors({ ...errors, email: '' });
                  }
                }}
                required
                disabled={isSubmitting}
                className={`w-full px-4 py-3 md:py-4 text-base border rounded-lg focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.email 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-zinc-600 focus:ring-blue-500'
                }`}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm md:text-base font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors({ ...errors, password: '' });
                  }
                }}
                required
                minLength={6}
                disabled={isSubmitting}
                className={`w-full px-4 py-3 md:py-4 text-base border rounded-lg focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.password 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-zinc-600 focus:ring-blue-500'
                }`}
                placeholder="At least 6 characters"
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm md:text-base font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: '' });
                  }
                }}
                required
                minLength={6}
                disabled={isSubmitting}
                className={`w-full px-4 py-3 md:py-4 text-base border rounded-lg focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.confirmPassword 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-zinc-600 focus:ring-blue-500'
                }`}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
              )}
            </div>
          </form>
        </div>

        {/* Footer Section */}
        <div className="flex-shrink-0 p-6 md:p-8 border-t border-gray-200 dark:border-zinc-700">
          <div className="max-w-md mx-auto space-y-4">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || isSkipping}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-700 text-white py-3 md:py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 text-base md:text-lg font-medium disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up account...
                </>
              ) : (
                'Complete Setup'
              )}
            </button>
            
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting || isSkipping}
              className="w-full py-3 md:py-4 text-sm md:text-base text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSkipping ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                  <span>Skipping...</span>
                </>
              ) : (
                'Skip for now'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 