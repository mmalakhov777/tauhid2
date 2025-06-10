'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { guestRegex } from '@/lib/constants';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  User,
  Mail,
  Crown,
  Globe,
  MessageSquare,
  Calendar,
  Clock,
  Star,
  X,
  BarChart3,
  Bot,
  Activity
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

// Custom Badge Component - Self-Contained
const CustomBadge = ({ 
  children, 
  variant = 'default',
  className = '',
  ...props 
}: {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline';
  className?: string;
  [key: string]: any;
}) => {
  const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    outline: 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
  };

  return (
    <span
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

// Custom Card Component - Self-Contained
const CustomCard = ({ 
  children, 
  className = '',
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <div
      className={`
        bg-white/30 dark:bg-gray-800/90
        border border-gray-200/60 dark:border-gray-700/60
        rounded-2xl p-3 sm:p-4 md:p-6
        shadow-sm
        backdrop-blur-sm
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

// Custom Progress Component - Self-Contained
const CustomProgress = ({ value, className = '' }: { value: number; className?: string }) => {
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 ${className}`}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
};

// Custom Separator Component - Self-Contained
const CustomSeparator = ({ className = '' }: { className?: string }) => {
  return <div className={`border-t border-gray-200 dark:border-gray-700 ${className}`} />;
};

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { data: session } = useSession();
  const { user: telegramUser } = useTelegram();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted on the client
  useEffect(() => {
    setMounted(true);
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

  if (!open || !mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 backdrop-blur-sm z-[9999] transition-all duration-300"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="pointer-events-auto w-full max-w-2xl mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="
              relative w-full 
              h-[90vh] sm:h-auto sm:max-h-[85vh]
              overflow-y-auto
              bg-white/10 dark:bg-gray-900/10
              backdrop-blur-xl
              border border-white/20 dark:border-gray-700/30
              rounded-2xl
              shadow-2xl
              transform transition-all duration-300 scale-100 opacity-100
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="
                absolute top-4 right-4 z-10 p-2 rounded-full
                bg-gray-100 dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                text-gray-700 dark:text-gray-300
                hover:bg-gray-200 dark:hover:bg-gray-700
                transition-colors duration-200
              "
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="p-4 sm:p-6 pb-2 sm:pb-4">
              <h2 className="text-lg sm:text-xl font-normal tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                Profile Information
              </h2>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
              {/* User Info Section */}
              <CustomCard>
                <div className="space-y-4">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">User Information</h3>
                  
                  <div className="flex items-center gap-3">
                    <Image
                      src={avatarUrl}
                      alt={displayName ?? 'User Avatar'}
                      width={40}
                      height={40}
                      className="rounded-full w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">{displayName}</h4>
                        {isGuest && <CustomBadge variant="secondary">Guest</CustomBadge>}
                        {isTelegramUser && <CustomBadge variant="outline">Telegram</CustomBadge>}
                        {telegramUser?.is_premium && (
                          <CustomBadge variant="default">
                            <Crown className="h-3 w-3 mr-1" />
                            Premium
                          </CustomBadge>
                        )}
                      </div>
                      
                      {user?.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      )}
                      
                      {telegramUser?.username && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <span className="truncate">@{telegramUser.username}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Telegram-specific info */}
                  {telegramUser && isTelegramUser && (
                    <>
                      <CustomSeparator />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <Globe className="h-3 w-3 flex-shrink-0" />
                          <span>Language: {telegramUser.language_code?.toUpperCase() || 'Unknown'}</span>
                        </div>
                        {telegramUser.allows_write_to_pm !== undefined && (
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <MessageSquare className="h-3 w-3 flex-shrink-0" />
                            <span>DM: {telegramUser.allows_write_to_pm ? 'Allowed' : 'Restricted'}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CustomCard>

              {/* Account Type & Entitlements */}
              <CustomCard>
                <div className="space-y-4">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4" />
                    Account Type & Limits
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Account Type:</span>
                    <CustomBadge variant={userType === 'guest' ? 'secondary' : 'default'}>
                      {userType === 'guest' ? 'Guest' : 'Regular'}
                    </CustomBadge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-900 dark:text-white">Messages Today:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {loading ? '...' : userStats?.messagesLast24h || 0} / {entitlements.maxMessagesPerDay}
                      </span>
                    </div>
                    <CustomProgress value={usagePercentage} />
                  </div>
                </div>
              </CustomCard>

              {/* Telegram User Data */}
              {telegramUser && isTelegramUser && (
                <CustomCard>
                  <div className="space-y-4">
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                      Telegram User Data
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Telegram ID:</span>
                          <span className="font-mono text-xs text-gray-900 dark:text-white">{telegramUser.id}</span>
                        </div>
                        
                        {telegramUser.username && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Username:</span>
                            <span className="font-mono text-xs text-gray-900 dark:text-white">@{telegramUser.username}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">First Name:</span>
                          <span className="text-xs text-gray-900 dark:text-white">{telegramUser.first_name}</span>
                        </div>
                        
                        {telegramUser.last_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Last Name:</span>
                            <span className="text-xs text-gray-900 dark:text-white">{telegramUser.last_name}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Language:</span>
                          <span className="text-xs text-gray-900 dark:text-white">{telegramUser.language_code?.toUpperCase() || 'Unknown'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Premium:</span>
                          <CustomBadge variant={telegramUser.is_premium ? "default" : "secondary"}>
                            {telegramUser.is_premium ? (
                              <>
                                <Crown className="h-3 w-3 mr-1" />
                                Yes
                              </>
                            ) : (
                              'No'
                            )}
                          </CustomBadge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">DM Access:</span>
                          <CustomBadge variant={telegramUser.allows_write_to_pm ? "default" : "secondary"}>
                            {telegramUser.allows_write_to_pm ? 'Allowed' : 'Restricted'}
                          </CustomBadge>
                        </div>
                        
                        {telegramUser.photo_url && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Profile Photo:</span>
                            <CustomBadge variant="default">Available</CustomBadge>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <CustomSeparator />
                    
                    <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4" />
                        <span className="font-medium">Telegram Integration</span>
                      </div>
                      <p>
                        This account is linked to Telegram. Your profile information is automatically 
                        synchronized with your Telegram account data.
                      </p>
                    </div>
                  </div>
                </CustomCard>
              )}

              {/* Usage Statistics */}
              <CustomCard>
                <div className="space-y-4">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                    Usage Statistics
                  </h3>
                  
                  {loading ? (
                    <div className="text-center text-xs text-gray-600 dark:text-gray-400">Loading...</div>
                  ) : userStats ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="text-center p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-lg sm:text-xl font-semibold text-blue-600 dark:text-blue-400">{userStats.messagesLast24h}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">24h</div>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400">{userStats.totalMessages}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-lg sm:text-xl font-semibold text-purple-600 dark:text-purple-400">
                          {Math.floor((Date.now() - new Date(userStats.joinDate).getTime()) / (1000 * 60 * 60 * 24))}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Days</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-gray-600 dark:text-gray-400">No stats available</div>
                  )}
                  
                  {userStats && (
                    <>
                      <CustomSeparator />
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>Member since: {new Date(userStats.joinDate).toLocaleDateString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </CustomCard>

              {/* Guest User Info */}
              {isGuest && (
                <CustomCard className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="font-medium">Guest Session</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    You&apos;re using a temporary guest account. Create an account to save your chat history and get higher message limits.
                  </p>
                </CustomCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render modal at document body level using portal
  return createPortal(modalContent, document.body);
} 