'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';

import { PlusIcon, GlobeIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { EmailSetupBanner } from '@/components/EmailSetupBanner';
import { useTelegram } from '@/hooks/useTelegram';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, openMobile } = useSidebar();
  const { user: telegramUser } = useTelegram();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
  // Swipe gesture state
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [startX, setStartX] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const SIDEBAR_WIDTH = 288; // 18rem in pixels
  const SWIPE_THRESHOLD = 50; // Minimum swipe distance to trigger open
  
  // Check if we're on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'ar', name: 'العربية' },
    { code: 'ru', name: 'Русский' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
  ];

  const isTelegramUser = user?.email?.startsWith('telegram_') && user?.email?.endsWith('@telegram.local');

  // Map Telegram language codes to our supported languages
  const mapTelegramLanguage = (telegramLangCode?: string): string => {
    if (!telegramLangCode) return 'en';
    
    const langMap: { [key: string]: string } = {
      'en': 'en',
      'tr': 'tr',
      'ar': 'ar',
      'ru': 'ru',
      'de': 'de',
      'fr': 'fr',
      'es': 'es',
      // Add more mappings as needed
    };
    
    return langMap[telegramLangCode] || 'en';
  };

  // Touch event handlers for swipe gesture
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    
    if (!openMobile) {
      // Opening gesture - swipe from left half of screen
      if (startX <= window.innerWidth / 2) {
        setIsSwipeActive(true);
        setStartX(startX);
        setSwipeProgress(0);
      }
    } else {
      // Closing gesture - can start from anywhere when sidebar is open
      setIsSwipeActive(true);
      setStartX(startX);
      setSwipeProgress(1); // Start at fully open
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwipeActive) return;
    
    const touch = e.touches[0];
    const currentX = touch.clientX;
    const deltaX = currentX - startX;
    
    let progress;
    if (!openMobile) {
      // Opening - calculate progress from 0 to 1
      progress = Math.max(0, Math.min(1, deltaX / SIDEBAR_WIDTH));
    } else {
      // Closing - calculate progress from 1 to 0
      progress = Math.max(0, Math.min(1, 1 + (deltaX / SIDEBAR_WIDTH)));
    }
    
    setSwipeProgress(progress);
    
    // Apply transform to sidebar and overlay
    if (sidebarRef.current) {
      const translateX = -SIDEBAR_WIDTH + (progress * SIDEBAR_WIDTH);
      sidebarRef.current.style.transform = `translateX(${translateX}px)`;
      sidebarRef.current.style.transition = 'none';
    }
    
    if (overlayRef.current) {
      overlayRef.current.style.opacity = `${progress * 0.5}`;
      overlayRef.current.style.visibility = 'visible';
      overlayRef.current.style.transition = 'none';
    }
    
    // Prevent scrolling while swiping
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!isSwipeActive) return;
    
    setIsSwipeActive(false);
    
    let shouldOpen;
    if (!openMobile) {
      // Opening - check if swiped enough to open
      shouldOpen = swipeProgress > 0.3 || (swipeProgress * SIDEBAR_WIDTH) > SWIPE_THRESHOLD;
    } else {
      // Closing - check if swiped enough to close
      shouldOpen = swipeProgress > 0.7; // Stay open if progress is still above 70%
    }
    
    if (shouldOpen) {
      setOpenMobile(true);
      // Animate to fully open
      if (sidebarRef.current) {
        sidebarRef.current.style.transform = 'translateX(0)';
        sidebarRef.current.style.transition = 'transform 0.3s ease-out';
      }
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '0.5';
        overlayRef.current.style.transition = 'opacity 0.3s ease-out';
      }
    } else {
      setOpenMobile(false);
      // Animate to fully closed
      if (sidebarRef.current) {
        sidebarRef.current.style.transform = `translateX(-${SIDEBAR_WIDTH}px)`;
        sidebarRef.current.style.transition = 'transform 0.3s ease-out';
      }
      
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '0';
        overlayRef.current.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
          if (overlayRef.current) {
            overlayRef.current.style.visibility = 'hidden';
          }
        }, 300);
      }
    }
    
    setSwipeProgress(0);
  };

  // Add touch event listeners
  useEffect(() => {
    const handleTouchStartWrapper = (e: TouchEvent) => handleTouchStart(e);
    const handleTouchMoveWrapper = (e: TouchEvent) => handleTouchMove(e);
    const handleTouchEndWrapper = () => handleTouchEnd();

    document.addEventListener('touchstart', handleTouchStartWrapper, { passive: false });
    document.addEventListener('touchmove', handleTouchMoveWrapper, { passive: false });
    document.addEventListener('touchend', handleTouchEndWrapper);

    return () => {
      document.removeEventListener('touchstart', handleTouchStartWrapper);
      document.removeEventListener('touchmove', handleTouchMoveWrapper);
      document.removeEventListener('touchend', handleTouchEndWrapper);
    };
  }, [isSwipeActive, startX, swipeProgress, openMobile]);

  // Reset transforms when sidebar opens/closes normally
  useEffect(() => {
    if (sidebarRef.current) {
      if (openMobile) {
        sidebarRef.current.style.transform = 'translateX(0)';
        sidebarRef.current.style.transition = 'transform 0.3s ease-out';
      } else if (!isSwipeActive) {
        sidebarRef.current.style.transform = `translateX(-${SIDEBAR_WIDTH}px)`;
        sidebarRef.current.style.transition = 'transform 0.3s ease-out';
      }
    }
    
    if (overlayRef.current) {
      if (openMobile) {
        overlayRef.current.style.opacity = '0.5';
        overlayRef.current.style.visibility = 'visible';
        overlayRef.current.style.transition = 'opacity 0.3s ease-out';
      } else if (!isSwipeActive) {
        overlayRef.current.style.opacity = '0';
        overlayRef.current.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
          if (overlayRef.current && !openMobile) {
            overlayRef.current.style.visibility = 'hidden';
          }
        }, 300);
      }
    }
  }, [openMobile, isSwipeActive]);

  // Load language from localStorage on mount or set from Telegram data
  useEffect(() => {
    // If user is a Telegram user and we have their language preference
    if (isTelegramUser && telegramUser?.language_code) {
      const telegramMappedLang = mapTelegramLanguage(telegramUser.language_code);
      const savedLanguage = localStorage.getItem('selectedLanguage');
      
      // Only set from Telegram if no saved preference exists
      if (!savedLanguage) {
        setSelectedLanguage(telegramMappedLang);
        localStorage.setItem('selectedLanguage', telegramMappedLang);
        console.log('🔍 Language set from Telegram:', telegramMappedLang);
      } else if (languages.some(lang => lang.code === savedLanguage)) {
        setSelectedLanguage(savedLanguage);
      }
    } else {
      // Non-Telegram user - use saved preference or default
      const savedLanguage = localStorage.getItem('selectedLanguage');
      if (savedLanguage && languages.some(lang => lang.code === savedLanguage)) {
        setSelectedLanguage(savedLanguage);
      }
    }
  }, [telegramUser, isTelegramUser]);

  const handleLanguageChange = (languageCode: string) => {
    console.log('🔍 Language changed to:', languageCode);
    setSelectedLanguage(languageCode);
    localStorage.setItem('selectedLanguage', languageCode);
    console.log('🔍 Language saved to localStorage:', languageCode);
  };

  // On mobile, return only our custom swipe sidebar
  if (isMobile) {
    return (
      <>
        {/* Swipe overlay for mobile */}
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 z-[999998]"
          style={{
            visibility: 'hidden',
            opacity: 0,
            transition: 'opacity 0.3s ease-out'
          }}
          onClick={() => setOpenMobile(false)}
        />
        
        {/* Mobile sidebar */}
        <div
          ref={sidebarRef}
          className="fixed inset-y-0 left-0 z-[999999] w-72 bg-sidebar text-sidebar-foreground border-r border-border"
          style={{
            transform: openMobile ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        >
          <div className="flex h-full w-full flex-col">
            <SidebarHeader>
              <SidebarMenu>
                <div className="flex flex-row justify-between items-center">
                  <Link
                    href="/"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                    className="flex flex-row gap-3 items-center"
                  >
                    <div className="px-2 hover:bg-muted rounded-md cursor-pointer py-1 flex items-center gap-3 transition-colors duration-200">
                      <Image
                        src="/assets/logowithtext.png"
                        alt="Logo"
                        width={350}
                        height={150}
                        className="h-24 w-auto"
                      />
                    </div>
                  </Link>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        type="button"
                        className="p-2 h-fit hover:bg-muted transition-colors duration-200"
                        onClick={() => {
                          setOpenMobile(false);
                          router.push('/');
                          router.refresh();
                        }}
                      >
                        <PlusIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="end">New Chat</TooltipContent>
                  </Tooltip>
                </div>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              {user && <EmailSetupBanner user={user} />}
              <SidebarHistory user={user} />
            </SidebarContent>
            <SidebarFooter>
              <div className="flex flex-row items-center gap-2">
                <div className="flex-shrink-0">
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-10 w-fit px-2 bg-card border border-border hover:bg-card/80 transition-colors duration-200"
                          >
                            <GlobeIcon size={16} />
                            <span className="text-sm font-medium">
                              {languages.find(lang => lang.code === selectedLanguage)?.name.slice(0, 2).toUpperCase() || 'EN'}
                            </span>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px] bg-popover border border-border shadow-lg">
                          <DropdownMenuLabel className="text-popover-foreground">Select Language</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border" />
                          {languages.map((lang) => (
                            <DropdownMenuItem
                              key={lang.code}
                              onClick={() => handleLanguageChange(lang.code)}
                              className={`text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200 ${
                                selectedLanguage === lang.code ? 'bg-accent text-accent-foreground' : ''
                              }`}
                            >
                              {lang.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </div>
                <div className="flex-1 min-w-0">
                  {user && <SidebarUserNav user={user} />}
                </div>
              </div>
            </SidebarFooter>
          </div>
        </div>
      </>
    );
  }

  // Desktop sidebar - uses original Sidebar component
  return (
    <Sidebar className="group-data-[side=left]:border-r border-border">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <div className="px-2 hover:bg-muted rounded-md cursor-pointer py-1 flex items-center gap-3 transition-colors duration-200">
                <Image
                  src="/assets/logowithtext.png"
                  alt="Logo"
                  width={350}
                  height={150}
                  className="h-24 w-auto"
                />
              </div>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit hover:bg-muted transition-colors duration-200"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {user && <EmailSetupBanner user={user} />}
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-row items-center gap-2">
          <div className="flex-shrink-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-10 w-fit px-2 bg-card border border-border hover:bg-card/80 transition-colors duration-200"
                    >
                      <GlobeIcon size={16} />
                      <span className="text-sm font-medium">
                        {languages.find(lang => lang.code === selectedLanguage)?.name.slice(0, 2).toUpperCase() || 'EN'}
                      </span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px] bg-popover border border-border shadow-lg">
                    <DropdownMenuLabel className="text-popover-foreground">Select Language</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200 ${
                          selectedLanguage === lang.code ? 'bg-accent text-accent-foreground' : ''
                        }`}
                      >
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
          <div className="flex-1 min-w-0">
            {user && <SidebarUserNav user={user} />}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
