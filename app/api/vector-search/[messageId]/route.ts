import { getVectorSearchResultByMessageId, getMessageById } from '@/lib/db/queries';

export async function GET(
  request: Request,
  context: { params: Promise<{ messageId: string }> }
) {
  try {
    const params = await context.params;
    const { messageId } = params;

    if (!messageId) {
      return Response.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // First check if the message exists
    const messages = await getMessageById({ id: messageId });
    if (!messages || messages.length === 0) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get vector search result
    const vectorSearchResult = await getVectorSearchResultByMessageId({
      messageId,
    });

    if (!vectorSearchResult) {
      // Return empty response for messages without vector search data
      return Response.json(null, { status: 200 });
    }

    return Response.json(vectorSearchResult, { status: 200 });
  } catch (error) {
    console.error('Error fetching vector search result:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
} 