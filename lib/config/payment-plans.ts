/**
 * Payment Plans Configuration
 * 
 * This file contains all payment plan configurations.
 * To modify payment plans, simply edit the values below.
 * All components will automatically use the updated values.
 */

import type { PaymentPackage } from '@/lib/ai/entitlements';

// Basic payment settings
export const PAYMENT_SETTINGS = {
  STARS_PER_MESSAGE: 5,           // How many stars = 1 message
  MINIMUM_MESSAGES: 20,           // Minimum purchase amount
  CURRENCY: 'XTR',                // Telegram Stars currency code
} as const;

// Payment packages configuration
// To add/remove/modify packages, edit this array
export const PAYMENT_PACKAGES: PaymentPackage[] = [
  {
    messages: 20,
    stars: 100,
    popular: false,
    bonus: 0,
    emoji: '💎',
    label: 'Starter',
    description: 'Perfect for trying out the service'
  },
  {
    messages: 50,
    stars: 250,
    popular: true,           // This will show "(Popular)" in the UI
    bonus: 0,
    emoji: '🔥',
    label: 'Popular',
    description: 'Most popular choice'
  },
  {
    messages: 100,
    stars: 500,
    popular: false,
    bonus: 5,                // Bonus messages added to the package
    emoji: '⭐',
    label: 'Value Pack',
    description: 'Best value with bonus messages'
  },
  {
    messages: 200,
    stars: 1000,
    popular: false,
    bonus: 20,               // Big bonus for premium package
    emoji: '🚀',
    label: 'Premium',
    description: 'Maximum messages with big bonus'
  }
];

// Marketing messages
export const PAYMENT_MESSAGES = {
  PURCHASE_HEADER: '🌟 *Purchase Messages with Telegram Stars*',
  PURCHASE_FOOTER: `💡 *Telegram Stars* can be purchased directly in Telegram
📱 Tap a button below to create an invoice
💰 Paid messages never expire and stack with your daily trial messages`,
  
  SUCCESS_TITLE: '✅ *Payment Successful!*',
  SUCCESS_FOOTER: `💰 Your paid messages never expire and work alongside your daily trial messages.

Use \`/balance\` to check your current message balance.`,
  
  ERROR_INVALID_PACKAGE: '❌ Invalid package number. Please send 1, 2, 3, or 4.',
  ERROR_USER_NOT_FOUND: '❌ Purchase error: User not found in database',
  ERROR_INVOICE_CREATION: '❌ Failed to create invoice',
  ERROR_PAYMENT_PROCESSING: '❌ Payment received but failed to add messages. Please contact support with your payment details.'
} as const;

/**
 * How to modify payment plans:
 * 
 * 1. Edit PAYMENT_PACKAGES array above
 * 2. Modify PAYMENT_SETTINGS if needed
 * 3. Update PAYMENT_MESSAGES for different text
 * 4. Save the file - all components will automatically use new values
 * 
 * Example: To add a new package:
 * {
 *   messages: 500,
 *   stars: 2000,
 *   popular: false,
 *   bonus: 50,
 *   emoji: '💫',
 *   label: 'Ultimate',
 *   description: 'For power users'
 * }
 */ 