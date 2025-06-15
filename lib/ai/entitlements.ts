import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
  // Trial balance system
  trialMessagesPerDay: number;
  useTrialBalance: boolean;
}

// Payment package interface
export interface PaymentPackage {
  messages: number;
  stars: number;
  popular: boolean;
  bonus: number;
  emoji: string;
  label: string;
  description?: string;
}

// Import payment configuration from centralized config
import { PAYMENT_SETTINGS, PAYMENT_PACKAGES, PAYMENT_MESSAGES } from '@/lib/config/payment-plans';

// Payment configuration for Telegram Stars
export const PAYMENT_CONFIG = {
  STARS_PER_MESSAGE: PAYMENT_SETTINGS.STARS_PER_MESSAGE,
  MINIMUM_MESSAGES: PAYMENT_SETTINGS.MINIMUM_MESSAGES,
  PACKAGES: PAYMENT_PACKAGES
};

// Helper functions for payment plan management
export const PaymentPlanHelpers = {
  /**
   * Get total messages for a package (including bonus)
   */
  getTotalMessages(packageIndex: number): number {
    const pkg = PAYMENT_CONFIG.PACKAGES[packageIndex];
    if (!pkg) return 0;
    return pkg.messages + pkg.bonus;
  },

  /**
   * Get display text for a package
   */
  getPackageDisplayText(packageIndex: number): string {
    const pkg = PAYMENT_CONFIG.PACKAGES[packageIndex];
    if (!pkg) return '';
    
    const totalMessages = this.getTotalMessages(packageIndex);
    const bonusText = pkg.bonus > 0 ? ` (${pkg.messages} + ${pkg.bonus} bonus)` : '';
    const popularText = pkg.popular ? ' (Popular)' : '';
    
    return `${pkg.emoji} ${totalMessages} Messages${bonusText} - ${pkg.stars} ⭐${popularText}`;
  },

  /**
   * Get keyboard button text for a package
   */
  getPackageButtonText(packageIndex: number): string {
    const pkg = PAYMENT_CONFIG.PACKAGES[packageIndex];
    if (!pkg) return '';
    
    const totalMessages = this.getTotalMessages(packageIndex);
    return `${pkg.emoji} ${totalMessages} Messages - ${pkg.stars} ⭐`;
  },

  /**
   * Get all keyboard buttons for the purchase menu
   */
  getAllKeyboardButtons(): string[][] {
    return PAYMENT_CONFIG.PACKAGES.map((_, index) => [
      this.getPackageButtonText(index)
    ]);
  },

  /**
   * Get purchase menu text with all packages
   */
  getPurchaseMenuText(): string {
    const packageList = PAYMENT_CONFIG.PACKAGES.map((pkg, index) => {
      const totalMessages = this.getTotalMessages(index);
      const bonusText = pkg.bonus > 0 ? ` (${pkg.messages} + ${pkg.bonus} bonus)` : '';
      const popularText = pkg.popular ? ' (Popular)' : '';
      
      return `${pkg.emoji} **${totalMessages} Messages**${bonusText} - ${pkg.stars} ⭐${popularText}`;
    }).join('\n');

    return `${PAYMENT_MESSAGES.PURCHASE_HEADER}

Available packages:

${packageList}

${PAYMENT_MESSAGES.PURCHASE_FOOTER}`;
  },

  /**
   * Find package index by button text
   */
  findPackageByButtonText(buttonText: string): number {
    return PAYMENT_CONFIG.PACKAGES.findIndex((_, index) => 
      this.getPackageButtonText(index) === buttonText.trim()
    );
  },

  /**
   * Find package by star amount
   */
  findPackageByStars(stars: number): PaymentPackage | null {
    return PAYMENT_CONFIG.PACKAGES.find(pkg => pkg.stars === stars) || null;
  },

  /**
   * Get package by index
   */
  getPackage(index: number): PaymentPackage | null {
    return PAYMENT_CONFIG.PACKAGES[index] || null;
  },

  /**
   * Validate package index
   */
  isValidPackageIndex(index: number): boolean {
    return index >= 0 && index < PAYMENT_CONFIG.PACKAGES.length;
  }
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account (unregistered)
   */
  guest: {
    maxMessagesPerDay: 1000,  // Legacy limit (increased for testing)
    trialMessagesPerDay: 2, // NEW: 500 messages per day trial (increased for testing)
    useTrialBalance: true,    // NEW: Use trial balance system
    availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
  },

  /*
   * For users with an account (registered)
   */
  regular: {
    maxMessagesPerDay: 2000,  // Legacy limit (increased for testing)
    trialMessagesPerDay: 50, // NEW: 1000 messages per day trial (increased for testing)
    useTrialBalance: true,     // NEW: Use trial balance system
    availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
