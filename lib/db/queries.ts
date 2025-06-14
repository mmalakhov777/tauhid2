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
  like,
  isNull,
  sql,
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
  subscriptionResponse,
  type SubscriptionResponse,
  messageDeprecated,
  telegramBindingCode,
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
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  onnotice: () => {}, // Suppress notices
  onparameter: () => {}, // Suppress parameter status messages
  connection: {
    application_name: 'tauhid2-chat'
  },
  // Add retry logic for connection errors
  fetch_types: false, // Disable type fetching to reduce connection overhead
  prepare: false, // Disable prepared statements to reduce connection state
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
      postgresUrl: process.env.POSTGRES_URL ? 'Set (hidden)' : 'Not set'
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

// New function to find or create a reusable guest user
export async function findOrCreateGuestUser() {
  try {
    // First, try to find an existing guest user with no messages (unused)
    const unusedGuestUsers = await db
      .select({
        id: user.id,
        email: user.email,
      })
      .from(user)
      .leftJoin(chat, eq(chat.userId, user.id))
      .where(
        and(
          like(user.email, 'guest-%'),
          isNull(chat.id) // No chats associated with this user
        )
      )
      .limit(1);

    if (unusedGuestUsers.length > 0) {
      // Silently reuse existing unused guest user
      return unusedGuestUsers;
    }

    // If no unused guest user found, create a new one
    return await createGuestUser();
  } catch (error) {
    console.error('[findOrCreateGuestUser] Error:', error);
    // Fallback to creating a new guest user
    return await createGuestUser();
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

      const insertValues = {
        id,
        createdAt: new Date(),
        userId,
        title,
        visibility,
      };
      console.log('[saveChat] About to insert with values:', insertValues);
      
      const result = await db.insert(chat).values(insertValues);
      console.log('[saveChat] Chat inserted successfully:', result);
      
      // Immediately verify what was inserted
      const verifyChat = await getChatById({ id });
      console.log('[saveChat] Verification - what was actually inserted:', {
        id: verifyChat?.id,
        visibility: verifyChat?.visibility,
        title: verifyChat?.title,
        userId: verifyChat?.userId
      });
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

// Subscription Response Functions
export async function createSubscriptionResponse({
  userId,
  purpose,
  name,
  email,
  organization,
  currentStep = 'limit',
}: {
  userId: string;
  purpose?: string;
  name?: string;
  email?: string;
  organization?: string;
  currentStep?: 'limit' | 'purpose' | 'info' | 'beta';
}) {
  try {
    const [response] = await db
      .insert(subscriptionResponse)
      .values({
        userId,
        purpose,
        name,
        email,
        organization,
        currentStep,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return response;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create subscription response',
    );
  }
}

export async function updateSubscriptionResponse({
  id,
  purpose,
  name,
  email,
  organization,
  currentStep,
  isCompleted,
  isSubmitted,
}: {
  id: string;
  purpose?: string;
  name?: string;
  email?: string;
  organization?: string;
  currentStep?: 'limit' | 'purpose' | 'info' | 'beta';
  isCompleted?: boolean;
  isSubmitted?: boolean;
}) {
  try {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (purpose !== undefined) updateData.purpose = purpose;
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (organization !== undefined) updateData.organization = organization;
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
    if (isSubmitted !== undefined) {
      updateData.isSubmitted = isSubmitted;
      if (isSubmitted) {
        updateData.submittedAt = new Date();
      }
    }

    const [response] = await db
      .update(subscriptionResponse)
      .set(updateData)
      .where(eq(subscriptionResponse.id, id))
      .returning();
    return response;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update subscription response',
    );
  }
}

export async function getSubscriptionResponseByUserId({
  userId,
}: {
  userId: string;
}) {
  try {
    const [response] = await db
      .select()
      .from(subscriptionResponse)
      .where(eq(subscriptionResponse.userId, userId))
      .orderBy(desc(subscriptionResponse.createdAt))
      .limit(1);
    return response;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get subscription response by user id',
    );
  }
}

export async function getSubscriptionResponseById({
  id,
}: {
  id: string;
}) {
  try {
    const [response] = await db
      .select()
      .from(subscriptionResponse)
      .where(eq(subscriptionResponse.id, id));
    return response;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get subscription response by id',
    );
  }
}

export async function getAllSubscriptionResponses({
  limit = 50,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  try {
    return await db
      .select()
      .from(subscriptionResponse)
      .orderBy(desc(subscriptionResponse.createdAt))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get all subscription responses',
    );
  }
}

export async function deleteSubscriptionResponse({
  id,
}: {
  id: string;
}) {
  try {
    return await db
      .delete(subscriptionResponse)
      .where(eq(subscriptionResponse.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete subscription response',
    );
  }
}

// Telegram Binding Code functions
export async function createTelegramBindingCode(userId: string, email: string) {
  // Generate 8-digit code
  const bindingCode = Math.floor(10000000 + Math.random() * 90000000).toString();
  
  // Set expiration to 15 minutes from now
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  try {
    // First, invalidate any existing active codes for this user
    await db
      .update(telegramBindingCode)
      .set({ isUsed: true, usedAt: new Date() })
      .where(
        and(
          eq(telegramBindingCode.userId, userId),
          eq(telegramBindingCode.isUsed, false),
          gt(telegramBindingCode.expiresAt, new Date())
        )
      );

    // Create new binding code
    const result = await db
      .insert(telegramBindingCode)
      .values({
        userId,
        email,
        bindingCode,
        expiresAt,
      })
      .returning({
        id: telegramBindingCode.id,
        bindingCode: telegramBindingCode.bindingCode,
        expiresAt: telegramBindingCode.expiresAt,
      });

    return result[0];
  } catch (error) {
    console.error('Error creating Telegram binding code:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to create Telegram binding code');
  }
}

export async function getTelegramBindingCodeByCode(code: string) {
  try {
    const result = await db
      .select()
      .from(telegramBindingCode)
      .where(
        and(
          eq(telegramBindingCode.bindingCode, code),
          eq(telegramBindingCode.isUsed, false),
          gt(telegramBindingCode.expiresAt, new Date())
        )
      )
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('Error getting Telegram binding code:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to get Telegram binding code');
  }
}

export async function useTelegramBindingCode(
  code: string,
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
  try {
    // Get the binding code record
    const bindingRecord = await getTelegramBindingCodeByCode(code);
    if (!bindingRecord) {
      throw new ChatSDKError('bad_request:auth', 'Invalid or expired binding code');
    }

    // Check if this Telegram ID is already in use by another user
    const existingUsers = await getUserByTelegramId(telegramData.telegramId);
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      
      // Check if it's the same user trying to rebind
      if (existingUser.id !== bindingRecord.userId) {
        // Special case: Check if the existing user has a dummy email (telegram_*@telegram.local)
        const isDummyEmail = existingUser.email.startsWith('telegram_') && existingUser.email.endsWith('@telegram.local');
        
        if (isDummyEmail) {
          console.log(`[useTelegramBindingCode] Re-binding dummy email account ${existingUser.email} to real email ${bindingRecord.email}`);
          
          // This is a re-binding scenario - we need to transfer all data from dummy account to real account
          await db.transaction(async (tx) => {
            // 1. Transfer all chats from dummy user to real user (this automatically transfers messages and votes)
            await tx
              .update(chat)
              .set({ userId: bindingRecord.userId })
              .where(eq(chat.userId, existingUser.id));

            // 2. Transfer all documents from dummy user to real user
            await tx
              .update(document)
              .set({ userId: bindingRecord.userId })
              .where(eq(document.userId, existingUser.id));

            // 3. Transfer all suggestions from dummy user to real user
            await tx
              .update(suggestion)
              .set({ userId: bindingRecord.userId })
              .where(eq(suggestion.userId, existingUser.id));

            // 4. Delete the dummy user account first (this frees up the telegramId constraint)
            await tx
              .delete(user)
              .where(eq(user.id, existingUser.id));

            // 5. Now update the real user with Telegram data (no constraint violation)
            await tx
              .update(user)
              .set({
                telegramId: telegramData.telegramId,
                telegramUsername: telegramData.telegramUsername,
                telegramFirstName: telegramData.telegramFirstName,
                telegramLastName: telegramData.telegramLastName,
                telegramPhotoUrl: telegramData.telegramPhotoUrl,
                telegramLanguageCode: telegramData.telegramLanguageCode,
                telegramIsPremium: telegramData.telegramIsPremium || false,
                telegramAllowsWriteToPm: telegramData.telegramAllowsWriteToPm || false,
              })
              .where(eq(user.id, bindingRecord.userId));

            // 6. Mark the binding code as used
            await tx
              .update(telegramBindingCode)
              .set({
                isUsed: true,
                usedAt: new Date(),
                telegramId: telegramData.telegramId,
                telegramUsername: telegramData.telegramUsername,
                telegramFirstName: telegramData.telegramFirstName,
                telegramLastName: telegramData.telegramLastName,
                telegramPhotoUrl: telegramData.telegramPhotoUrl,
                telegramLanguageCode: telegramData.telegramLanguageCode,
                telegramIsPremium: telegramData.telegramIsPremium || false,
                telegramAllowsWriteToPm: telegramData.telegramAllowsWriteToPm || false,
              })
              .where(eq(telegramBindingCode.id, bindingRecord.id));
          });

          console.log(`[useTelegramBindingCode] Successfully transferred data from dummy account ${existingUser.id} to real account ${bindingRecord.userId}`);

          return {
            success: true,
            userId: bindingRecord.userId,
            email: bindingRecord.email,
            transferred: true, // Flag to indicate data was transferred
            oldUserId: existingUser.id,
          };
        } else {
          // Regular case: Telegram account is already linked to a real email account
          throw new ChatSDKError('bad_request:auth', 'This Telegram account is already linked to another user');
        }
      }
      // If it's the same user, we can proceed (they're re-binding)
    }

    // Standard binding case: Update the user with Telegram data
    await db
      .update(user)
      .set({
        telegramId: telegramData.telegramId,
        telegramUsername: telegramData.telegramUsername,
        telegramFirstName: telegramData.telegramFirstName,
        telegramLastName: telegramData.telegramLastName,
        telegramPhotoUrl: telegramData.telegramPhotoUrl,
        telegramLanguageCode: telegramData.telegramLanguageCode,
        telegramIsPremium: telegramData.telegramIsPremium || false,
        telegramAllowsWriteToPm: telegramData.telegramAllowsWriteToPm || false,
      })
      .where(eq(user.id, bindingRecord.userId));

    // Mark the binding code as used
    await db
      .update(telegramBindingCode)
      .set({
        isUsed: true,
        usedAt: new Date(),
        telegramId: telegramData.telegramId,
        telegramUsername: telegramData.telegramUsername,
        telegramFirstName: telegramData.telegramFirstName,
        telegramLastName: telegramData.telegramLastName,
        telegramPhotoUrl: telegramData.telegramPhotoUrl,
        telegramLanguageCode: telegramData.telegramLanguageCode,
        telegramIsPremium: telegramData.telegramIsPremium || false,
        telegramAllowsWriteToPm: telegramData.telegramAllowsWriteToPm || false,
      })
      .where(eq(telegramBindingCode.id, bindingRecord.id));

    return {
      success: true,
      userId: bindingRecord.userId,
      email: bindingRecord.email,
    };
  } catch (error) {
    console.error('Error using Telegram binding code:', error);
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError('bad_request:database', 'Failed to bind Telegram account');
  }
}

export async function getActiveTelegramBindingCodeByUserId(userId: string) {
  try {
    const result = await db
      .select()
      .from(telegramBindingCode)
      .where(
        and(
          eq(telegramBindingCode.userId, userId),
          eq(telegramBindingCode.isUsed, false),
          gt(telegramBindingCode.expiresAt, new Date())
        )
      )
      .orderBy(desc(telegramBindingCode.createdAt))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('Error getting active Telegram binding code:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to get active Telegram binding code');
  }
}

// Cleanup expired binding codes (can be called periodically)
export async function cleanupExpiredTelegramBindingCodes() {
  try {
    const result = await db
      .delete(telegramBindingCode)
      .where(lt(telegramBindingCode.expiresAt, new Date()));

    return result;
  } catch (error) {
    console.error('Error cleaning up expired Telegram binding codes:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to cleanup expired binding codes');
  }
}
