'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import Image from 'next/image';

import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';

import { register, type RegisterActionState } from '../actions';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: 'idle',
    },
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (state.status === 'user_exists') {
      toast({ type: 'error', description: 'Account already exists!' });
    } else if (state.status === 'failed') {
      toast({ type: 'error', description: 'Failed to create account!' });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Failed validating your submission!',
      });
    } else if (state.status === 'success') {
      toast({ type: 'success', description: 'Account created successfully!' });

      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Glass container */}
        <div className="w-full max-w-md relative">
          <div className="absolute inset-0 bg-white/20 dark:bg-white/10 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-white/20 shadow-2xl shadow-black/10 dark:shadow-black/30"></div>
          <div className="relative z-10 p-8 sm:p-10">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Create Account
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Create an account with your email and password
                </p>
              </div>

              {/* Email/Password Form */}
              <AuthForm action={handleSubmit} defaultEmail={email}>
                <SubmitButton isSuccessful={isSuccessful}>Sign Up</SubmitButton>
                <p className="text-center text-sm text-gray-600 mt-6 dark:text-gray-400">
                  {'Already have an account? '}
                  <Link
                    href="/login"
                    className="font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200 hover:underline"
                  >
                    Sign in
                  </Link>
                  {' instead.'}
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
    </div>
  );
}
