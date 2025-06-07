'use client';

import { useEffect, useState } from 'react';

interface WebAppInitData {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat?: WebAppChat;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

interface WebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

interface WebAppChat {
  id: number;
  type: 'group' | 'supergroup' | 'channel';
  title: string;
  username?: string;
  photo_url?: string;
}

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: WebAppInitData;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isActive: boolean;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  bottomBarColor: string;
  isClosingConfirmationEnabled: boolean;
  isVerticalSwipesEnabled: boolean;
  isFullscreen: boolean;
  isOrientationLocked: boolean;
  // Methods and other properties are not fully typed here for brevity
  ready: () => void;
  // Add other methods as needed
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const TelegramDebug = () => {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready(); // Inform Telegram that the app is ready
        setWebApp(tg);
      } catch (e: any) {
        setError(`Error initializing Telegram WebApp: ${e.message}`);
        console.error("Telegram WebApp initialization error:", e);
      }
    } else {
      const timeoutId = setTimeout(() => {
        if (!window.Telegram?.WebApp) {
            setError('Telegram WebApp script not loaded or failed to initialize after 3 seconds.');
            console.warn('Telegram WebApp script not loaded or failed to initialize after 3 seconds.');
        } else {
            const stillTg = window.Telegram.WebApp;
            if (stillTg) {
                try {
                    stillTg.ready();
                    setWebApp(stillTg);
                } catch (e: any) {
                    setError(`Error initializing Telegram WebApp on retry: ${e.message}`);
                    console.error("Telegram WebApp initialization error on retry:", e);
                }
            }
        }
      }, 3000); // Wait 3 seconds for the script to load
      return () => clearTimeout(timeoutId);
    }
  }, []);

  if (error) {
    return (
      <div style={{ padding: '10px', border: '1px solid red', margin: '10px', backgroundColor: '#ffe0e0', color: 'red' }}>
        <p><strong>Telegram WebApp Error:</strong></p>
        <p>{error}</p>
      </div>
    );
  }

  if (!webApp) {
    return (
      <div style={{ padding: '10px', border: '1px solid orange', margin: '10px', backgroundColor: '#fff3e0', color: 'orange' }}>
        <p>Initializing Telegram Mini App...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', margin: '10px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Telegram Mini App Debug Info</h3>
      <p><strong>Status:</strong> Initialized</p>
      <p><strong>Version:</strong> {webApp.version}</p>
      <p><strong>Platform:</strong> {webApp.platform}</p>
      <p><strong>Color Scheme:</strong> {webApp.colorScheme}</p>
      <p><strong>Is Active:</strong> {webApp.isActive?.toString() ?? 'N/A (requires Bot API 8.0+)'}</p>
      <p><strong>Is Expanded:</strong> {webApp.isExpanded.toString()}</p>
      <p><strong>Viewport Height:</strong> {webApp.viewportHeight}px</p>
      <p><strong>Viewport Stable Height:</strong> {webApp.viewportStableHeight}px</p>
      <p><strong>Header Color:</strong> {webApp.headerColor}</p>
      <p><strong>Background Color:</strong> {webApp.backgroundColor}</p>
      <p><strong>Start Parameter:</strong> {webApp.initDataUnsafe?.start_param || 'None'}</p>
      <p><strong>User (unsafe):</strong></p>
      <pre style={{ backgroundColor: '#eee', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
        {JSON.stringify(webApp.initDataUnsafe?.user, null, 2) || 'No user data'}
      </pre>
      <p><strong>Chat (unsafe):</strong></p>
      <pre style={{ backgroundColor: '#eee', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
        {JSON.stringify(webApp.initDataUnsafe?.chat, null, 2) || 'No chat data'}
      </pre>
      <p><strong>Full initDataUnsafe:</strong></p>
      <pre style={{ backgroundColor: '#eee', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
        {JSON.stringify(webApp.initDataUnsafe, null, 2)}
      </pre>
    </div>
  );
};

export default TelegramDebug; 