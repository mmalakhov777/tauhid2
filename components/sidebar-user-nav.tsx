'use client';

import { ChevronUp } from 'lucide-react';
import Image from 'next/image';
import type { User } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useRouter } from 'next/navigation';
import { toast } from './toast';
import { LoaderIcon } from './icons';
import { guestRegex } from '@/lib/constants';
import { SkeletonWave } from './ui/skeleton';

export function SidebarUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, theme } = useTheme();

  const isGuest = guestRegex.test(data?.user?.email ?? '');
  const isTelegramUser = data?.user?.type === 'telegram';
  
  // Get display name and avatar for different user types
  const getDisplayName = () => {
    if (isGuest) return 'Guest';
    if (isTelegramUser) {
      // Extract Telegram user info from email format: telegram-123456@telegram.user
      const telegramId = data?.user?.email?.match(/telegram-(\d+)@/)?.[1];
      return `Telegram User ${telegramId ? `#${telegramId}` : ''}`;
    }
    return user?.email;
  };

  const getAvatarUrl = () => {
    if (isTelegramUser && data?.user?.telegramId) {
      // Use Telegram's user ID for a consistent avatar
      return `https://avatar.vercel.sh/telegram-${data.user.telegramId}`;
    }
    return `https://avatar.vercel.sh/${user.email}`;
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === 'loading' ? (
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-card border border-border hover:bg-card/80 data-[state=open]:text-sidebar-accent-foreground h-10 justify-between transition-colors duration-200">
                <div className="flex flex-row gap-2 items-center">
                  <SkeletonWave className="size-6 rounded-full" delay={0} />
                  <SkeletonWave className="h-4 w-32 rounded-md" delay={0.1} />
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                data-testid="user-nav-button"
                className="data-[state=open]:bg-sidebar-accent bg-card border border-border hover:bg-card/80 data-[state=open]:text-sidebar-accent-foreground h-10 transition-colors duration-200"
              >
                <Image
                  src={getAvatarUrl()}
                  alt={getDisplayName() ?? 'User Avatar'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span data-testid="user-email" className="truncate">
                  {getDisplayName()}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-testid="user-nav-menu"
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            <DropdownMenuItem
              data-testid="user-nav-item-theme"
              className="cursor-pointer"
              onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                type="button"
                className="w-full cursor-pointer"
                onClick={() => {
                  if (status === 'loading') {
                    toast({
                      type: 'error',
                      description:
                        'Checking authentication status, please try again!',
                    });

                    return;
                  }

                  if (isGuest || isTelegramUser) {
                    // For Telegram users, we can't really "login" to a different account
                    // They should use the regular web version for that
                    if (isTelegramUser) {
                      toast({
                        type: 'success',
                        description: 'You are authenticated via Telegram',
                      });
                    } else {
                      router.push('/login');
                    }
                  } else {
                    signOut({
                      redirectTo: '/',
                    });
                  }
                }}
              >
                {isGuest ? 'Login to your account' : isTelegramUser ? 'Telegram User' : 'Sign out'}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
