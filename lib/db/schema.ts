import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  telegramId: integer('telegramId').unique(),
  telegramUsername: varchar('telegramUsername', { length: 32 }),
  telegramFirstName: varchar('telegramFirstName', { length: 64 }),
  telegramLastName: varchar('telegramLastName', { length: 64 }),
  telegramPhotoUrl: text('telegramPhotoUrl'),
  telegramLanguageCode: varchar('telegramLanguageCode', { length: 10 }),
  telegramIsPremium: boolean('telegramIsPremium').default(false),
  telegramAllowsWriteToPm: boolean('telegramAllowsWriteToPm').default(false),
  // Trial balance system
  trialMessagesRemaining: integer('trialMessagesRemaining').default(0),
  trialLastResetAt: timestamp('trialLastResetAt').defaultNow(),
  // Paid message balance system  
  paidMessagesRemaining: integer('paidMessagesRemaining').default(0),
  totalMessagesPurchased: integer('totalMessagesPurchased').default(0),
  lastPurchaseAt: timestamp('lastPurchaseAt'),
});

export type User = InferSelectModel<typeof user>;

// Telegram Binding Code table for email users who want to connect Telegram
export const telegramBindingCode = pgTable('TelegramBindingCode', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  bindingCode: varchar('bindingCode', { length: 8 }).notNull().unique(),
  isUsed: boolean('isUsed').notNull().default(false),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  usedAt: timestamp('usedAt'),
  telegramId: integer('telegramId'),
  telegramUsername: varchar('telegramUsername', { length: 32 }),
  telegramFirstName: varchar('telegramFirstName', { length: 64 }),
  telegramLastName: varchar('telegramLastName', { length: 64 }),
  telegramPhotoUrl: text('telegramPhotoUrl'),
  telegramLanguageCode: varchar('telegramLanguageCode', { length: 10 }),
  telegramIsPremium: boolean('telegramIsPremium').default(false),
  telegramAllowsWriteToPm: boolean('telegramAllowsWriteToPm').default(false),
}, (table) => ({
  userIdIdx: index('idx_telegram_binding_code_user_id').on(table.userId),
  bindingCodeIdx: index('idx_telegram_binding_code_binding_code').on(table.bindingCode),
  expiresAtIdx: index('idx_telegram_binding_code_expires_at').on(table.expiresAt),
  isUsedIdx: index('idx_telegram_binding_code_is_used').on(table.isUsed),
}));

export type TelegramBindingCode = InferSelectModel<typeof telegramBindingCode>;

// Star Payment table for tracking Telegram Stars purchases
export const starPayment = pgTable('StarPayment', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  telegramPaymentChargeId: varchar('telegramPaymentChargeId', { length: 255 }).notNull().unique(),
  starAmount: integer('starAmount').notNull(),
  messagesAdded: integer('messagesAdded').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('completed'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_star_payment_user_id').on(table.userId),
  statusIdx: index('idx_star_payment_status').on(table.status),
  createdAtIdx: index('idx_star_payment_created_at').on(table.createdAt),
}));

export type StarPayment = InferSelectModel<typeof starPayment>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

export const vectorSearchResult = pgTable(
  'VectorSearchResult',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    improvedQueries: json('improvedQueries').notNull(),
    searchTimestamp: timestamp('searchTimestamp').notNull().defaultNow(),
    citations: json('citations').notNull(),
    citationCount: integer('citationCount').notNull().default(0),
    searchResultCounts: json('searchResultCounts').notNull(),
    searchDurationMs: integer('searchDurationMs'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    messageIdIdx: index('idx_vector_search_message_id').on(table.messageId),
    chatIdIdx: index('idx_vector_search_chat_id').on(table.chatId),
  }),
);

export type VectorSearchResult = InferSelectModel<typeof vectorSearchResult>;

export const subscriptionResponse = pgTable('SubscriptionResponse', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  purpose: text('purpose'),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  organization: varchar('organization', { length: 255 }),
  currentStep: varchar('currentStep', { 
    enum: ['limit', 'purpose', 'info', 'beta'] 
  }).notNull().default('limit'),
  isCompleted: boolean('isCompleted').notNull().default(false),
  isSubmitted: boolean('isSubmitted').notNull().default(false),
  submittedAt: timestamp('submittedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_subscription_response_user_id').on(table.userId),
  createdAtIdx: index('idx_subscription_response_created_at').on(table.createdAt),
}));

export type SubscriptionResponse = InferSelectModel<typeof subscriptionResponse>;
