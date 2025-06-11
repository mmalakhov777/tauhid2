'use client';

import type { User } from 'next-auth';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';

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
import { signOut, useSession } from 'next-auth/react';
import { useTelegram } from '@/hooks/useTelegram';
import { SkeletonWave } from './ui/skeleton';
import { ProfileModal } from './profile-modal';

export function SidebarUserNav({ user }: { user: User }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { status } = useSession();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user: telegramUser } = useTelegram();

  const isGuest = user.email?.includes('guest-');
  const isTelegramUser = user.email?.startsWith('telegram_') && user.email?.endsWith('@telegram.local');

  // Determine display name and avatar
  const displayName = telegramUser?.first_name && isTelegramUser
    ? `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim()
    : user.name || user.email?.split('@')[0] || 'User';

  const truncatedDisplayName = displayName.length > 20 
    ? `${displayName.slice(0, 20)}...` 
    : displayName;

  const avatarUrl = telegramUser?.photo_url && isTelegramUser
    ? telegramUser.photo_url
    : `https://avatar.vercel.sh/${user.email}`;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {status === 'loading' ? (
                <SidebarMenuButton className="h-10 justify-between transition-all duration-200 rounded-[100px] bg-white/5 border border-white/20 hover:bg-white/10" data-user-nav="true">
                  <div className="flex flex-row gap-2 items-center">
                    <SkeletonWave className="size-6 rounded-full" delay={0} />
                    <SkeletonWave className="h-4 w-32 rounded-md" delay={0.1} />
                  </div>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  data-testid="user-nav-button"
                  className="h-10 bg-white/5 border border-white/20 hover:bg-white/10 transition-all duration-200 rounded-[100px]"
                  data-user-nav="true"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Image
                      src={avatarUrl}
                      alt={truncatedDisplayName ?? 'User Avatar'}
                      width={24}
                      height={24}
                      className="rounded-full flex-shrink-0"
                    />
                    <div className="flex flex-col items-start min-w-0">
                      <span data-testid="user-email" className="truncate text-sm">
                        {truncatedDisplayName}
                      </span>
                      {telegramUser?.username && isTelegramUser && (
                        <span className="text-xs text-muted-foreground truncate">
                          @{telegramUser.username}
                        </span>
                      )}
                    </div>
                  </div>
                </SidebarMenuButton>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-testid="user-nav-menu"
              side="top"
              className="w-[--radix-popper-anchor-width] text-left bg-white/80 border border-white/20 shadow-lg rounded-xl p-2"
            >
              {telegramUser && isTelegramUser && (
                <>
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-3">
                      {telegramUser.photo_url && (
                        <Image
                          src={telegramUser.photo_url}
                          alt="Profile"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {telegramUser.first_name} {telegramUser.last_name}
                        </span>
                        {telegramUser.username && (
                          <span className="text-xs text-muted-foreground">
                            @{telegramUser.username}
                          </span>
                        )}
                        {telegramUser.is_premium && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            Premium User ⭐
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-white/20" />
                </>
              )}
              <DropdownMenuItem
                data-testid="user-nav-item-profile"
                className="cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30"
                onSelect={() => setShowProfileModal(true)}
              >
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/20" />
              <DropdownMenuItem
                data-testid="user-nav-item-theme"
                className="cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30"
                onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/20" />
              <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                <button
                  type="button"
                  className="w-full cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30"
                  onClick={() => {
                    if (status === 'loading') {
                      console.log('Checking authentication status, please try again!');
                      return;
                    }

                    if (isGuest) {
                      router.push('/login');
                    } else {
                      signOut({
                        redirectTo: '/',
                      });
                    }
                  }}
                >
                  {isGuest ? 'Login to your account' : 'Sign out'}
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
      />
    </>
  );
}
