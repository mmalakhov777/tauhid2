# Telegram Bot Setup

This is a simple Telegram echo bot that will later be enhanced to call your external chat API.

## Bot Token
- **Bot Token**: `7649122639:AAG50HM5qrVYh2hZ4NJj1S6PiLnBcsHEUeA`
- **Bot Username**: You can find this by messaging @BotFather

## Files Created

1. **`/app/api/telegram/webhook/route.ts`** - Main webhook endpoint
2. **`/scripts/setup-telegram-webhook.js`** - Script to configure webhook URL
3. **`/middleware.ts`** - Updated to allow public access to `/api/telegram`

## How It Works

### Local Development (Test Mode)
- When `NODE_ENV === 'development'`, the bot runs in test mode
- Messages are logged to console instead of sent to Telegram
- Perfect for testing without spamming real users

### Production Mode
- When deployed, the bot will actually send messages to Telegram
- Requires webhook URL to be set up

## Testing Locally

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test the webhook endpoint:**
   ```bash
   curl -X GET http://localhost:3000/api/telegram/webhook
   ```

3. **Test with a sample message:**
   ```bash
   curl -X POST http://localhost:3000/api/telegram/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "update_id": 123456789,
       "message": {
         "message_id": 1,
         "from": {
           "id": 123456789,
           "is_bot": false,
           "first_name": "Max",
           "username": "max_test"
         },
         "chat": {
           "id": 123456789,
           "first_name": "Max",
           "username": "max_test",
           "type": "private"
         },
         "date": 1623456789,
         "text": "Hello bot!"
       }
     }'
   ```

## Setting Up Webhook (For Production)

1. **Deploy your app to Vercel** (or your preferred platform)

2. **Set the webhook URL:**
   ```bash
   WEBHOOK_URL=https://your-app.vercel.app/api/telegram/webhook node scripts/setup-telegram-webhook.js set
   ```

3. **Check webhook status:**
   ```bash
   node scripts/setup-telegram-webhook.js info
   ```

4. **Delete webhook (if needed):**
   ```bash
   node scripts/setup-telegram-webhook.js delete
   ```

## Current Bot Behavior

The bot currently:
- ✅ Receives messages from Telegram
- ✅ Extracts user info (name, chat ID, message text)
- ✅ Sends back an echo response with greeting
- ✅ Logs all activity for debugging
- ✅ Handles errors gracefully

## Next Steps

1. **Deploy to Vercel** - Your app is ready to deploy
2. **Set webhook URL** - Use the setup script with your Vercel URL
3. **Test with real Telegram** - Message your bot to see it work
4. **Enhance with AI** - Connect to your external chat API

## Bot Response Example

When you send "Hello!" to the bot, it responds:
```
Hello Max! 👋

You said: "Hello!"

This is a simple echo bot. Soon I'll be able to answer your Islamic questions! 🕌
```

## Troubleshooting

- **Webhook not receiving messages**: Check that webhook URL is set correctly
- **Bot not responding**: Check logs in Vercel dashboard or local console
- **Test mode not working**: Ensure `NODE_ENV=development` for local testing 