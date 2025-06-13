# External Chat API

This is a secure API endpoint that replicates all the functionality of the main chat route but with hardcoded API key authentication.

## API Key

**IMPORTANT**: Change the hardcoded API key in `route.ts`:

```typescript
const HARDCODED_API_KEY = 'your-super-secret-api-key-change-this-12345';
```

## Endpoints

### POST /api/external-chat
Send a chat message and get AI response with vector search.

**Headers:**
```
Authorization: Bearer your-super-secret-api-key-change-this-12345
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000", // UUID for chat session
  "message": {
    "id": "msg-123",
    "role": "user",
    "content": "What is the importance of prayer in Islam?",
    "parts": [
      {
        "type": "text",
        "text": "What is the importance of prayer in Islam?"
      }
    ]
  },
  "selectedChatModel": "chat-model-standard", // or "chat-model-reasoning"
  "selectedVisibilityType": "private", // or "public"
  "selectedLanguage": "en", // en, tr, ar, ru, de, fr, es
  "selectedSources": {
    "classic": true,
    "modern": true,
    "risale": true,
    "youtube": true,
    "fatwa": true
  }
}
```

**Response:** Streaming response with AI-generated content

### GET /api/external-chat?chatId={id}
Resume a chat stream or get chat messages.

**Headers:**
```
Authorization: Bearer your-super-secret-api-key-change-this-12345
```

### DELETE /api/external-chat?id={chatId}
Delete a chat session.

**Headers:**
```
Authorization: Bearer your-super-secret-api-key-change-this-12345
```

## Features

- ✅ All database operations preserved
- ✅ Vector search functionality
- ✅ Multi-language support
- ✅ Source filtering
- ✅ Streaming responses
- ✅ Chat history
- ✅ Premium access (no rate limiting)

## Example Usage

```javascript
// Example: Send a chat message
const response = await fetch('https://your-domain.vercel.app/api/external-chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-super-secret-api-key-change-this-12345',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: '550e8400-e29b-41d4-a716-446655440000',
    message: {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: 'What is the importance of prayer?',
      parts: [{
        type: 'text',
        text: 'What is the importance of prayer?'
      }]
    },
    selectedChatModel: 'chat-model-standard',
    selectedVisibilityType: 'private',
    selectedLanguage: 'en',
    selectedSources: {
      classic: true,
      modern: true,
      risale: true,
      youtube: true,
      fatwa: true
    }
  })
});

// Handle streaming response
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log('Received:', chunk);
}
```

## Security Notes

1. **Change the API key immediately** - The default key is not secure
2. The API user has premium access (no rate limiting)
3. The API user can access all chats (you may want to restrict this)
4. All chat data is saved under user ID: `external-api-user`

## Deployment

This endpoint will work immediately after deployment to Vercel. No additional configuration needed - all database connections and AI providers are already configured. 