'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useTelegram } from '@/hooks/useTelegram';
import { guestRegex } from '@/lib/constants';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Crown, 
  Globe,
  Bot,
  Activity,
  Clock,
  Star
} from 'lucide-react';
import React from 'react';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserStats {
  messagesLast24h: number;
  totalMessages: number;
  joinDate: string;
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { data: session } = useSession();
  const { user: telegramUser } = useTelegram();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Add glassomorphism styles
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* PROFILE MODAL GLASS EFFECTS */
      [data-profile-modal="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.85) 0%, 
          rgba(255, 255, 255, 0.75) 50%, 
          rgba(255, 255, 255, 0.85) 100%) !important;
        backdrop-filter: blur(30px) saturate(180%) contrast(100%) brightness(100%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(180%) contrast(100%) brightness(100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: 
          0 16px 50px 0 rgba(0, 0, 0, 0.15),
          0 8px 25px 0 rgba(0, 0, 0, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
      }
      .dark [data-profile-modal="true"] {
        background: linear-gradient(135deg, 
          rgba(0, 0, 0, 0.85) 0%, 
          rgba(0, 0, 0, 0.75) 50%, 
          rgba(0, 0, 0, 0.85) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 
          0 16px 50px 0 rgba(0, 0, 0, 0.4),
          0 8px 25px 0 rgba(0, 0, 0, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
      }
      
      /* PROFILE CARD GLASS EFFECTS */
      [data-profile-card="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.65) 0%, 
          rgba(255, 255, 255, 0.45) 50%, 
          rgba(255, 255, 255, 0.65) 100%) !important;
        backdrop-filter: blur(25px) saturate(180%) contrast(105%) brightness(105%) !important;
        -webkit-backdrop-filter: blur(25px) saturate(180%) contrast(105%) brightness(105%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.8), 
          inset 0 0 0 1px rgba(255,255,255,0.6),
          0 8px 32px rgba(0,0,0,0.12),
          0 4px 16px rgba(0,0,0,0.08),
          0 2px 8px rgba(0,0,0,0.04) !important;
        border-radius: 20px !important;
        transition: all 0.3s ease !important;
      }
      [data-profile-card="true"]:hover {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.75) 0%, 
          rgba(255, 255, 255, 0.55) 50%, 
          rgba(255, 255, 255, 0.75) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.6) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.9), 
          inset 0 0 0 1px rgba(255,255,255,0.7),
          0 12px 40px rgba(0,0,0,0.15),
          0 6px 20px rgba(0,0,0,0.1),
          0 3px 10px rgba(0,0,0,0.05) !important;
        transform: translateY(-2px) !important;
      }
      .dark [data-profile-card="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.18) 0%, 
          rgba(255, 255, 255, 0.10) 50%, 
          rgba(255, 255, 255, 0.18) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.3), 
          inset 0 0 0 1px rgba(255,255,255,0.2),
          0 8px 32px rgba(0,0,0,0.4),
          0 4px 16px rgba(0,0,0,0.25),
          0 2px 8px rgba(0,0,0,0.15) !important;
      }
      .dark [data-profile-card="true"]:hover {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.25) 0%, 
          rgba(255, 255, 255, 0.15) 50%, 
          rgba(255, 255, 255, 0.25) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.35) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.4), 
          inset 0 0 0 1px rgba(255,255,255,0.3),
          0 12px 40px rgba(0,0,0,0.5),
          0 6px 20px rgba(0,0,0,0.3),
          0 3px 10px rgba(0,0,0,0.2) !important;
        transform: translateY(-2px) !important;
      }
      
      /* PROFILE BADGE GLASS EFFECTS */
      [data-profile-badge="guest"] {
        background: linear-gradient(135deg, 
          rgba(255, 193, 7, 0.25) 0%, 
          rgba(255, 193, 7, 0.15) 100%) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(255, 193, 7, 0.3) !important;
        color: rgb(180, 83, 9) !important;
      }
      .dark [data-profile-badge="guest"] {
        background: linear-gradient(135deg, 
          rgba(255, 193, 7, 0.2) 0%, 
          rgba(255, 193, 7, 0.1) 100%) !important;
        color: rgb(251, 191, 36) !important;
      }
      
      [data-profile-badge="telegram"] {
        background: linear-gradient(135deg, 
          rgba(59, 130, 246, 0.25) 0%, 
          rgba(59, 130, 246, 0.15) 100%) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(59, 130, 246, 0.3) !important;
        color: rgb(29, 78, 216) !important;
      }
      .dark [data-profile-badge="telegram"] {
        background: linear-gradient(135deg, 
          rgba(59, 130, 246, 0.2) 0%, 
          rgba(59, 130, 246, 0.1) 100%) !important;
        color: rgb(96, 165, 250) !important;
      }
      
      [data-profile-badge="premium"] {
        background: linear-gradient(135deg, 
          rgba(37, 99, 235, 0.25) 0%, 
          rgba(37, 99, 235, 0.15) 100%) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(37, 99, 235, 0.3) !important;
        color: rgb(29, 78, 216) !important;
      }
      .dark [data-profile-badge="premium"] {
        background: linear-gradient(135deg, 
          rgba(37, 99, 235, 0.2) 0%, 
          rgba(37, 99, 235, 0.1) 100%) !important;
        color: rgb(96, 165, 250) !important;
      }
      
      [data-profile-badge="account-type"] {
        background: linear-gradient(135deg, 
          rgba(16, 185, 129, 0.25) 0%, 
          rgba(16, 185, 129, 0.15) 100%) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(16, 185, 129, 0.3) !important;
        color: rgb(5, 150, 105) !important;
      }
      .dark [data-profile-badge="account-type"] {
        background: linear-gradient(135deg, 
          rgba(16, 185, 129, 0.2) 0%, 
          rgba(16, 185, 129, 0.1) 100%) !important;
        color: rgb(52, 211, 153) !important;
      }
      
      /* PROFILE STATS GLASS EFFECTS */
      [data-profile-stat="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.55) 0%, 
          rgba(255, 255, 255, 0.35) 50%,
          rgba(255, 255, 255, 0.55) 100%) !important;
        backdrop-filter: blur(20px) saturate(160%) contrast(105%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(160%) contrast(105%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.7), 
          inset 0 0 0 1px rgba(255,255,255,0.5),
          0 6px 24px rgba(0,0,0,0.08),
          0 3px 12px rgba(0,0,0,0.04),
          0 1px 6px rgba(0,0,0,0.02) !important;
        border-radius: 16px !important;
        transition: all 0.3s ease !important;
      }
      [data-profile-stat="true"]:hover {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.65) 0%, 
          rgba(255, 255, 255, 0.45) 50%,
          rgba(255, 255, 255, 0.65) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.8), 
          inset 0 0 0 1px rgba(255,255,255,0.6),
          0 8px 32px rgba(0,0,0,0.12),
          0 4px 16px rgba(0,0,0,0.06),
          0 2px 8px rgba(0,0,0,0.03) !important;
        transform: translateY(-1px) scale(1.02) !important;
      }
      .dark [data-profile-stat="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.15) 0%, 
          rgba(255, 255, 255, 0.08) 50%,
          rgba(255, 255, 255, 0.15) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.25), 
          inset 0 0 0 1px rgba(255,255,255,0.18),
          0 6px 24px rgba(0,0,0,0.3),
          0 3px 12px rgba(0,0,0,0.2),
          0 1px 6px rgba(0,0,0,0.1) !important;
      }
      .dark [data-profile-stat="true"]:hover {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.22) 0%, 
          rgba(255, 255, 255, 0.12) 50%,
          rgba(255, 255, 255, 0.22) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.35), 
          inset 0 0 0 1px rgba(255,255,255,0.25),
          0 8px 32px rgba(0,0,0,0.4),
          0 4px 16px rgba(0,0,0,0.25),
          0 2px 8px rgba(0,0,0,0.15) !important;
        transform: translateY(-1px) scale(1.02) !important;
      }
      
      /* PROFILE PROGRESS BAR GLASS EFFECTS */
      [data-profile-progress="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.2) 0%, 
          rgba(255, 255, 255, 0.1) 100%) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 100px !important;
      }
      .dark [data-profile-progress="true"] {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.06) 0%, 
          rgba(255, 255, 255, 0.03) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      
      /* GUEST WARNING CARD GLASS EFFECTS */
      [data-profile-warning="true"] {
        background: linear-gradient(135deg, 
          rgba(251, 191, 36, 0.25) 0%, 
          rgba(251, 191, 36, 0.15) 50%,
          rgba(251, 191, 36, 0.25) 100%) !important;
        backdrop-filter: blur(20px) saturate(160%) contrast(105%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(160%) contrast(105%) !important;
        border: 1px solid rgba(251, 191, 36, 0.4) !important;
        box-shadow: 
          inset 0 1px 0 rgba(251, 191, 36, 0.5), 
          inset 0 0 0 1px rgba(251, 191, 36, 0.35),
          0 8px 32px rgba(251, 191, 36, 0.15),
          0 4px 16px rgba(251, 191, 36, 0.1),
          0 2px 8px rgba(0, 0, 0, 0.05) !important;
        border-radius: 20px !important;
        transition: all 0.3s ease !important;
      }
      [data-profile-warning="true"]:hover {
        background: linear-gradient(135deg, 
          rgba(251, 191, 36, 0.35) 0%, 
          rgba(251, 191, 36, 0.25) 50%,
          rgba(251, 191, 36, 0.35) 100%) !important;
        border: 1px solid rgba(251, 191, 36, 0.5) !important;
        box-shadow: 
          inset 0 1px 0 rgba(251, 191, 36, 0.6), 
          inset 0 0 0 1px rgba(251, 191, 36, 0.45),
          0 12px 40px rgba(251, 191, 36, 0.2),
          0 6px 20px rgba(251, 191, 36, 0.15),
          0 3px 10px rgba(0, 0, 0, 0.08) !important;
        transform: translateY(-1px) !important;
      }
      .dark [data-profile-warning="true"] {
        background: linear-gradient(135deg, 
          rgba(251, 191, 36, 0.18) 0%, 
          rgba(251, 191, 36, 0.10) 50%,
          rgba(251, 191, 36, 0.18) 100%) !important;
        border: 1px solid rgba(251, 191, 36, 0.3) !important;
        box-shadow: 
          inset 0 1px 0 rgba(251, 191, 36, 0.35), 
          inset 0 0 0 1px rgba(251, 191, 36, 0.25),
          0 8px 32px rgba(251, 191, 36, 0.12),
          0 4px 16px rgba(251, 191, 36, 0.08),
          0 2px 8px rgba(0, 0, 0, 0.2) !important;
      }
      .dark [data-profile-warning="true"]:hover {
        background: linear-gradient(135deg, 
          rgba(251, 191, 36, 0.25) 0%, 
          rgba(251, 191, 36, 0.15) 50%,
          rgba(251, 191, 36, 0.25) 100%) !important;
        border: 1px solid rgba(251, 191, 36, 0.4) !important;
        box-shadow: 
          inset 0 1px 0 rgba(251, 191, 36, 0.45), 
          inset 0 0 0 1px rgba(251, 191, 36, 0.35),
          0 12px 40px rgba(251, 191, 36, 0.15),
          0 6px 20px rgba(251, 191, 36, 0.1),
          0 3px 10px rgba(0, 0, 0, 0.25) !important;
        transform: translateY(-1px) !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const user = session?.user;
  const isGuest = guestRegex.test(user?.email ?? '');
  const isTelegramUser = user?.email?.startsWith('telegram_') && user?.email?.endsWith('@telegram.local');
  
  // Get user entitlements
  const userType = session?.user?.type || 'guest';
  const entitlements = entitlementsByUserType[userType];

  // Determine display information
  const displayName = telegramUser && isTelegramUser
    ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`
    : isGuest 
    ? 'Guest User' 
    : user?.name || user?.email;
    
  const avatarUrl = telegramUser?.photo_url && isTelegramUser
    ? telegramUser.photo_url
    : `https://avatar.vercel.sh/${user?.email}`;

  // Fetch user statistics
  useEffect(() => {
    if (open && user?.id) {
      setLoading(true);
      
      fetch('/api/user/stats')
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            console.error('Error fetching user stats:', data.error);
            setUserStats(null);
          } else {
            setUserStats(data);
          }
        })
        .catch(error => {
          console.error('Error fetching user stats:', error);
          setUserStats(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, user?.id]);

  const usagePercentage = userStats 
    ? Math.min((userStats.messagesLast24h / entitlements.maxMessagesPerDay) * 100, 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        data-profile-modal="true"
        className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-lg sm:border rounded-none border-none w-full h-full sm:w-auto sm:h-auto sm:max-w-2xl sm:max-h-[90vh]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info Section */}
          <Card data-profile-card="true" className="sm:border sm:rounded-lg border-none rounded-none">
            <CardHeader>
              <CardTitle className="text-lg">User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Image
                  src={avatarUrl}
                  alt={displayName ?? 'User Avatar'}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{displayName}</h3>
                    {isGuest && <Badge data-profile-badge="guest" variant="secondary">Guest</Badge>}
                    {isTelegramUser && <Badge data-profile-badge="telegram" variant="outline">Telegram</Badge>}
                    {telegramUser?.is_premium && (
                      <Badge data-profile-badge="premium" variant="default" className="bg-blue-600">
                        <Crown className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  
                  {user?.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </div>
                  )}
                  
                  {telegramUser?.username && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>@{telegramUser.username}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Telegram-specific info */}
              {telegramUser && isTelegramUser && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Language: {telegramUser.language_code?.toUpperCase() || 'Unknown'}</span>
                    </div>
                    {telegramUser.allows_write_to_pm !== undefined && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>DM: {telegramUser.allows_write_to_pm ? 'Allowed' : 'Restricted'}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account Type & Entitlements */}
          <Card data-profile-card="true" className="sm:border sm:rounded-lg border-none rounded-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Account Type & Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Account Type:</span>
                <Badge data-profile-badge="account-type" variant={userType === 'guest' ? 'secondary' : 'default'}>
                  {userType === 'guest' ? 'Guest' : 'Regular'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Daily Message Limit:</span>
                  <span className="font-medium">{entitlements.maxMessagesPerDay}</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Messages Today:</span>
                    <span className="font-medium">
                      {loading ? '...' : userStats?.messagesLast24h || 0} / {entitlements.maxMessagesPerDay}
                    </span>
                  </div>
                  <Progress data-profile-progress="true" value={usagePercentage} className="h-2" />
                </div>
              </div>


            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card data-profile-card="true" className="sm:border sm:rounded-lg border-none rounded-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Usage Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground">Loading statistics...</div>
              ) : userStats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div data-profile-stat="true" className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{userStats.messagesLast24h}</div>
                    <div className="text-sm text-muted-foreground">Messages (24h)</div>
                  </div>
                  <div data-profile-stat="true" className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{userStats.totalMessages}</div>
                    <div className="text-sm text-muted-foreground">Total Messages</div>
                  </div>
                  <div data-profile-stat="true" className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {Math.floor((Date.now() - new Date(userStats.joinDate).getTime()) / (1000 * 60 * 60 * 24))}
                    </div>
                    <div className="text-sm text-muted-foreground">Days Active</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">No statistics available</div>
              )}
              
              {userStats && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Member since: {new Date(userStats.joinDate).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Guest User Info */}
          {isGuest && (
            <Card data-profile-warning="true" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 sm:border sm:rounded-lg border-none rounded-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Guest Session</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                  You&apos;re using a temporary guest account. Create an account to save your chat history and get higher message limits.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 