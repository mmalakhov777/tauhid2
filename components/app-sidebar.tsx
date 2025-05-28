'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';

import { PlusIcon, GlobeIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
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
  const { setOpenMobile } = useSidebar();
  const [selectedLanguage, setSelectedLanguage] = useState('en');

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

  return (
    <Sidebar className="group-data-[side=left]:border-r-0 bg-sidebar border-sidebar-border">
      <SidebarHeader className="bg-sidebar-accent/50 border-b border-sidebar-border">
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <div className="px-3 py-2 hover:bg-sidebar-accent rounded-md cursor-pointer flex items-center gap-3 transition-colors">
                <Image
                  src="/assets/logonewblack.png"
                  alt="Logo"
                  width={160}
                  height={60}
                  className="h-12 w-auto"
                />
                <span className="text-lg font-semibold text-sidebar-foreground">Mustafid AI</span>
              </div>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit hover:bg-sidebar-accent text-sidebar-foreground border border-sidebar-border"
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
      <SidebarContent className="bg-sidebar">
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter className="bg-sidebar-accent/30 border-t border-sidebar-border">
        <div className="flex flex-row items-center gap-2 p-2">
          <div className="flex-shrink-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      className="data-[state=open]:bg-sidebar-primary data-[state=open]:text-sidebar-primary-foreground bg-sidebar-accent hover:bg-sidebar-primary hover:text-sidebar-primary-foreground h-10 w-fit px-3 border border-sidebar-border transition-colors"
                    >
                      <GlobeIcon size={16} />
                      <span className="text-sm font-medium">
                        {languages.find(lang => lang.code === selectedLanguage)?.name.slice(0, 2).toUpperCase() || 'EN'}
                      </span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px] bg-sidebar-accent border-sidebar-border">
                    <DropdownMenuLabel className="text-sidebar-foreground">Select Language</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-sidebar-border" />
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground transition-colors ${
                          selectedLanguage === lang.code ? 'bg-sidebar-primary text-sidebar-primary-foreground' : ''
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
