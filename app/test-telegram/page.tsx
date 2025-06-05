'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function TestTelegramPage() {
  const { data: session, status } = useSession();
  const [telegramData, setTelegramData] = useState<any>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      setTelegramData({
        initData: tg.initData,
        initDataUnsafe: tg.initDataUnsafe,
        version: tg.version,
        platform: tg.platform,
      });
    }
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Telegram Authentication Test</h1>
      
      <div className="space-y-6">
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Session Status</h2>
          <p className="text-sm text-muted-foreground">Status: {status}</p>
          {session && (
            <div className="mt-2">
              <p className="text-sm">User ID: {session.user.id}</p>
              <p className="text-sm">Email: {session.user.email}</p>
              <p className="text-sm">Type: {session.user.type}</p>
              {session.user.telegramId && (
                <p className="text-sm">Telegram ID: {session.user.telegramId}</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Telegram WebApp Data</h2>
          {telegramData ? (
            <pre className="text-xs overflow-auto bg-muted p-2 rounded">
              {JSON.stringify(telegramData, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No Telegram data available</p>
          )}
        </div>
      </div>
    </div>
  );
} 