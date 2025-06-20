'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { guestRegex } from '@/lib/constants';
import { entitlementsByUserType, PAYMENT_CONFIG } from '@/lib/ai/entitlements';
import { useTranslations } from '@/lib/i18n';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import {
  User,
  Mail,
  Crown,
  Globe,
  MessageSquare,
  Calendar,
  Clock,
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
  trialBalance?: {
    trialMessagesRemaining: number;
    paidMessagesRemaining: number;
    totalMessagesRemaining: number;
    needsReset: boolean;
    trialMessagesPerDay: number;
    useTrialBalance: boolean;
  } | null;
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
    default: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
    secondary: 'bg-secondary text-secondary-foreground dark:bg-secondary dark:text-secondary-foreground',
    outline: 'text-muted-foreground dark:text-muted-foreground'
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
        bg-card dark:bg-card
        border border-border dark:border-border
        rounded-2xl p-3 sm:p-4 md:p-6
        shadow-sm
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
    <div className={`w-full bg-muted dark:bg-muted rounded-full h-2 ${className}`}>
      <div 
        className="bg-primary h-2 rounded-full transition-all duration-300" 
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
};

// Custom Separator Component - Self-Contained
const CustomSeparator = ({ className = '' }: { className?: string }) => {
  return <div className={`border-t border-border dark:border-border ${className}`} />;
};

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { data: session } = useSession();
  const { user: telegramUser, webApp, isTelegramAvailable } = useTelegram();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslations();

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
    ? t('profileModal.guest') + ' User' 
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

  // Calculate usage percentage based on trial balance system
  const usagePercentage = userStats?.trialBalance?.useTrialBalance 
    ? Math.max(0, Math.min(100, 
        ((userStats.trialBalance.trialMessagesPerDay - userStats.trialBalance.trialMessagesRemaining) / userStats.trialBalance.trialMessagesPerDay) * 100
      ))
    : userStats 
    ? Math.min((userStats.messagesLast24h / entitlements.maxMessagesPerDay) * 100, 100)
    : 0;

  // Handle buy button click - either send command in Telegram or open external bot
  const handleBuyClick = () => {
    if (webApp && isTelegramAvailable) {
      console.log('[ProfileModal] Inside Telegram mini app, triggering /buy command');
      try {
        // When inside Telegram mini app, use openTelegramLink to trigger the /buy command
        // This will send the command to the bot and close the mini app
        if (typeof webApp.openTelegramLink === 'function') {
          // Use the bot's direct link with the buy command
          webApp.openTelegramLink('https://t.me/tauhid_app_bot?start=buy');
          // The mini app will remain open according to Bot API 7.0+
          // So we manually close it after a short delay
          setTimeout(() => {
            if (typeof webApp.close === 'function') {
              webApp.close();
            }
          }, 100);
        } else {
          // Fallback: close the mini app so user can type /buy manually
          if (typeof webApp.close === 'function') {
            webApp.close();
          }
        }
      } catch (error) {
        console.error('[ProfileModal] Error triggering /buy command:', error);
        // Fallback to external bot link
        window.open('https://t.me/tauhid_app_bot?start=buy', '_blank');
      }
    } else {
      console.log('[ProfileModal] Opening external Telegram bot link');
      // Not in Telegram mini app, open external bot
      window.open('https://t.me/tauhid_app_bot?start=buy', '_blank');
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9999] transition-all duration-300"
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
              bg-background dark:bg-background
              border border-border dark:border-border
              rounded-2xl
              shadow-xl
              transform transition-all duration-300 scale-100 opacity-100
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="
                absolute top-4 right-4 z-10 p-2 rounded-full
                bg-muted dark:bg-muted
                border border-border dark:border-border
                text-muted-foreground dark:text-muted-foreground
                hover:bg-accent dark:hover:bg-accent
                transition-colors duration-200
              "
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="p-4 sm:p-6 pb-2 sm:pb-4">
              <h2 className="text-lg sm:text-xl font-normal tracking-tight text-foreground dark:text-foreground flex items-center gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('profileModal.profileInformation')}
              </h2>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
              {/* User Info Section */}
              <CustomCard>
                <div className="space-y-4">
                  <h3 className="text-sm sm:text-base font-medium text-foreground dark:text-foreground">{t('profileModal.userInformation')}</h3>
                  
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
                        <h4 className="text-sm sm:text-base font-medium text-foreground dark:text-foreground truncate">{displayName}</h4>
                        {isGuest && <CustomBadge variant="secondary">{t('profileModal.guest')}</CustomBadge>}
                        {isTelegramUser && <CustomBadge variant="outline">{t('profileModal.telegram')}</CustomBadge>}
                        {telegramUser?.is_premium && (
                          <CustomBadge variant="default">
                            <Crown className="h-3 w-3 mr-1" />
                            {t('profileModal.premium')}
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
                          <span>{t('profileModal.language')}: {telegramUser.language_code?.toUpperCase() || t('profileModal.unknown')}</span>
                        </div>
                        {telegramUser.allows_write_to_pm !== undefined && (
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <MessageSquare className="h-3 w-3 flex-shrink-0" />
                            <span>{t('profileModal.dm')}: {telegramUser.allows_write_to_pm ? t('profileModal.dmAllowed') : t('profileModal.dmRestricted')}</span>
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
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                    {t('profileModal.accountTypeLimits')}
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{t('profileModal.accountType')}</span>
                    <CustomBadge variant={userType === 'guest' ? 'secondary' : 'default'}>
                      {userType === 'guest' ? t('profileModal.guestAccount') : t('profileModal.regularAccount')}
                    </CustomBadge>
                  </div>
                  
                  {/* NEW: Trial Balance System Display */}
                  {userStats?.trialBalance?.useTrialBalance ? (
                    <div className="space-y-3">
                      {/* Trial Messages */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-900 dark:text-white">{t('profileModal.trialMessagesToday')}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {loading ? '...' : userStats.trialBalance.trialMessagesRemaining} / {userStats.trialBalance.trialMessagesPerDay}
                          </span>
                        </div>
                        <CustomProgress value={usagePercentage} />
                        {userStats.trialBalance.needsReset && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            ⏰ {t('profileModal.trialBalanceReset')}
                          </div>
                        )}
                      </div>
                      
                      {/* Paid Messages (if any) */}
                      {userStats.trialBalance.paidMessagesRemaining > 0 && (
                                                  <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-900 dark:text-white">
                                {t('profileModal.paidMessages')}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {userStats.trialBalance.paidMessagesRemaining}
                              </span>
                            </div>
                          </div>
                      )}
                      
                      {/* Total Available */}
                      <div className="pt-2 border-t border-border dark:border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground dark:text-foreground">{t('profileModal.totalMessagesAvailable')}</span>
                          <span className="font-bold text-foreground dark:text-foreground">
                            {userStats.trialBalance.totalMessagesRemaining}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* LEGACY: Old message counting system */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-900 dark:text-white">{t('profileModal.messagesToday')}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {loading ? '...' : userStats?.messagesLast24h || 0} / {entitlements.maxMessagesPerDay}
                        </span>
                      </div>
                      <CustomProgress value={usagePercentage} />
                    </div>
                  )}
                </div>
              </CustomCard>

              {/* Telegram User Data */}
              {telegramUser && isTelegramUser && (
                <CustomCard>
                  <div className="space-y-4">
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-gray-900 dark:text-white" />
                      {t('profileModal.telegramUserData')}
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.telegramId')}</span>
                          <span className="font-mono text-xs text-gray-900 dark:text-white">{telegramUser.id}</span>
                        </div>
                        
                        {telegramUser.username && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.username')}</span>
                            <span className="font-mono text-xs text-gray-900 dark:text-white">@{telegramUser.username}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.firstName')}</span>
                          <span className="text-xs text-gray-900 dark:text-white">{telegramUser.first_name}</span>
                        </div>
                        
                        {telegramUser.last_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.lastName')}</span>
                            <span className="text-xs text-gray-900 dark:text-white">{telegramUser.last_name}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.language')}</span>
                          <span className="text-xs text-gray-900 dark:text-white">{telegramUser.language_code?.toUpperCase() || t('profileModal.unknown')}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.premium')}</span>
                          <CustomBadge variant={telegramUser.is_premium ? "default" : "secondary"}>
                            {telegramUser.is_premium ? (
                              <>
                                <Crown className="h-3 w-3 mr-1" />
                                {t('profileModal.yes')}
                              </>
                            ) : (
                              t('profileModal.no')
                            )}
                          </CustomBadge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.dmAccess')}</span>
                          <CustomBadge variant={telegramUser.allows_write_to_pm ? "default" : "secondary"}>
                            {telegramUser.allows_write_to_pm ? t('profileModal.dmAllowed') : t('profileModal.dmRestricted')}
                          </CustomBadge>
                        </div>
                        
                        {telegramUser.photo_url && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('profileModal.profilePhoto')}</span>
                            <CustomBadge variant="default">{t('profileModal.available')}</CustomBadge>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <CustomSeparator />
                    
                    <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4" />
                        <span className="font-medium">{t('profileModal.telegramIntegration')}</span>
                      </div>
                      <p>
                        {t('profileModal.telegramIntegrationDescription')}
                      </p>
                    </div>
                  </div>
                </CustomCard>
              )}

              {/* Purchase Messages Section */}
              {userStats?.trialBalance?.useTrialBalance && (
                <CustomCard className="bg-muted dark:bg-muted">
                  <div className="space-y-4">
                    <div className="text-foreground dark:text-foreground">
                      <span className="font-medium">{t('profileModal.purchaseMoreMessages')}</span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      {t('profileModal.needMoreMessages')} {isTelegramUser ? t('profileModal.useBuyCommand') : t('profileModal.purchaseAdditionalMessages')}
                    </p>
                    
                    {isTelegramUser ? (
                      <div className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                          💬 {t('profileModal.telegramPurchase')}
                        </div>
                                                  <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                            <div>• {t('profileModal.openTelegramChat')}</div>
                            <div>• {t('profileModal.sendCommand')}: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/buy</code></div>
                            <div>• {t('profileModal.choosePackage')}</div>
                            <div>• {t('profileModal.messagesAddedInstantly')}</div>
                          </div>
                      </div>
                    ) : (
                      <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-4">
                          🌟 {t('profileModal.purchaseMessages')}
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                          {/* Button for mobile/tablet and desktop */}
                          <div className="space-y-3">
                            <div className="text-xs text-gray-700 dark:text-gray-300">
                              🔒 {t('profileModal.securePaymentSystem')}
                            </div>
                            <button
                              onClick={handleBuyClick}
                              className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.896 6.728-1.268 7.928-1.268 7.928-.16.906-.923 1.101-1.517.683 0 0-2.271-1.702-3.414-2.559-.24-.18-.513-.54-.24-.96l2.34-2.277c.26-.252.52-.756 0-.756-.52 0-3.414 2.277-3.414 2.277-.817.533-1.75.684-1.75.684l-3.293-.906s-.414-.252-.274-.756c.14-.504.793-.756.793-.756s7.776-2.834 10.428-3.788-.793-.286 1.793-.133 1.793 1.125z"/>
                              </svg>
                              {isTelegramAvailable ? t('profileModal.sendBuyCommand') : t('profileModal.openTelegramBot')}
                            </button>
                          </div>

                          {/* QR Code for desktop */}
                          <div className="hidden lg:flex flex-col items-center justify-center space-y-3 w-full">
                            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 w-full flex justify-center">
                              <QRCodeGenerator 
                                url="https://t.me/tauhid_app_bot?start=buy"
                                size={160}
                                className="mx-auto"
                              />
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                              {t('profileModal.scanWithPhone')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CustomCard>
              )}

              {/* Usage Statistics */}
              <CustomCard>
                <div className="space-y-4">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                    {t('profileModal.usageStatistics')}
                  </h3>
                  
                  {loading ? (
                    <div className="text-center text-xs text-gray-600 dark:text-gray-400">{t('profileModal.loading')}</div>
                  ) : userStats ? (
                    <>
                      {/* NEW: Trial Balance System Stats */}
                      {userStats.trialBalance?.useTrialBalance ? (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                              {userStats.trialBalance.trialMessagesRemaining}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Trial Left</div>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-yellow-600 dark:text-yellow-400">
                              {userStats.trialBalance.paidMessagesRemaining}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Paid Left</div>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400">
                              {userStats.trialBalance.totalMessagesRemaining}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Total Available</div>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-purple-600 dark:text-purple-400">
                              {userStats.totalMessages}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">All Time</div>
                          </div>
                        </div>
                      ) : (
                        /* LEGACY: Old stats display */
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{userStats.messagesLast24h}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{t('profileModal.last24h')}</div>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400">{userStats.totalMessages}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{t('profileModal.total')}</div>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="text-lg sm:text-xl font-semibold text-purple-600 dark:text-purple-400">
                              {Math.floor((Date.now() - new Date(userStats.joinDate).getTime()) / (1000 * 60 * 60 * 24))}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{t('profileModal.days')}</div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-xs text-gray-600 dark:text-gray-400">{t('profileModal.noStatsAvailable')}</div>
                  )}
                  
                  {userStats && (
                    <>
                      <CustomSeparator />
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>{t('profileModal.memberSince')} {new Date(userStats.joinDate).toLocaleDateString()}</span>
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
                    <span className="font-medium">{t('profileModal.guestSession')}</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('profileModal.guestSessionDescription')}
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