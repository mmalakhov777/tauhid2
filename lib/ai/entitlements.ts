import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
  // Trial balance system
  trialMessagesPerDay: number;
  useTrialBalance: boolean;
}

// Payment configuration for Telegram Stars
export const PAYMENT_CONFIG = {
  STARS_PER_MESSAGE: 5,           // 1 message = 5 stars
  MINIMUM_MESSAGES: 20,           // Minimum purchase: 20 messages
  PACKAGES: [
    { messages: 20, stars: 100, popular: false, bonus: 0 },
    { messages: 50, stars: 250, popular: true, bonus: 0 },
    { messages: 100, stars: 500, popular: false, bonus: 5 },
    { messages: 200, stars: 1000, popular: false, bonus: 20 }
  ]
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account (unregistered)
   */
  guest: {
    maxMessagesPerDay: 1000,  // Legacy limit (increased for testing)
    trialMessagesPerDay: 500, // NEW: 500 messages per day trial (increased for testing)
    useTrialBalance: true,    // NEW: Use trial balance system
    availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
  },

  /*
   * For users with an account (registered)
   */
  regular: {
    maxMessagesPerDay: 2000,  // Legacy limit (increased for testing)
    trialMessagesPerDay: 1000, // NEW: 1000 messages per day trial (increased for testing)
    useTrialBalance: true,     // NEW: Use trial balance system
    availableChatModelIds: ['chat-model', 'chat-model-reasoning'],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
