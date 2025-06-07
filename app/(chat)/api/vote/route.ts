import { auth } from '@/app/(auth)/auth';
import { getChatById, getVotesByChatId, voteMessage } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  console.log('[vote GET] Request received:', {
    chatId,
    url: request.url,
    searchParams: Object.fromEntries(searchParams.entries())
  });

  if (!chatId) {
    console.log('[vote GET] Missing chatId parameter');
    return new ChatSDKError(
      'bad_request:api',
      'Parameter chatId is required.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    console.log('[vote GET] No authenticated user');
    return new ChatSDKError('unauthorized:vote').toResponse();
  }

  console.log('[vote GET] Fetching chat:', { chatId, userId: session.user.id });

  let chat;
  try {
    chat = await getChatById({ id: chatId });
    console.log('[vote GET] Chat fetched:', { 
      chatFound: !!chat, 
      chatUserId: chat?.userId,
      sessionUserId: session.user.id 
    });
  } catch (error) {
    console.error('[vote GET] Error fetching chat:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      chatId
    });
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    console.log('[vote GET] Chat not found:', { chatId });
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.userId !== session.user.id) {
    console.log('[vote GET] User does not own chat:', {
      chatUserId: chat.userId,
      sessionUserId: session.user.id
    });
    return new ChatSDKError('forbidden:vote').toResponse();
  }

  try {
    const votes = await getVotesByChatId({ id: chatId });
    console.log('[vote GET] Votes fetched successfully:', {
      chatId,
      votesCount: votes.length
    });
    return Response.json(votes, { status: 200 });
  } catch (error) {
    console.error('[vote GET] Error fetching votes:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      chatId
    });
    throw error;
  }
}

export async function PATCH(request: Request) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: 'up' | 'down' } =
    await request.json();

  if (!chatId || !messageId || !type) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameters chatId, messageId, and type are required.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:vote').toResponse();
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new ChatSDKError('not_found:vote').toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:vote').toResponse();
  }

  await voteMessage({
    chatId,
    messageId,
    type: type,
  });

  return new Response('Message voted', { status: 200 });
}
