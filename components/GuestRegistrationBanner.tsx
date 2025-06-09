'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { guestRegex } from '@/lib/constants';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, MessageSquare, Sparkles, X, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GuestRegistrationBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [userStats, setUserStats] = useState<{ messagesLast24h: number } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const user = session?.user;
  const isGuest = user?.type === 'guest' || guestRegex.test(user?.email ?? '');

  // Reset dismissed state on page refresh - banner will show again after refresh
  useEffect(() => {
    // Clear the dismissed state on component mount (page refresh)
    localStorage.removeItem('guestBannerDismissed');
    setIsDismissed(false);
  }, []);

  // Fetch user statistics to show current usage
  useEffect(() => {
    if (isGuest && user?.id && !isDismissed) {
      fetch('/api/user/stats')
        .then(response => response.json())
        .then(data => {
          if (!data.error) {
            setUserStats(data);
          }
        })
        .catch(error => {
          console.error('Error fetching user stats:', error);
        });
    }
  }, [isGuest, user?.id, isDismissed]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent banner click when dismissing
    setIsDismissed(true);
    localStorage.setItem('guestBannerDismissed', 'true');
  };

  const handleRegister = () => {
    router.push('/register');
  };

  // Don't show banner if user is not a guest or if dismissed
  if (!isGuest || isDismissed) {
    return null;
  }

  const guestLimit = entitlementsByUserType.guest.maxMessagesPerDay;
  const regularLimit = entitlementsByUserType.regular.maxMessagesPerDay;
  const messagesUsed = userStats?.messagesLast24h || 0;
  const messagesRemaining = Math.max(0, guestLimit - messagesUsed);
  const usagePercentage = (messagesUsed / guestLimit) * 100;

  return (
    <div 
      className="mx-3 mb-4 relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 hover:backdrop-blur-sm hover:border-white/30 rounded-xl p-4"
      onClick={handleRegister}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
      
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary/3 rounded-full blur-lg animate-pulse delay-1000" />
      
      <div className="relative z-10">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0 h-6 w-6 p-0 text-muted-foreground hover:text-foreground transition-colors bg-transparent hover:bg-white/20"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping opacity-75" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Register account
            </h3>
            <p className="text-xs text-muted-foreground">
              Save your messages and chat history
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 