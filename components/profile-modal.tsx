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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info Section */}
          <Card>
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
                    {isGuest && <Badge variant="secondary">Guest</Badge>}
                    {isTelegramUser && <Badge variant="outline">Telegram</Badge>}
                    {telegramUser?.is_premium && (
                      <Badge variant="default" className="bg-blue-600">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Account Type & Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Account Type:</span>
                <Badge variant={userType === 'guest' ? 'secondary' : 'default'}>
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
                  <Progress value={usagePercentage} className="h-2" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-medium text-sm">Available Models:</span>
                <div className="flex flex-wrap gap-2">
                  {entitlements.availableChatModelIds.map((modelId) => (
                    <Badge key={modelId} variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      {modelId === 'chat-model' ? 'Standard' : 'Reasoning'}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
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
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{userStats.messagesLast24h}</div>
                    <div className="text-sm text-muted-foreground">Messages (24h)</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{userStats.totalMessages}</div>
                    <div className="text-sm text-muted-foreground">Total Messages</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
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
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
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