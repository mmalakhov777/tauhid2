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
- ✅ **AI-Powered Islamic Q&A responses** using your external chat API
- ✅ **Vector search** across authentic Islamic sources
- ✅ **Multi-language support** (7 languages)
- ✅ **Special commands**: `/start` and `/help`
- ✅ **Typing indicators** and processing messages
- ✅ **Response formatting** optimized for Telegram
- ✅ Logs all activity for debugging
- ✅ Handles errors gracefully

## Next Steps

1. **Deploy to Vercel** - Your app is ready to deploy
2. **Set webhook URL** - Use the setup script with your Vercel URL
3. **Test with real Telegram** - Message your bot to see it work
4. **Enhance with AI** - Connect to your external chat API

## Bot Response Examples

### Welcome Command (`/start`):
```
🕌 Assalamu Alaikum, Max!

Welcome to the Islamic Q&A Bot! I'm here to help answer your questions about Islam using authentic sources.

What I can help with:
📚 Quranic verses and interpretations
🕌 Islamic teachings and practices  
📖 Hadith and scholarly opinions
🤲 Prayer, worship, and daily Islamic life
📜 Risale-i Nur teachings

How to use:
Simply ask me any Islamic question in plain language. I'll search through authentic Islamic sources and provide you with a comprehensive answer.

Example questions:
• "What does Islam say about prayer?"
• "Can you explain the concept of Tawhid?"
• "What are the pillars of Islam?"

Feel free to ask me anything! 🤲
```

### Islamic Question Response:
When you ask "What are the five pillars of Islam?", the bot:
1. Shows typing indicator
2. Displays: "🔍 Searching Islamic sources for your question..."
3. Calls the external chat API with vector search
4. Returns a comprehensive answer with authentic sources
5. Formats the response for easy reading on Telegram

### AI Features:
- **Vector Search**: Searches across Classic texts, Risale-i Nur, YouTube content, and Fatwa databases
- **Source Citations**: References authentic Islamic sources
- **Multi-language**: Supports 7 languages (English, Turkish, Arabic, Russian, German, French, Spanish)
- **Context Awareness**: Maintains conversation history
- **Error Handling**: Graceful fallbacks if API issues occur

## Troubleshooting

- **Webhook not receiving messages**: Check that webhook URL is set correctly
- **Bot not responding**: Check logs in Vercel dashboard or local console
- **Test mode not working**: Ensure `NODE_ENV=development` for local testing 