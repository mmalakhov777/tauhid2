# Vector Search Setup

This document explains how to set up the vector search functionality in the chat application.

## Required Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Enable Vector Search (server-side)
ENABLE_VECTOR_SEARCH=true

# Enable Vector Search UI (client-side)
NEXT_PUBLIC_ENABLE_VECTOR_SEARCH=true

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key

# Optional: Override default index names
PINECONE_CLASSIC_INDEX=cls-books
PINECONE_MODERN_INDEX=islamqadtaset
PINECONE_RISALE_INDEX=risale
PINECONE_YOUTUBE_INDEX=yt-db

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=your_openai_api_key
```

## How It Works

The vector search functionality works in two steps:

1. **First Request (Vector Search)**: When a user sends a message, the system:
   - Improves the user query to generate 1-3 diverse search queries
   - Performs vector search across multiple Pinecone indices
   - Returns citations and a unique messageId

2. **Second Request (Streaming Response)**: The system:
   - Uses the messageId to retrieve the stored context
   - Appends the context to the system prompt
   - Streams the response with proper citations

## Usage

### Option 1: Automatic Vector Search (Recommended)

When `ENABLE_VECTOR_SEARCH=true` is set, the chat will automatically perform vector search for all messages.

### Option 2: Manual API Usage

To manually enable vector search for a chat request, add these query parameters:

- `?vector=1` - Enable vector search (returns citations)
- `?stream=1&messageId={id}` - Stream response with vector context

Example API calls:

```javascript
// Step 1: Get citations
const searchResponse = await fetch('/api/chat?vector=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: chatId,
    message: userMessage,
    selectedChatModel: 'chat-model',
    selectedVisibilityType: 'private'
  })
});

const { messageId, citations } = await searchResponse.json();

// Step 2: Stream response with context
const streamResponse = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: chatId,
    message: userMessage,
    selectedChatModel: 'chat-model',
    selectedVisibilityType: 'private',
    messageId: messageId // Include messageId from step 1
  })
});
```

## Index Structure

The system searches across four different index types:

1. **Classic Sources** (`cls-books`): Primary authoritative texts
2. **Modern Sources** (`islamqadtaset`): Contemporary resources
3. **Risale-i Nur** (`risale`): Works with multiple namespaces
4. **YouTube Content** (`yt-db`): Educational video transcripts

## Citation Format

The system enforces citations in responses using the format `[CITn]` where n is the citation number. Sources are prioritized as:

1. `[CLS]` - Classical sources (highest priority)
2. `[RIS]` - Risale-i Nur works
3. `[MOD]` - Modern sources
4. `[YT]` - YouTube content (lowest priority)

## Troubleshooting

### Common Issues

1. **Missing API Keys**: Ensure both `PINECONE_API_KEY` and `OPENAI_API_KEY` are set
2. **Index Not Found**: Verify that the Pinecone indices exist and are accessible
3. **Embedding Errors**: Check OpenAI API key permissions and quota

### Debug Mode

To enable debug logging for vector search, you can check the server logs which will show:
- Query improvement results
- Vector search results from each index
- Context building process 