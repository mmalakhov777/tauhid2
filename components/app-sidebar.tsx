'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';

import { PlusIcon, GlobeIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { EmailSetupBanner } from '@/components/EmailSetupBanner';
import { GuestRegistrationBanner } from '@/components/GuestRegistrationBanner';
import { TelegramEmailForm } from '@/components/TelegramEmailForm';
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
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showTelegramEmailForm, setShowTelegramEmailForm] = useState(false);
  
  // Add custom styles for ultra-transparent glass effect
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [data-sidebar="sidebar"] {
        background: rgba(255, 255, 255, 0.23) !important;
        backdrop-filter: blur(20px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 16px !important;
        margin: 8px !important;
        height: calc(100vh - 16px) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04) !important;
        isolation: isolate !important;
      }
      .sidebar-transparent [data-sidebar="sidebar"] {
        background: rgba(255, 255, 255, 0.23) !important;
        backdrop-filter: blur(20px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 16px !important;
        margin: 8px !important;
        height: calc(100vh - 16px) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04) !important;
        isolation: isolate !important;
      }
      .dark [data-sidebar="sidebar"] {
        background: rgba(255, 255, 255, 0.0008) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 16px !important;
        margin: 8px !important;
        height: calc(100vh - 16px) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
        isolation: isolate !important;
      }
      // NEW CHAT BUTTON - TRANSPARENT (no backdrop filter)
      [data-new-chat="true"],
      [data-new-chat="true"].rounded-md {
        background: rgba(255, 255, 255, 0.35) !important;
        border: 1px solid rgba(255, 255, 255, 0.35) !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
        border-radius: 100px !important;
        color: var(--sidebar-foreground) !important;
        transform: translateY(-0.5px) !important;
      }
      [data-new-chat="true"]:hover,
      [data-new-chat="true"].rounded-md:hover {
        background: rgba(255, 255, 255, 0.45) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
        transform: translateY(-0.5px) !important;
      }
      .dark [data-new-chat="true"],
      .dark [data-new-chat="true"].rounded-md {
        background: rgba(255, 255, 255, 0.09) !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
      }
      .dark [data-new-chat="true"]:hover,
      .dark [data-new-chat="true"].rounded-md:hover {
        background: rgba(255, 255, 255, 0.16) !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35) !important;
        transform: translateY(-0.5px) !important;
      }
      
      // CHAT HISTORY ITEM - TRANSPARENT (no backdrop filter)
      [data-chat-item="true"],
      [data-chat-item="true"].rounded-md {
        transition: all 0.3s ease !important;
        border-radius: 100px !important;
      }
      
      // PROGRESSIVE OPACITY EFFECT
      [data-chat-item="true"][data-chat-index="0"] { opacity: 1.0 !important; }
      [data-chat-item="true"][data-chat-index="1"] { opacity: 0.9 !important; }
      [data-chat-item="true"][data-chat-index="2"] { opacity: 0.8 !important; }
      [data-chat-item="true"][data-chat-index="3"] { opacity: 0.7 !important; }
      [data-chat-item="true"][data-chat-index="4"] { opacity: 0.6 !important; }
      [data-chat-item="true"][data-chat-index="5"] { opacity: 0.5 !important; }
      [data-chat-item="true"][data-chat-index="6"] { opacity: 0.4 !important; }
      [data-chat-item="true"][data-chat-index="7"] { opacity: 0.3 !important; }
      [data-chat-item="true"]:not([data-chat-index="0"]):not([data-chat-index="1"]):not([data-chat-index="2"]):not([data-chat-index="3"]):not([data-chat-index="4"]):not([data-chat-index="5"]):not([data-chat-index="6"]):not([data-chat-index="7"]) { 
        opacity: 0.2 !important; 
      }
      [data-chat-item="true"]:hover,
      [data-chat-item="true"].rounded-md:hover {
        opacity: 1.0 !important;
        background: rgba(255, 255, 255, 0.18) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        transform: translateY(-0.5px) !important;
      }
      .dark [data-chat-item="true"]:hover,
      .dark [data-chat-item="true"].rounded-md:hover {
        opacity: 1.0 !important;
        background: rgba(255, 255, 255, 0.11) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        transform: translateY(-0.5px) !important;
      }
      
      // USER NAV - TRANSPARENT (no backdrop filter)
      [data-user-nav="true"],
      [data-user-nav="true"].rounded-md {
        background: rgba(255, 255, 255, 0.15) !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        border-radius: 100px !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
      }
      [data-user-nav="true"]:hover,
      [data-user-nav="true"].rounded-md:hover {
        background: rgba(255, 255, 255, 0.27) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1) !important;
        transform: translateY(-0.5px) !important;
      }
      .dark [data-user-nav="true"],
      .dark [data-user-nav="true"].rounded-md {
        background: rgba(255, 255, 255, 0.06) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 100px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
      }
      .dark [data-user-nav="true"]:hover,
      .dark [data-user-nav="true"].rounded-md:hover {
        background: rgba(255, 255, 255, 0.11) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        border-radius: 100px !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3) !important;
        transform: translateY(-0.5px) !important;
      }
      
      // SIDEBAR MENU ACTION - TRANSPARENT (no backdrop filter)
      .group:hover [data-sidebar="menu-action"],
      [data-sidebar="menu-action"]:hover {
        background: rgba(255, 255, 255, 0.18) !important;
        border-radius: 6px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        transition: all 0.2s ease !important;
      }
      .dark .group:hover [data-sidebar="menu-action"],
      .dark [data-sidebar="menu-action"]:hover {
        background: rgba(255, 255, 255, 0.09) !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
      }
      
      // DROPDOWN MENU - KEEP BACKDROP FILTER (separate overlay)
      [data-radix-popper-content-wrapper] [role="menu"] {
        background: rgba(255, 255, 255, 0.8) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
      }
      .dark [data-radix-popper-content-wrapper] [role="menu"] {
        background: rgba(0, 0, 0, 0.8) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35) !important;
      }
      
      [data-sidebar="content"] {
        isolation: isolate;
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
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

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage && languages.some(lang => lang.code === savedLanguage)) {
      setSelectedLanguage(savedLanguage);
    }
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    console.log('🔍 Language changed to:', languageCode);
    setSelectedLanguage(languageCode);
    localStorage.setItem('selectedLanguage', languageCode);
    console.log('🔍 Language saved to localStorage:', languageCode);
  };

  const handleEmailSetupClick = () => {
    console.log('Email setup clicked!', { user, telegramUser });
    setShowTelegramEmailForm(true);
  };

  const handleTelegramFormComplete = () => {
    setShowTelegramEmailForm(false);
    router.refresh();
  };

  const handleTelegramFormSkip = () => {
    setShowTelegramEmailForm(false);
  };

  // Create telegram user object from user data if available
  const telegramUser = user && user.telegramId ? {
    id: user.telegramId,
    first_name: user.telegramFirstName || 'User',
    last_name: user.telegramLastName || undefined,
    username: user.telegramUsername || undefined,
    photo_url: user.telegramPhotoUrl || undefined,
    language_code: user.telegramLanguageCode || undefined,
    is_premium: user.telegramIsPremium || undefined,
    allows_write_to_pm: user.telegramAllowsWriteToPm || undefined,
  } : null;

  // Fallback telegram user for testing if no telegram data exists
  const fallbackTelegramUser = {
    id: 123456789,
    first_name: user?.email?.split('@')[0] || 'User',
    last_name: undefined,
    username: undefined,
    photo_url: undefined,
    language_code: 'en',
    is_premium: false,
    allows_write_to_pm: true,
  };

  const finalTelegramUser = telegramUser || fallbackTelegramUser;

  // On mobile, return only our custom mobile sidebar
  if (isMobile) {
    return (
      <>
        {/* Blurred overlay for mobile */}
        <div
          className={`fixed inset-0 z-30 transition-all duration-300 ${
            openMobile ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => setOpenMobile(false)}
        />
        
        {/* Mobile sidebar - solid background, no glass effect */}
        <div
          className={`fixed z-40 w-72 bg-background border border-border text-sidebar-foreground transition-all duration-300 ${
            openMobile ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
          }`}
          style={{
            borderRadius: '16px',
            margin: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            top: '0',
            bottom: '0',
            left: '0',
            height: 'calc(100vh - 16px)',
            width: 'calc(288px - 16px)', // 288px is w-72, subtract margin
          }}
        >
          <div className="flex h-full w-full flex-col pb-5">
            <SidebarHeader>
              <SidebarMenu>
                <div className="flex flex-row justify-center items-center">
                  <button
                    onClick={() => {
                      setOpenMobile(false);
                      router.push('/');
                    }}
                    className="flex flex-row gap-3 items-center"
                  >
                    <div className="rounded-md cursor-pointer flex items-center gap-3 transition-colors duration-200">
                      <Image
                        src="/images/glasslogo.png"
                        alt="Logo"
                        width={350}
                        height={150}
                        className="h-60 w-auto"
                      />
                    </div>
                  </button>
                </div>
              </SidebarMenu>
            </SidebarHeader>
                    <SidebarContent>
          {user && <EmailSetupBanner user={user} onClick={handleEmailSetupClick} />}
          
          {/* Temporary Debug Button */}
          {user && (
            <div className="mx-2 mb-2">
              <button
                onClick={() => {
                  console.log('Debug button clicked!');
                  setShowTelegramEmailForm(true);
                }}
                className="w-full p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs hover:bg-red-500/30 transition-colors"
              >
                🐛 DEBUG: Open Email Form
              </button>
            </div>
          )}
          
          <SidebarHistory user={user} />
          <GuestRegistrationBanner />
        </SidebarContent>
            <SidebarFooter>
              <div className="flex flex-row items-center gap-2 pb-2.5">
                <div className="flex-shrink-0">
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            className="h-10 w-fit px-2 bg-white/5 border border-white/20 hover:bg-white/10 transition-all duration-200 rounded-[100px]"
                          >
                            <GlobeIcon size={16} />
                            <span className="text-sm font-medium">
                              {languages.find(lang => lang.code === selectedLanguage)?.name.slice(0, 2).toUpperCase() || 'EN'}
                            </span>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px] bg-white/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl p-2">
                          <DropdownMenuLabel className="text-foreground px-2 py-1.5">Select Language</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-white/20" />
                          {languages.map((lang) => (
                            <DropdownMenuItem
                              key={lang.code}
                              onClick={() => handleLanguageChange(lang.code)}
                              className={`cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30 ${
                                selectedLanguage === lang.code ? 'bg-white/15 border-white/30 text-accent-foreground' : ''
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

        {/* TelegramEmailForm Modal for Mobile */}
        {showTelegramEmailForm && finalTelegramUser && (
          <TelegramEmailForm
            telegramUser={finalTelegramUser}
            onComplete={handleTelegramFormComplete}
            onSkip={handleTelegramFormSkip}
          />
        )}
      </>
    );
  }

  // Desktop sidebar - uses original Sidebar component
  return (
    <>
      <Sidebar className="sidebar-transparent h-screen">
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row justify-center items-center">
              <button
                onClick={() => {
                  setOpenMobile(false);
                  router.push('/');
                }}
                className="flex flex-row gap-3 items-center"
              >
                <div className="rounded-md cursor-pointer flex items-center gap-3 transition-colors duration-200">
                  <Image
                    src="/images/glasslogo.png"
                    alt="Logo"
                    width={350}
                    height={150}
                    className="h-60 w-auto"
                  />
                </div>
              </button>
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {user && <EmailSetupBanner user={user} onClick={handleEmailSetupClick} />}
          
          {/* Temporary Debug Button */}
          {user && (
            <div className="mx-2 mb-2">
              <button
                onClick={() => {
                  console.log('Debug button clicked!');
                  setShowTelegramEmailForm(true);
                }}
                className="w-full p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs hover:bg-red-500/30 transition-colors"
              >
                🐛 DEBUG: Open Email Form
              </button>
            </div>
          )}
          
          <SidebarHistory user={user} />
          <GuestRegistrationBanner />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex flex-row items-center gap-2 pb-2.5">
            <div className="flex-shrink-0">
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        className="h-10 w-fit px-2 bg-white/5 border border-white/20 hover:bg-white/10 transition-all duration-200 rounded-[100px]"
                      >
                        <GlobeIcon size={16} />
                        <span className="text-sm font-medium">
                          {languages.find(lang => lang.code === selectedLanguage)?.name.slice(0, 2).toUpperCase() || 'EN'}
                        </span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                                              <DropdownMenuContent align="start" className="w-[200px] bg-white/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl p-2">
                      <DropdownMenuLabel className="text-foreground px-2 py-1.5">Select Language</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/20" />
                      {languages.map((lang) => (
                        <DropdownMenuItem
                          key={lang.code}
                          onClick={() => handleLanguageChange(lang.code)}
                          className={`cursor-pointer text-left bg-transparent border border-transparent hover:bg-white/15 hover:text-accent-foreground transition-all duration-200 rounded-lg mx-1 hover:shadow-sm hover:border-white/30 ${
                            selectedLanguage === lang.code ? 'bg-white/15 border-white/30 text-accent-foreground' : ''
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

      {/* TelegramEmailForm Modal */}
      {showTelegramEmailForm && finalTelegramUser && (
        <TelegramEmailForm
          telegramUser={finalTelegramUser}
          onComplete={handleTelegramFormComplete}
          onSkip={handleTelegramFormSkip}
        />
      )}
    </>
  );
}
