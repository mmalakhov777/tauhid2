import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
  vectorSearchResult,
  type VectorSearchResult,
} from './schema';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Configure PostgreSQL client with connection pooling and retry logic
const client = postgres(process.env.POSTGRES_URL!, {
  max: 1, // Reduce max connections for serverless
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 30, // Increase connection timeout for serverless
  onnotice: () => {}, // Suppress notices
  onparameter: () => {}, // Suppress parameter status messages
  connection: {
    application_name: 'tauhid2-chat'
  },
  // Add retry logic for connection errors
  fetch_types: false, // Disable type fetching to reduce connection overhead
  prepare: false, // Disable prepared statements to reduce connection state
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false, // Require SSL in production
  transform: {
    undefined: null, // Transform undefined to null for PostgreSQL
  },
});

const db = drizzle(client);

// Helper function to check if error is a connection error
function isConnectionError(error: any): boolean {
  const connectionErrorCodes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
  return connectionErrorCodes.includes(error?.code) || 
         error?.message?.includes('connection') ||
         error?.message?.includes('ECONNRESET');
}

// Helper function to format database errors
function formatDatabaseError(error: any, operation: string) {
  const errorInfo = {
    operation,
    errorType: error?.constructor?.name || 'Unknown',
    errorMessage: error?.message || 'Unknown error',
    errorCode: error?.code,
    errorDetail: error?.detail,
    errorHint: error?.hint,
    isConnectionError: isConnectionError(error),
    timestamp: new Date().toISOString()
  };

  if (isConnectionError(error)) {
    console.error(`[DB] Connection error during ${operation}:`, errorInfo);
    console.error('[DB] Database connection may be unstable. Check your PostgreSQL server and network.');
  } else {
    console.error(`[DB] Error during ${operation}:`, errorInfo);
  }

  return errorInfo;
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    const result = await db.execute('SELECT 1');
    console.log('[DB] Database connection test successful');
    return true;
  } catch (error) {
    console.error('[DB] Database connection test failed:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorCode: (error as any)?.code,
      errorDetail: (error as any)?.detail,
      errorHint: (error as any)?.hint,
      postgresUrl: process.env.POSTGRES_URL ? 'Set (hidden)' : 'Not set',
      nodeEnv: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production'
    });
    return false;
  }
}

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function getUserByTelegramId(telegramId: number): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.telegramId, telegramId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by Telegram ID',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createUserWithTelegram(
  email: string, 
  telegramData: {
    telegramId: number;
    telegramUsername?: string;
    telegramFirstName: string;
    telegramLastName?: string;
    telegramPhotoUrl?: string;
    telegramLanguageCode?: string;
    telegramIsPremium?: boolean;
    telegramAllowsWriteToPm?: boolean;
  }
) {
  const hashedPassword = generateHashedPassword('telegram_auth');

  try {
    return await db.insert(user).values({ 
      email, 
      password: hashedPassword,
      telegramId: telegramData.telegramId,
      telegramUsername: telegramData.telegramUsername,
      telegramFirstName: telegramData.telegramFirstName,
      telegramLastName: telegramData.telegramLastName,
      telegramPhotoUrl: telegramData.telegramPhotoUrl,
      telegramLanguageCode: telegramData.telegramLanguageCode,
      telegramIsPremium: telegramData.telegramIsPremium || false,
      telegramAllowsWriteToPm: telegramData.telegramAllowsWriteToPm || false,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user with Telegram data');
  }
}

export async function updateUserWithEmailPassword(
  telegramId: number,
  email: string,
  password: string
) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db
      .update(user)
      .set({ 
        email, 
        password: hashedPassword 
      })
      .where(eq(user.telegramId, telegramId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update user with email and password');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  console.log('[saveChat] Attempting to insert chat:', {
    id,
    userId,
    title,
    visibility,
    titleLength: title?.length,
    createdAt: new Date().toISOString()
  });

  // Retry logic for connection errors
  let retries = 3;
  let lastError: any;

  while (retries > 0) {
    try {
      // First check if chat already exists (race condition handling)
      const existingChat = await getChatById({ id });
      if (existingChat) {
        console.log('[saveChat] Chat already exists, skipping insert:', {
          id,
          existingUserId: existingChat.userId,
          requestedUserId: userId
        });
        // If chat exists but belongs to different user, throw error
        if (existingChat.userId !== userId) {
          throw new ChatSDKError('forbidden:chat', 'Chat belongs to another user');
        }
        return existingChat;
      }

      // Validate input data before insert
      if (!id || !userId || !title || !visibility) {
        throw new Error(`Invalid input data: id=${id}, userId=${userId}, title=${title}, visibility=${visibility}`);
      }

      const result = await db.insert(chat).values({
        id,
        createdAt: new Date(),
        userId,
        title,
        visibility,
      });
      console.log('[saveChat] Chat inserted successfully:', result);
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error and we have retries left
      if (isConnectionError(error) && retries > 1) {
        console.log(`[saveChat] Connection error, retrying... (${retries - 1} retries left)`);
        retries--;
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Check if it's a unique constraint violation
      if ((error as any)?.code === '23505' || (error as any)?.message?.includes('duplicate key')) {
        console.log('[saveChat] Duplicate key error, attempting to fetch existing chat');
        try {
          const existingChat = await getChatById({ id });
          if (existingChat && existingChat.userId === userId) {
            console.log('[saveChat] Found existing chat for same user, returning it');
            return existingChat;
          }
        } catch (fetchError) {
          console.error('[saveChat] Failed to fetch existing chat after duplicate key error:', fetchError);
        }
      }

      // Format and log the error
      const errorInfo = formatDatabaseError(error, 'saveChat');
      console.error('[saveChat] Final error details:', {
        ...errorInfo,
        chatData: {
          id,
          userId,
          title,
          visibility,
          createdAt: new Date().toISOString()
        },
        retriesLeft: retries - 1
      });

      // If it's a connection error, throw a more specific error
      if (isConnectionError(error)) {
        throw new ChatSDKError('bad_request:database', 'Database connection lost. Please try again.');
      }

      throw new ChatSDKError('bad_request:database', 'Failed to save chat');
    }
  }

  // If we've exhausted all retries
  if (isConnectionError(lastError)) {
    throw new ChatSDKError('bad_request:database', 'Database connection lost after multiple retries. Please try again later.');
  }
  throw new ChatSDKError('bad_request:database', 'Failed to save chat');
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  console.log('[getChatById] Fetching chat:', { id });
  
  let retries = 3;
  let lastError: any;

  while (retries > 0) {
    try {
      const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
      console.log('[getChatById] Chat query result:', {
        id,
        found: !!selectedChat,
        chatData: selectedChat ? {
          id: selectedChat.id,
          userId: selectedChat.userId,
          title: selectedChat.title,
          visibility: selectedChat.visibility,
          createdAt: selectedChat.createdAt
        } : null
      });
      return selectedChat;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error and we have retries left
      if (isConnectionError(error) && retries > 1) {
        console.log(`[getChatById] Connection error, retrying... (${retries - 1} retries left)`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      const errorInfo = formatDatabaseError(error, 'getChatById');
      console.error('[getChatById] Final error details:', {
        ...errorInfo,
        id,
        retriesLeft: retries - 1
      });

      if (isConnectionError(error)) {
        throw new ChatSDKError('bad_request:database', 'Database connection lost while fetching chat');
      }

      throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
    }
  }

  // If we've exhausted all retries
  if (isConnectionError(lastError)) {
    throw new ChatSDKError('bad_request:database', 'Database connection lost after multiple retries');
  }
  throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

export async function saveVectorSearchResult({
  messageId,
  chatId,
  improvedQueries,
  citations,
  searchResultCounts,
  searchDurationMs,
}: {
  messageId: string;
  chatId: string;
  improvedQueries: string[];
  citations: any[];
  searchResultCounts: {
    classic: number;
    modern: number;
    risale: number;
    youtube: number;
  };
  searchDurationMs?: number;
}) {
  try {
    return await db.insert(vectorSearchResult).values({
      messageId,
      chatId,
      improvedQueries,
      citations,
      citationCount: citations.length,
      searchResultCounts,
      searchDurationMs,
      searchTimestamp: new Date(),
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save vector search result',
    );
  }
}

export async function getVectorSearchResultByMessageId({
  messageId,
}: {
  messageId: string;
}) {
  try {
    const [result] = await db
      .select()
      .from(vectorSearchResult)
      .where(eq(vectorSearchResult.messageId, messageId));
    return result;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get vector search result by message id',
    );
  }
}

export async function getVectorSearchResultsByChatId({
  chatId,
}: {
  chatId: string;
}) {
  try {
    return await db
      .select()
      .from(vectorSearchResult)
      .where(eq(vectorSearchResult.chatId, chatId))
      .orderBy(asc(vectorSearchResult.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get vector search results by chat id',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}
