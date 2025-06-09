'use client';

import { ChevronUp } from 'lucide-react';
import Image from 'next/image';
import type { User } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useTelegram } from '@/hooks/useTelegram';
import { useState } from 'react';

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
import { ProfileModal } from './profile-modal';

export function SidebarUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, theme } = useTheme();
  const { user: telegramUser } = useTelegram();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const isGuest = guestRegex.test(data?.user?.email ?? '');
  const isTelegramUser = user.email?.startsWith('telegram_') && user.email?.endsWith('@telegram.local');
  
  // Determine display name and avatar
  const displayName = telegramUser && isTelegramUser
    ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`
    : isGuest 
    ? 'Guest' 
    : user?.email;

  // Truncate display name for button to 12 characters max
  const truncatedDisplayName = displayName ? displayName.slice(0, 12) : '';
    
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
                <SidebarMenuButton className="data-[state=open]:bg-white/10 data-[state=open]:backdrop-blur-md bg-white/5 backdrop-blur-md border border-white/20 hover:bg-white/10 data-[state=open]:text-sidebar-accent-foreground h-10 justify-between transition-all duration-200 rounded-[100px]">
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
                  className="data-[state=open]:bg-white/10 data-[state=open]:backdrop-blur-md data-[state=open]:text-sidebar-accent-foreground h-10 bg-white/5 backdrop-blur-md border border-white/20 hover:bg-white/10 transition-all duration-200 rounded-[100px]"
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
              className="w-[--radix-popper-anchor-width] text-left bg-white/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl p-2"
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
                className="cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:backdrop-blur-sm hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30"
                onSelect={() => setShowProfileModal(true)}
              >
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/20" />
              <DropdownMenuItem
                data-testid="user-nav-item-theme"
                className="cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:backdrop-blur-sm hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30"
                onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/20" />
              <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                <button
                  type="button"
                  className="w-full cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:backdrop-blur-sm hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30"
                  onClick={() => {
                    if (status === 'loading') {
                      toast({
                        type: 'error',
                        description:
                          'Checking authentication status, please try again!',
                      });

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
