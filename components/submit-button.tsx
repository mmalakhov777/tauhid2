'use client';

import { useFormStatus } from 'react-dom';

import { LoaderIcon } from '@/components/icons';

import { Button } from './ui/button';

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending || isSuccessful}
      disabled={pending || isSuccessful}
      className="relative w-full h-12 text-base font-semibold rounded-xl bg-primary/75 text-primary-foreground shadow-xl hover:shadow-2xl hover:shadow-primary/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:backdrop-blur-sm before:rounded-xl"
    >
      <span className="relative z-10 flex items-center justify-center gap-3">
        {children}
        
        {(pending || isSuccessful) && (
          <span className="animate-spin">
            <LoaderIcon />
          </span>
        )}
      </span>

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? 'Loading' : 'Submit form'}
      </output>
    </Button>
  );
}
