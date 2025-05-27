'use client';

import { cn } from '@/lib/utils';

interface CitationMarkerProps {
  number: number;
  onClick?: () => void;
  className?: string;
}

export function CitationMarker({ number, onClick, className }: CitationMarkerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center",
        "w-5 h-5 rounded-full",
        "bg-primary text-primary-foreground",
        "text-xs font-semibold",
        "hover:bg-primary/90 transition-colors",
        "align-super ml-0.5",
        className
      )}
      type="button"
    >
      {number}
    </button>
  );
} 