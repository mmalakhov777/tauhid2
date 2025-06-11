'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon, VercelIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { memo, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { Session } from 'next-auth';
import { useTranslations } from '@/lib/i18n';

function PureChatHeader({
  chatId,
  isReadonly,
  session,
}: {
  chatId: string;
  isReadonly: boolean;
  session: Session | null;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const { t } = useTranslations();
  
  // Use state to handle client-side rendering
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Default to showing the button on server render to avoid hydration mismatch
  const shouldShowNewChatButton = !isClient || (!open || windowWidth < 768);

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2 md:hidden border-b">
      <SidebarToggle />

      {shouldShowNewChatButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="md:sr-only">{t('chatHeader.newChat')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('chatHeader.newChat')}</TooltipContent>
        </Tooltip>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
