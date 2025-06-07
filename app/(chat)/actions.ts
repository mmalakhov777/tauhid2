'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import { auth } from '@/app/(auth)/auth';
import { generateUUID } from '@/lib/utils';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  try {
    const { text: title } = await generateText({
      model: myProvider.languageModel('title-model'),
      system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
      prompt: JSON.stringify(message),
    });

    return title;
  } catch (error) {
    console.log('[generateTitleFromUserMessage] Primary model failed, using fallback:', error);
    
    try {
      // Use OpenRouter fallback model
      const { text: title } = await generateText({
        model: myProvider.languageModel('title-model-fallback'),
        system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
        prompt: JSON.stringify(message),
      });

      return title;
    } catch (fallbackError) {
      console.error('[generateTitleFromUserMessage] Fallback model also failed:', fallbackError);
      // Return a generic title if both models fail
      return 'New Conversation';
    }
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function copyChatForUser(originalChatId: string) {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  try {
    // Get the original chat
    const originalChat = await getChatById({ id: originalChatId });
    if (!originalChat) {
      throw new Error('Chat not found');
    }

    // Get all messages from the original chat
    const originalMessages = await getMessagesByChatId({ id: originalChatId });

    // Create a new chat for the current user
    const newChatId = generateUUID();
    
    await saveChat({
      id: newChatId,
      userId,
      title: originalChat.title || 'Copied conversation',
      visibility: 'private' as VisibilityType,
    });

    // Copy all messages to the new chat
    if (originalMessages.length > 0) {
      const newMessages = originalMessages.map((msg) => ({
        id: generateUUID(),
        chatId: newChatId,
        role: msg.role,
        parts: msg.parts,
        attachments: msg.attachments,
        createdAt: new Date(),
      }));

      await saveMessages({ messages: newMessages });
    }

    return { success: true, newChatId };
  } catch (error) {
    console.error('Failed to copy chat:', error);
    return { success: false, error: 'Failed to copy chat' };
  }
}
