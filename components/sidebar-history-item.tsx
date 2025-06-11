import type { Chat } from '@/lib/db/schema';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
  LoaderIcon,
} from './icons';
import { memo, useState } from 'react';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useTranslations } from '@/lib/i18n';

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
  chatIndex,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  chatIndex: number;
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });
  const { t } = useTranslations();

  const handleChatClick = () => {
    setOpenMobile(false);
    setIsLoading(true);
    // Use router.push for instant navigation - this will show loading.tsx immediately
    router.push(`/chat/${chat.id}`);
    
    // Reset loading state after a short delay (the loading.tsx will take over)
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleMouseEnter = () => {
    // Prefetch the chat route on hover for faster loading
    router.prefetch(`/chat/${chat.id}`);
  };

  return (
    <SidebarMenuItem className="w-[97%]">
      <SidebarMenuButton asChild isActive={isActive}>
        <button 
          onClick={handleChatClick} 
          onMouseEnter={handleMouseEnter}
          className="w-full text-left flex items-center gap-2"
          disabled={isLoading}
          data-chat-item="true"
          data-chat-index={chatIndex}
        >
          {isLoading && (
            <div className="animate-spin flex-shrink-0">
              <LoaderIcon size={14} />
            </div>
          )}
          <span className={isLoading ? 'opacity-70' : ''}>{chat.title}</span>
        </button>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">{t('sidebarHistoryItem.more')}</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end" className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-xl">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <ShareIcon />
              <span>{t('sidebarHistoryItem.share')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-xl">
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between hover:bg-white/15 hover:text-accent-foreground transition-all duration-200"
                  onClick={() => {
                    setVisibilityType('private');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <LockIcon size={12} />
                    <span>{t('sidebarHistoryItem.private')}</span>
                  </div>
                  {visibilityType === 'private' ? (
                    <CheckCircleFillIcon />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between hover:bg-white/15 hover:text-accent-foreground transition-all duration-200"
                  onClick={() => {
                    setVisibilityType('public');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <GlobeIcon />
                    <span>{t('sidebarHistoryItem.public')}</span>
                  </div>
                  {visibilityType === 'public' ? <CheckCircleFillIcon /> : null}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500 hover:bg-destructive/15 hover:text-destructive transition-all duration-200"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>{t('sidebarHistoryItem.delete')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  return true;
});
