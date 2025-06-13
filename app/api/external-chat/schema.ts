import { z } from 'zod';

const textPartSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.enum(['text']),
});

const sourceSelectionSchema = z.object({
  classic: z.boolean(),
  modern: z.boolean(),
  risale: z.boolean(),
  youtube: z.boolean(),
  fatwa: z.boolean(),
}).optional();

export const externalChatRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(), // Optional user ID - if not provided, will use default external user
  message: z.object({
    id: z.string().uuid(),
    createdAt: z.coerce.date(),
    role: z.enum(['user']),
    content: z.string().min(1).max(2000),
    parts: z.array(textPartSchema),
    experimental_attachments: z
      .array(
        z.object({
          url: z.string().url(),
          name: z.string().min(1).max(2000),
          contentType: z.enum(['image/png', 'image/jpg', 'image/jpeg']),
        }),
      )
      .optional(),
  }),
  selectedChatModel: z.enum(['chat-model', 'chat-model-reasoning']),
  selectedVisibilityType: z.enum(['public', 'private']),
  selectedLanguage: z.string().optional().default('en'),
  selectedSources: sourceSelectionSchema,
  messageId: z.string().optional(),
});

export type ExternalChatRequest = z.infer<typeof externalChatRequestSchema>; 