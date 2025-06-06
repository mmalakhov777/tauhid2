import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { TelegramAutoAuth } from '@/components/TelegramAutoAuth';
import Script from 'next/script';

import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  metadataBase: new URL('https://chat.vercel.ai'),
  title: 'Next.js Chatbot Template',
  description: 'Next.js chatbot template using the AI SDK.',
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Telegram Mini App viewport support */
            :root {
              --tg-viewport-height: 100vh;
              --tg-viewport-stable-height: 100vh;
            }
            
            /* Mobile-specific styles to prevent swipe-to-close and add top spacing */
            @media (max-width: 768px) {
              .mobile-body {
                overflow: hidden;
                height: 100vh;
                padding-top: 20px;
              }

              .mobile-wrap {
                position: absolute;
                left: 0;
                top: 20px;
                right: 0;
                bottom: 0;
                overflow-x: hidden;
                overflow-y: auto;
                background: var(--background);
              }

              .mobile-content {
                min-height: calc(100% + 1px);
                background: var(--background);
              }
            }
          `
        }} />
      </head>
      <body className="antialiased" id="app-body">
        <Script 
          src="https://telegram.org/js/telegram-web-app.js?57" 
          strategy="beforeInteractive"
        />
        
        <div id="app-wrap">
          <div id="app-content">
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Toaster position="top-center" />
              <SessionProvider>
                <TelegramAutoAuth />
                {children}
              </SessionProvider>
            </ThemeProvider>
          </div>
        </div>
        
        <script dangerouslySetInnerHTML={{
          __html: `
            // Apply Telegram Mini App sticky behavior and top spacing
            (function() {
              // Wait for Telegram WebApp to be available
              function applyTelegramStyles() {
                if (window.Telegram && window.Telegram.WebApp) {
                  const tg = window.Telegram.WebApp;
                  
                  // Check if we're on mobile
                  const isMobile = window.innerWidth < 768;
                  
                  // Skip for desktop platforms
                  if (['macos', 'tdesktop', 'weba', 'web', 'webk'].includes(tg.platform)) {
                    return;
                  }
                  
                  if (isMobile) {
                    // Expand the app
                    if (tg.expand) {
                      tg.expand();
                    }
                    
                    // Apply mobile classes to prevent swipe-to-close
                    document.getElementById('app-body').classList.add('mobile-body');
                    document.getElementById('app-wrap').classList.add('mobile-wrap');
                    document.getElementById('app-content').classList.add('mobile-content');
                  }
                }
              }
              
              // Try immediately
              applyTelegramStyles();
              
              // Also try after DOM is loaded
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyTelegramStyles);
              }
              
              // And after a short delay as fallback
              setTimeout(applyTelegramStyles, 100);
            })();
          `
        }} />
      </body>
    </html>
  );
}
