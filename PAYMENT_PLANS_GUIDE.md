# Payment Plans Management Guide

This guide explains how to manage payment plans for the Telegram Stars payment system.

## 📍 Single Source of Truth

All payment plans are configured in **one place**:
```
tauhid2/lib/config/payment-plans.ts
```

## 🎯 How to Modify Payment Plans

### 1. Edit Payment Packages

Open `lib/config/payment-plans.ts` and modify the `PAYMENT_PACKAGES` array:

```typescript
export const PAYMENT_PACKAGES: PaymentPackage[] = [
  {
    messages: 20,        // Base messages
    stars: 100,          // Price in Telegram Stars
    popular: false,      // Show "(Popular)" badge
    bonus: 0,            // Bonus messages (added to base)
    emoji: '💎',         // Display emoji
    label: 'Starter',    // Package name
    description: 'Perfect for trying out the service'
  },
  // Add more packages here...
];
```

### 2. Modify Settings

Change basic payment settings:

```typescript
export const PAYMENT_SETTINGS = {
  STARS_PER_MESSAGE: 5,    // Conversion rate
  MINIMUM_MESSAGES: 20,    // Minimum purchase
  CURRENCY: 'XTR',         // Telegram Stars currency
};
```

### 3. Update Messages

Customize user-facing messages:

```typescript
export const PAYMENT_MESSAGES = {
  PURCHASE_HEADER: '🌟 *Purchase Messages with Telegram Stars*',
  PURCHASE_FOOTER: '💡 *Telegram Stars* can be purchased...',
  SUCCESS_TITLE: '✅ *Payment Successful!*',
  // ... more messages
};
```

## 🔄 Automatic Updates

When you save changes to `payment-plans.ts`, **all components automatically use the new values**:

- ✅ Telegram `/buy` command
- ✅ Payment buttons and keyboard
- ✅ Invoice creation
- ✅ Success messages
- ✅ Package validation
- ✅ Payment processing

## 📋 Example: Adding a New Package

To add a "Ultimate" package with 500 messages for 2000 stars:

```typescript
{
  messages: 500,
  stars: 2000,
  popular: false,
  bonus: 50,           // 50 bonus messages = 550 total
  emoji: '💫',
  label: 'Ultimate',
  description: 'For power users'
}
```

## 🧪 Testing Changes

After modifying payment plans:

1. Save the file
2. Test the `/buy` command in Telegram
3. Verify all packages display correctly
4. Test a payment flow to ensure everything works

## 🏗️ Architecture

```
lib/config/payment-plans.ts          # ← EDIT HERE
    ↓
lib/ai/entitlements.ts              # Imports config
    ↓
app/api/telegram/webhook/route.ts   # Uses helpers
app/api/telegram/purchase/route.ts  # Uses helpers
```

## 🚨 Important Notes

- **Always test** after making changes
- **Backup** before major modifications
- **Keep star prices** reasonable (100-2000 range)
- **Bonus messages** are added to base messages
- **Popular flag** shows "(Popular)" in UI
- **Emoji** should be single character

## 🔧 Advanced Customization

For advanced changes, you can modify the helper functions in `lib/ai/entitlements.ts`:

- `PaymentPlanHelpers.getPurchaseMenuText()` - Customize menu display
- `PaymentPlanHelpers.getPackageButtonText()` - Customize button text
- Add new helper functions as needed

---

**Remember**: One file to rule them all! 🎯 