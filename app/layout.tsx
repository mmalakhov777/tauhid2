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
            
            /* Force 20px top spacing on mobile for Telegram Mini App */
            @media (max-width: 768px) {
              body {
                padding-top: 20px !important;
                margin-top: 0 !important;
              }
              
              /* Ensure all content respects the padding */
              body > * {
                margin-top: 0 !important;
              }
              
              /* Fixed header spacer */
              .telegram-top-spacer {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 20px !important;
                background-color: var(--background, #ffffff) !important;
                z-index: 999999 !important;
                display: block !important;
              }
            }
          `
        }} />
      </head>
      <body className="antialiased">
        <Script 
          src="https://telegram.org/js/telegram-web-app.js?57" 
          strategy="beforeInteractive"
        />
        
        {/* Top spacing bar - will be made visible via JavaScript */}
        <div 
          id="telegram-top-bar"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '20px',
            backgroundColor: 'var(--background)',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            zIndex: 999999,
            display: 'none',
          }}
        />
        
        {/* Main content wrapper */}
        <div id="main-content" style={{ paddingTop: '0' }}>
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
        
        <script dangerouslySetInnerHTML={{
          __html: `
            // Force 20px top spacing for mobile Telegram
            (function() {
              function applyMobileSpacing() {
                const isMobile = window.innerWidth < 768;
                const topBar = document.getElementById('telegram-top-bar');
                const mainContent = document.getElementById('main-content');
                
                if (isMobile && topBar && mainContent) {
                  // Show the top bar
                  topBar.style.display = 'block';
                  // Add padding to main content
                  mainContent.style.paddingTop = '20px';
                  
                  // Also try to set body padding
                  document.body.style.paddingTop = '20px';
                  
                  console.log('Telegram Mini App: 20px top spacing applied');
                }
              }
              
              // Apply immediately
              applyMobileSpacing();
              
              // Apply after DOM ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyMobileSpacing);
              }
              
              // Apply after Telegram WebApp is ready
              if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.ready();
                applyMobileSpacing();
              }
              
              // Apply on resize
              window.addEventListener('resize', applyMobileSpacing);
              
              // Final attempt after delay
              setTimeout(applyMobileSpacing, 500);
            })();
          `
        }} />
      </body>
    </html>
  );
}
