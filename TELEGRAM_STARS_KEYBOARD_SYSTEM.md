# Telegram Stars Purchase System with Reply Keyboard Buttons

## 📋 Overview

This system allows users to purchase message credits for the Tauhid AI chatbot using **Telegram Stars** through an intuitive **reply keyboard interface**. Users can tap keyboard buttons that appear at the bottom of their screen to select and purchase message packages seamlessly.

## 🎯 Key Features

- ✅ **Reply Keyboard Buttons** - Buttons appear in keyboard area (not inline in messages)
- ✅ **Telegram Stars Integration** - Native Telegram payment system
- ✅ **One-Time Keyboard** - Clean UX with disappearing keyboard after selection
- ✅ **Secure Payment Processing** - Full validation and transaction recording
- ✅ **Instant Message Delivery** - Credits added immediately after payment
- ✅ **Backward Compatibility** - Supports both keyboard buttons and number input
- ✅ **Beautiful Design** - Emoji-enhanced package display

## 🚀 User Flow

### 1. Initiate Purchase
```
User types: /buy
```
**Result:** Bot displays purchase message with 4 keyboard buttons at bottom of screen

### 2. Package Selection
**Keyboard Buttons:**
- `💎 20 Messages - 100 ⭐`
- `🔥 50 Messages - 250 ⭐` 
- `⭐ 105 Messages - 500 ⭐`
- `🚀 220 Messages - 1000 ⭐`

**User Action:** Taps desired package button
**Result:** Keyboard disappears, invoice created

### 3. Payment Processing
- Telegram opens native payment interface
- User completes payment with Telegram Stars
- Payment processed securely by Telegram

### 4. Message Delivery
- Messages automatically added to user account
- Transaction recorded in database
- Confirmation message sent to user

## 🔧 Technical Implementation

### Core Components

#### 1. Reply Keyboard Function
```typescript
async function sendMessageWithReplyKeyboard(
  chatId: number, 
  text: string, 
  keyboardButtons: string[][], 
  parseMode: string = 'HTML'
)
```

**Features:**
- `resize_keyboard: true` - Fits screen perfectly
- `one_time_keyboard: true` - Disappears after selection
- Fallback to regular message if keyboard fails

#### 2. Package Selection Handler
```typescript
const packageSelections = [
  '💎 20 Messages - 100 ⭐',
  '🔥 50 Messages - 250 ⭐', 
  '⭐ 105 Messages - 500 ⭐',
  '🚀 220 Messages - 1000 ⭐'
];
```

**Supports:**
- Keyboard button text matching
- Legacy number input (1, 2, 3, 4)
- Case-insensitive matching

#### 3. Invoice Creation
```typescript
const invoicePayload = `pkg_${packageIndex}_${telegramUserId}_${selectedPackage.stars}`;

await fetch(`${TELEGRAM_API_URL}/sendInvoice`, {
  method: 'POST',
  body: JSON.stringify({
    chat_id: chatId,
    title: `${totalMessages} Messages${bonusText}`,
    description: `Purchase ${totalMessages} messages for your Tauhid AI chatbot...`,
    payload: invoicePayload,
    provider_token: '', // Empty for Telegram Stars
    currency: 'XTR', // Telegram Stars currency
    prices: [{ label: `${totalMessages} Messages`, amount: selectedPackage.stars }]
  })
});
```

### Payment Processing Pipeline

#### 1. Pre-Checkout Validation
```typescript
// Webhook receives: pre_checkout_query
const payloadParts = preCheckoutQuery.invoice_payload.split('_');
// Format: pkg_${packageIndex}_${telegramUserId}_${stars}

// Validations:
- Payload format validation
- User ID matching
- Package index validation
- Price verification
- Currency check (XTR)
```

#### 2. Successful Payment Processing
```typescript
// Webhook receives: successful_payment
const packageIndex = parseInt(payloadParts[1]);
const selectedPackage = PAYMENT_CONFIG.PACKAGES[packageIndex];
const totalMessages = selectedPackage.messages + selectedPackage.bonus;

// Database updates:
await addPaidMessages(dbUser.id, totalMessages);
await recordStarPayment({
  userId: dbUser.id,
  telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
  starAmount: successfulPayment.total_amount,
  messagesAdded: totalMessages,
});
```

## 📦 Package Configuration

### Available Packages
```typescript
PAYMENT_CONFIG.PACKAGES = [
  { messages: 20,  bonus: 0,  stars: 100,  popular: false }, // 💎 Starter
  { messages: 50,  bonus: 0,  stars: 250,  popular: true  }, // 🔥 Popular
  { messages: 100, bonus: 5,  stars: 500,  popular: false }, // ⭐ Value
  { messages: 200, bonus: 20, stars: 1000, popular: false }  // 🚀 Premium
];
```

### Package Details
| Package | Messages | Bonus | Total | Stars | Features |
|---------|----------|-------|-------|-------|----------|
| 💎 Starter | 20 | 0 | 20 | 100 ⭐ | Basic package |
| 🔥 Popular | 50 | 0 | 50 | 250 ⭐ | Most popular |
| ⭐ Value | 100 | 5 | 105 | 500 ⭐ | Best value |
| 🚀 Premium | 200 | 20 | 220 | 1000 ⭐ | Maximum messages |

## 🛡️ Security Features

### Payment Validation
- **Payload Format Validation** - Ensures correct `pkg_index_userid_stars` format
- **User ID Verification** - Matches payload user ID with actual user
- **Package Validation** - Verifies package exists and is valid
- **Price Verification** - Confirms payment amount matches package price
- **Currency Check** - Ensures payment is in Telegram Stars (XTR)

### Transaction Security
- **Unique Transaction IDs** - Each payment has unique Telegram charge ID
- **Database Recording** - All transactions logged with full details
- **Error Handling** - Graceful failure handling with user notifications
- **Audit Trail** - Complete payment history tracking

## 💾 Database Schema

### User Balance Updates
```sql
UPDATE users SET 
  paidMessagesRemaining = paidMessagesRemaining + {messagesAdded},
  totalMessagesPurchased = totalMessagesPurchased + {messagesAdded},
  lastPurchaseAt = NOW()
WHERE id = {userId};
```

### Payment Recording
```sql
INSERT INTO starPayment (
  userId,
  telegramPaymentChargeId,
  starAmount,
  messagesAdded,
  status,
  createdAt
) VALUES (
  {userId},
  {telegramChargeId},
  {starAmount},
  {messagesAdded},
  'completed',
  NOW()
);
```

## 🎨 User Interface

### Purchase Message Format
```markdown
🌟 *Purchase Messages with Telegram Stars*

Available packages:

💎 **20 Messages** - 100 ⭐
🔥 **50 Messages** - 250 ⭐ (Popular)
⭐ **105 Messages** (100 + 5 bonus) - 500 ⭐
🚀 **220 Messages** (200 + 20 bonus) - 1000 ⭐

💡 *Telegram Stars* can be purchased directly in Telegram
📱 Tap a button below to create an invoice
💰 Paid messages never expire and stack with your daily trial messages
```

### Confirmation Message Format
```markdown
✅ *Payment Successful!*

**Package:** 20 Messages
**Price:** 100 ⭐ Telegram Stars
**Transaction ID:** `TCH_xxx...`

🎉 **20 messages** have been added to your account!
💰 Your paid messages never expire and work alongside your daily trial messages.

Use `/balance` to check your current message balance.
```

## 🔄 Message Balance System

### Balance Types
1. **Trial Messages** - Free daily allowance (resets daily)
   - Guests: 2 messages/day
   - Regular users: 5 messages/day
2. **Paid Messages** - Purchased with Telegram Stars (never expire)

### Consumption Priority
1. **Trial messages consumed first** (use free allowance)
2. **Paid messages consumed second** (preserve purchased credits)

### Balance Commands
- `/balance` - Check current message counts
- `/debug` - Detailed balance and user information
- `/buy` - Purchase more messages with keyboard interface

## 🛠️ API Endpoints

### Telegram Bot API Calls
- **`/sendMessage`** - Send messages with reply keyboard
- **`/sendInvoice`** - Create Telegram Stars invoices
- **`/answerPreCheckoutQuery`** - Validate payments before processing

### Webhook Handlers
- **`POST /api/telegram/webhook`** - Main webhook endpoint
  - Handles `/buy` command
  - Processes package selection
  - Manages pre-checkout queries
  - Processes successful payments

## 🧪 Testing

### Manual Testing Steps
1. **Test Purchase Flow**
   ```
   1. Send /buy command
   2. Verify keyboard buttons appear
   3. Tap a package button
   4. Verify invoice creation
   5. Complete payment (if testing with real Stars)
   6. Verify message credit addition
   7. Check confirmation message
   ```

2. **Test Backward Compatibility**
   ```
   1. Send /buy command
   2. Type "1" instead of tapping button
   3. Verify invoice creation works
   ```

3. **Test Error Handling**
   ```
   1. Test with invalid package selection
   2. Test with user not in database
   3. Test payment validation failures
   ```

## 🚨 Error Handling

### Common Error Scenarios
- **User not found in database** - Shows error message, suggests /start
- **Invalid package selection** - Shows valid options
- **Payment validation failure** - Rejects pre-checkout with error message
- **Invoice creation failure** - Shows error with description
- **Database update failure** - Logs error, notifies user to contact support

### Fallback Mechanisms
- **Keyboard failure** - Falls back to regular message
- **Payment processing error** - Maintains transaction integrity
- **Network issues** - Retry mechanisms with exponential backoff

## 📊 Analytics & Monitoring

### Key Metrics to Track
- **Purchase conversion rate** - /buy commands → completed purchases
- **Package popularity** - Which packages are selected most
- **Payment success rate** - Pre-checkout approvals → successful payments
- **User retention** - Purchase behavior over time
- **Revenue tracking** - Total Stars collected per time period

### Logging
- All purchase attempts logged with user ID and package
- Payment validations logged with success/failure reasons
- Database updates logged with transaction details
- Error conditions logged with full context

## 🔮 Future Enhancements

### Potential Improvements
- **Subscription packages** - Monthly/yearly message allowances
- **Bulk discounts** - Better pricing for larger packages
- **Gift messages** - Allow users to gift messages to others
- **Referral bonuses** - Reward users for referrals
- **Usage analytics** - Show users their message usage patterns
- **Custom packages** - Allow users to create custom message amounts

### Technical Enhancements
- **Payment retry logic** - Handle temporary payment failures
- **Webhook reliability** - Implement webhook retry mechanisms
- **Performance optimization** - Cache package configurations
- **Multi-language support** - Localized purchase interface
- **A/B testing** - Test different package configurations

## 📝 Changelog

### Version 1.0 (Current)
- ✅ Reply keyboard button implementation
- ✅ Telegram Stars payment integration
- ✅ Secure payment validation pipeline
- ✅ Database integration for message credits
- ✅ Comprehensive error handling
- ✅ Backward compatibility with number input
- ✅ Beautiful emoji-enhanced UI

---

## 🎉 Conclusion

The Telegram Stars Purchase System with Reply Keyboard Buttons provides a **seamless, secure, and user-friendly** way for users to purchase message credits. The system combines Telegram's native payment capabilities with an intuitive keyboard interface to create an optimal user experience while maintaining robust security and reliability.

**Key Benefits:**
- 🎯 **Intuitive UX** - No typing required, just tap buttons
- 🛡️ **Secure Payments** - Telegram's trusted payment system
- ⚡ **Instant Delivery** - Messages added immediately
- 🔄 **Reliable Processing** - Comprehensive error handling
- 📱 **Mobile Optimized** - Perfect for mobile Telegram usage

The system is **production-ready** and provides a solid foundation for monetizing the Tauhid AI chatbot through Telegram Stars! 🚀 