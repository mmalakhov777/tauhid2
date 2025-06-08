'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';

import { PlusIcon, GlobeIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { EmailSetupBanner } from '@/components/EmailSetupBanner';
import { GuestRegistrationBanner } from '@/components/GuestRegistrationBanner';
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

  // On mobile, return only our custom mobile sidebar
  if (isMobile) {
    return (
      <>
        {/* Overlay for mobile */}
        <div
          className={`fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 ${
            openMobile ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
          onClick={() => setOpenMobile(false)}
        />
        
        {/* Mobile sidebar */}
        <div
          className={`fixed left-0 z-40 w-72 bg-sidebar text-sidebar-foreground border-r border-border transition-transform duration-300 ${
            openMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{
            top: '0',
            bottom: '0', // Remove bottom spacing
            height: '100vh' // Full height without spacing
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
                        src="/assets/conceptlogo2.webp"
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
              {user && <EmailSetupBanner user={user} />}
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
    <Sidebar className="group-data-[side=left]:border-r border-border h-screen">
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
                  src="/assets/conceptlogo2.webp"
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
        {user && <EmailSetupBanner user={user} />}
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
