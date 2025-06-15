# 🌟 Telegram Stars Purchase System

## Overview

The Telegram Stars Purchase System allows users to buy additional messages using Telegram's native payment system with Telegram Stars. This system integrates seamlessly with our existing trial balance system to provide a smooth monetization experience.

## 🏗️ System Architecture

### Components

1. **Purchase API** (`/api/telegram/purchase`)
   - Creates Telegram invoices
   - Handles purchase requests
   - Validates packages and users

2. **Payment Webhook** (`/api/telegram/payment-webhook`)
   - Processes pre-checkout queries
   - Handles successful payments
   - Updates user balances

3. **Telegram Bot Commands**
   - `/buy` - Shows purchase menu with inline buttons
   - `/balance` - Shows current message balance
   - Callback query handling for package selection

4. **Profile Modal Integration**
   - Shows purchase options for web users
   - Displays Telegram-specific instructions
   - Shows available packages

## 💰 Payment Packages

```typescript
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
```

### Package Details
- **Starter**: 20 messages for 100 ⭐
- **Popular**: 50 messages for 250 ⭐ (marked as popular)
- **Value**: 105 messages for 500 ⭐ (+5 bonus messages)
- **Premium**: 220 messages for 1000 ⭐ (+20 bonus messages)

## 🔄 Purchase Flow

### 1. User Initiates Purchase
```
User sends /buy command → Bot shows package menu with inline buttons
```

### 2. Package Selection
```
User clicks package → Callback query processed → Invoice created
```

### 3. Payment Process
```
Telegram shows invoice → User pays with Stars → Pre-checkout validation
```

### 4. Payment Completion
```
Payment successful → Webhook processes → Messages added to balance
```

## 🛠️ API Endpoints

### POST /api/telegram/purchase
Creates a Telegram Stars invoice for a selected package.

**Request:**
```json
{
  "telegramUserId": 123456789,
  "packageIndex": 1
}
```

**Response:**
```json
{
  "success": true,
  "invoiceLink": "https://t.me/invoice/...",
  "payload": "uuid-string",
  "package": {
    "messages": 50,
    "bonus": 0,
    "totalMessages": 50,
    "stars": 250
  }
}
```

### POST /api/telegram/payment-webhook
Handles Telegram payment webhooks (pre-checkout and successful payments).

**Pre-checkout Query:**
```json
{
  "pre_checkout_query": {
    "id": "query_id",
    "from": { "id": 123456789 },
    "total_amount": 250,
    "currency": "XTR",
    "invoice_payload": "uuid-string"
  }
}
```

**Successful Payment:**
```json
{
  "message": {
    "from": { "id": 123456789 },
    "chat": { "id": 123456789 },
    "successful_payment": {
      "currency": "XTR",
      "total_amount": 250,
      "telegram_payment_charge_id": "charge_id",
      "invoice_payload": "uuid-string"
    }
  }
}
```

## 🤖 Telegram Bot Commands

### /buy Command
Shows an interactive menu with purchase options:

```
🌟 Purchase Messages with Telegram Stars

Choose a package to buy more messages:

1. **20 Messages** (20) - 100 ⭐
2. **50 Messages** (50) - 250 ⭐ 🔥
3. **105 Messages** (100 + 5 bonus) - 500 ⭐
4. **220 Messages** (200 + 20 bonus) - 1000 ⭐

💡 Telegram Stars can be purchased directly in Telegram
📱 Tap any package below to create an invoice
💰 Paid messages never expire and stack with your daily trial messages
```

### /balance Command
Shows current message balance:

```
💰 Your Message Balance

🎯 Trial Messages: 3
💎 Paid Messages: 47
📊 Total Available: 50

✅ Trial balance is current
```

## 🗄️ Database Integration

### Functions Used
- `addPaidMessages(userId, messageCount)` - Adds paid messages to user balance
- `recordStarPayment(paymentData)` - Records payment transaction
- `getUserMessageBalance(userId)` - Gets current balance
- `getUserByTelegramId(telegramId)` - Finds user by Telegram ID

### Payment Record Structure
```typescript
{
  userId: string,
  telegramPaymentChargeId: string,
  starAmount: number,
  messagesAdded: number
}
```

## 🎨 Frontend Integration

### Profile Modal
The profile modal now shows:
- Purchase section for trial balance users
- Telegram-specific instructions for Telegram users
- Available packages for web users
- Instructions to connect Telegram account

### Features
- **Telegram Users**: Direct instructions to use `/buy` command
- **Web Users**: Package information and Telegram connection prompt
- **Visual Design**: Blue-themed cards with star icons
- **Responsive**: Works on mobile and desktop

## 🧪 Testing

### Manual Testing Commands

1. **Check Balance**
   ```
   /balance
   ```

2. **Start Purchase Flow**
   ```
   /buy
   ```

3. **Test Package Selection**
   - Click any package button
   - Verify invoice creation
   - Check payment flow

### Test Scenarios

1. **Valid Purchase**
   - User exists in database
   - Valid package selected
   - Payment completes successfully
   - Messages added to balance

2. **Invalid User**
   - Non-existent Telegram user
   - Should show error message

3. **Invalid Package**
   - Invalid package index
   - Should show error message

4. **Payment Failure**
   - Pre-checkout validation fails
   - Should prevent payment

### Debug Commands
```bash
# Check user balance
/balance

# Show debug info
/debug

# Test database connection
/dbtest
```

## 🔧 Configuration

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
```

### Webhook Setup
You need to configure Telegram to send payment webhooks to:
```
https://yourdomain.com/api/telegram/payment-webhook
```

### Bot Settings
In BotFather, ensure your bot has:
- Payments enabled
- Webhook configured
- Commands set up:
  ```
  buy - Purchase more messages with Telegram Stars
  balance - Check your message balance
  ```

## 🚀 Deployment

### Steps
1. Deploy the new API endpoints
2. Update Telegram webhook URL (if needed)
3. Test payment flow in production
4. Monitor logs for any issues

### Monitoring
- Check payment webhook logs
- Monitor successful payment processing
- Track user balance updates
- Watch for failed transactions

## 💡 Benefits

### For Users
- **Seamless Payment**: Native Telegram Stars integration
- **Instant Delivery**: Messages added immediately after payment
- **No Expiration**: Paid messages never expire
- **Stacking**: Works alongside daily trial messages
- **Transparent**: Clear pricing and package information

### For Business
- **Monetization**: Direct revenue from message purchases
- **Low Friction**: No external payment processors needed
- **Telegram Native**: Uses Telegram's trusted payment system
- **Scalable**: Handles multiple package tiers
- **Trackable**: Complete payment audit trail

### For Developers
- **Clean API**: Well-structured endpoints
- **Error Handling**: Comprehensive error management
- **Logging**: Detailed transaction logging
- **Type Safety**: Full TypeScript support
- **Testable**: Easy to test and debug

## 🔍 Troubleshooting

### Common Issues

1. **Invoice Creation Fails**
   - Check bot token validity
   - Verify user exists in database
   - Validate package index

2. **Payment Not Processing**
   - Check webhook URL configuration
   - Verify payment webhook endpoint
   - Check database connection

3. **Messages Not Added**
   - Check payment webhook logs
   - Verify database update functions
   - Check user ID mapping

### Error Messages
- `❌ User not found in database` - User needs to start conversation first
- `❌ Invalid package index` - Package selection error
- `❌ Failed to create invoice` - Telegram API error
- `❌ Purchase system temporarily unavailable` - System error

## 📊 Analytics

### Metrics to Track
- Purchase conversion rate
- Popular package selections
- Revenue per user
- Failed payment attempts
- User retention after purchase

### Logging
All purchase events are logged with:
- User ID and Telegram ID
- Package selected
- Payment amount
- Transaction ID
- Timestamp

## 🔮 Future Enhancements

### Potential Features
1. **Subscription Plans** - Monthly/yearly unlimited messages
2. **Bulk Discounts** - Larger packages with better rates
3. **Gift Messages** - Send messages to other users
4. **Referral Bonuses** - Bonus messages for referrals
5. **Seasonal Promotions** - Special pricing events

### Technical Improvements
1. **Payment Analytics Dashboard** - Admin panel for payment tracking
2. **Automated Refunds** - Handle failed deliveries
3. **Multi-Currency Support** - Support other payment methods
4. **Usage Analytics** - Track message consumption patterns

## 📝 Changelog

### v1.0.0 - Initial Release
- ✅ Basic Telegram Stars integration
- ✅ Four package tiers
- ✅ Telegram bot commands (/buy, /balance)
- ✅ Payment webhook handling
- ✅ Profile modal integration
- ✅ Database integration
- ✅ Error handling and logging
- ✅ Comprehensive documentation

---

## 🎯 Quick Start

1. **For Users**: Send `/buy` in Telegram to purchase messages
2. **For Developers**: Check the API endpoints and webhook setup
3. **For Testing**: Use `/balance` and `/buy` commands in development

The Telegram Stars Purchase System is now fully operational and ready for production use! 🌟 