'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import { Plus } from 'lucide-react';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  append,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: 'What are the five pillars of Islam and their significance',
      action: 'What are the five pillars of Islam and their significance?',
    },
    {
      title: 'Explain the difference between fard, wajib, and sunnah in Islamic jurisprudence',
      action: 'Explain the difference between fard, wajib, and sunnah in Islamic jurisprudence',
    },
    {
      title: 'What are the conditions for valid wudu (ablution) according to fiqh',
      action: 'What are the conditions for valid wudu (ablution) according to fiqh?',
    },
    {
      title: 'How does Islamic inheritance law (mirath) distribute wealth among heirs',
      action: 'How does Islamic inheritance law (mirath) distribute wealth among heirs?',
    },
    {
      title: 'What are the rulings on zakat calculation and distribution in Islam',
      action: 'What are the rulings on zakat calculation and distribution in Islam?',
    },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="w-full max-w-full overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3 px-2">
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="shrink-0"
        >
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
        <p className="text-xs sm:text-sm font-medium">Examples</p>
      </div>
      
      <div className="flex flex-col gap-0 w-full">
        {suggestedActions.map((suggestedAction, index) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            key={`suggested-action-${index}`}
            className={`w-full ${index >= 3 ? 'hidden sm:block' : ''}`}
          >
            <Button
              variant="ghost"
              onClick={async () => {
                window.history.replaceState({}, '', `/chat/${chatId}`);

                append({
                  role: 'user',
                  content: suggestedAction.action,
                });
              }}
              className="w-full flex items-start justify-between text-left px-2 py-2 sm:py-2 min-h-[40px] sm:min-h-[48px] h-auto hover:bg-transparent active:bg-muted/50 border-b border-border/30 rounded-none last:border-b-0 group touch-manipulation"
            >
              <span className="text-sm sm:text-base font-normal mr-2 text-muted-foreground group-hover:text-foreground group-active:text-foreground transition-colors duration-200 leading-relaxed sm:leading-normal break-words whitespace-normal">
                {suggestedAction.title}
              </span>
              <Plus className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground group-active:text-foreground transition-colors duration-200 ml-2 mt-0.5" />
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
