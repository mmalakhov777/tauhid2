# Vercel Authentication Issue

## Problem
When deploying to Vercel, all API routes (including `/api/telegram/webhook` and `/api/external-chat`) are being redirected to Vercel SSO authentication, even though they are configured as public routes in the middleware.

## Symptoms
- API endpoints return HTML authentication page instead of JSON responses
- Telegram webhook fails because it can't authenticate
- External chat API is inaccessible

## Root Cause
This appears to be a Vercel team/organization-level setting that enforces SSO authentication on all routes, overriding the application-level middleware configuration.

## Attempted Solutions

### 1. ✅ Middleware Configuration (Already Done)
```typescript
const publicRoutes = [
  '/api/telegram', // Allow Telegram webhook
  '/api/external-chat', // Allow external chat API
];
```

### 2. ✅ vercel.json Headers (Already Done)
```json
{
  "headers": [
    {
      "source": "/api/telegram/(.*)",
      "headers": [
        {
          "key": "X-Vercel-Skip-Auth",
          "value": "1"
        }
      ]
    }
  ]
}
```

### 3. 🔄 Potential Solutions to Try

#### Option A: Vercel Team Settings
1. Go to Vercel Dashboard → Team Settings → Security
2. Look for "Deployment Protection" or "SSO Settings"
3. Add exceptions for API routes or disable for this project

#### Option B: Environment Variables
Add to Vercel environment variables:
```
VERCEL_FORCE_NO_BUILD_CACHE=1
VERCEL_SKIP_AUTH_ROUTES=/api/telegram,/api/external-chat
```

#### Option C: Different Deployment Method
- Deploy to a different Vercel team/account without SSO enforcement
- Use a different hosting provider (Railway, Render, etc.)

#### Option D: Subdomain Approach
- Deploy API routes to a separate subdomain
- Use `api.yourdomain.com` without authentication

## Current Workaround

**Using ngrok tunnel for development/testing:**
```bash
# Start ngrok tunnel
ngrok http 3000

# Set webhook to tunnel URL
WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/telegram/webhook node scripts/setup-telegram-webhook.js set
```

## Next Steps

1. **Check Vercel Team Settings**: Look for deployment protection settings
2. **Contact Vercel Support**: If this is a team-level enforcement
3. **Alternative Hosting**: Consider other platforms if Vercel restrictions can't be bypassed
4. **Separate API Deployment**: Deploy just the API routes to a different service

## Testing Status

- ✅ Local development with ngrok: **Working**
- ❌ Vercel deployment: **Blocked by authentication**
- ✅ Bot functionality: **Fully implemented and tested**
- ✅ External chat API: **Fully implemented and tested**

The bot and API are fully functional - the only issue is the Vercel deployment authentication layer. 