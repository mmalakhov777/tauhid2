# External Chat API Documentation

This document describes the external chat API endpoint that allows external applications to interact with the chat system using API key authentication.

## Overview

The External Chat API provides a simple way to integrate chat functionality into external applications without requiring NextAuth authentication. It supports:

- **API Key Authentication**: Simple Bearer token authentication
- **Custom User IDs**: Save messages for specific users
- **Vector Search**: Full access to all knowledge sources
- **Streaming Responses**: Real-time response streaming
- **Multi-language Support**: 7 supported languages
- **Source Filtering**: Choose which knowledge sources to search

## Endpoint

```
POST /api/external-chat
```

## Authentication

Include the API key in the Authorization header:

```
Authorization: Bearer your-super-secret-api-key-change-this-12345
```

**⚠️ SECURITY NOTE**: Change the hardcoded API key in `route.ts` before deploying to production!

## Request Format

### Headers
```
Authorization: Bearer <your-api-key>
Content-Type: application/json
```

### Request Body

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "message": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "role": "user",
    "content": "What is the meaning of life?",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "parts": [
      {
        "type": "text",
        "text": "What is the meaning of life?"
      }
    ]
  },
  "selectedChatModel": "chat-model",
  "selectedVisibilityType": "private",
  "selectedLanguage": "en",
  "selectedSources": {
    "classic": true,
    "modern": true,
    "risale": true,
    "youtube": true,
    "fatwa": true
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Chat session ID. Use the same ID to continue a conversation |
| `userId` | string (UUID) | No | Custom user ID. If not provided, uses default external user |
| `message.id` | string (UUID) | Yes | Unique message ID |
| `message.role` | string | Yes | Must be "user" |
| `message.content` | string | Yes | The user's message (1-2000 characters) |
| `message.createdAt` | string (ISO date) | Yes | Message timestamp |
| `message.parts` | array | Yes | Array of message parts with type and text |
| `selectedChatModel` | string | Yes | "chat-model" or "chat-model-reasoning" |
| `selectedVisibilityType` | string | Yes | "public" or "private" |
| `selectedLanguage` | string | No | Language code (default: "en") |
| `selectedSources` | object | No | Which knowledge sources to search |

### Supported Languages
- `en` - English (default)
- `tr` - Turkish
- `ar` - Arabic
- `fr` - French
- `de` - German
- `es` - Spanish
- `it` - Italian

### Knowledge Sources
- `classic` - Classical Islamic texts
- `modern` - Modern Islamic literature
- `risale` - Risale-i Nur collection
- `youtube` - YouTube transcripts
- `fatwa` - Fatwa collections

## Response Format

The API returns a streaming response with the following data types:

### Vector Search Progress
```json
{"type":"vector-search-progress","progress":"{\"step\":1}"}
{"type":"vector-search-progress","progress":"{\"step\":2,\"searchResults\":{\"classic\":5,\"risale\":3}}"}
```

### Chat Information
```json
{"type":"vector-search-progress","progress":"{\"type\":\"chat-info\",\"chatId\":\"550e8400-e29b-41d4-a716-446655440006\",\"messageId\":\"a348b4db-7fad-48ed-b204-9c9a5f3bf7a9\"}"}
```

### Message ID
```json
{"messageId":"8f32ab55-b450-4f1e-b2aa-a20abce4ab78"}
```

### Streaming Text
```
0:"Hello "
0:"there! "
0:"How "
0:"can "
0:"I "
0:"help "
0:"you?"
```

### Completion
```json
{"finishReason":"stop","usage":{"promptTokens":268,"completionTokens":45}}
```

## User Management

### Custom User IDs
When you provide a `userId` in the request:
- If the user exists, messages are saved to that user
- If the user doesn't exist, a new user is created automatically
- User gets premium access (no rate limiting)
- Generated email format: `api-user-{userId}@external.local`

### Default External User
If no `userId` is provided:
- Uses system default external user
- Email: `external-api@system.local`
- Also has premium access

## Example Usage

### cURL Example
```bash
curl -X POST http://localhost:3000/api/external-chat \
  -H "Authorization: Bearer your-super-secret-api-key-change-this-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "message": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "role": "user",
      "content": "What is the meaning of life?",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "parts": [
        {
          "type": "text",
          "text": "What is the meaning of life?"
        }
      ]
    },
    "selectedChatModel": "chat-model",
    "selectedVisibilityType": "private",
    "selectedLanguage": "en",
    "selectedSources": {
      "classic": true,
      "modern": true,
      "risale": true,
      "youtube": true,
      "fatwa": true
    }
  }'
```

### JavaScript Example
```javascript
const response = await fetch('/api/external-chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-super-secret-api-key-change-this-12345',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    message: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      role: 'user',
      content: 'What is the meaning of life?',
      createdAt: new Date().toISOString(),
      parts: [
        {
          type: 'text',
          text: 'What is the meaning of life?'
        }
      ]
    },
    selectedChatModel: 'chat-model',
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
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = new TextDecoder().decode(value);
  console.log('Received:', chunk);
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid chat ID format"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

## Conversation Continuity

To continue a conversation:
1. Use the same `id` (chat ID) for all messages in the conversation
2. Use the same `userId` to maintain user context
3. Each message should have a unique `message.id`

## Rate Limiting

External API users have premium access with no rate limiting restrictions.

## Security Considerations

1. **Change the API Key**: The hardcoded API key must be changed before production deployment
2. **HTTPS Only**: Always use HTTPS in production
3. **API Key Storage**: Store API keys securely, never in client-side code
4. **Input Validation**: All inputs are validated against the schema
5. **User Isolation**: Each userId creates an isolated user context

## Deployment Notes

1. **Environment Variables**: Ensure all required environment variables are set
2. **Database**: PostgreSQL database must be accessible
3. **Vector Service**: External vector search service must be running
4. **Middleware**: The `/api/external-chat` route is added to public routes in middleware
5. **API Key**: Update the hardcoded API key in `route.ts` before deployment

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check API key format and value
2. **400 Bad Request**: Validate UUID formats for id, userId, and message.id
3. **Database Errors**: Check PostgreSQL connection and credentials
4. **Vector Search Timeout**: Verify external vector service availability

### Debug Logging

The API includes extensive logging. Check server logs for detailed information about:
- Request validation
- User creation/retrieval
- Database operations
- Vector search progress
- AI model responses

## Support

For issues or questions about the External Chat API, check the server logs for detailed error information and ensure all environment variables are properly configured. 