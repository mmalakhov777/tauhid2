import { useChat } from '@ai-sdk/react';
import { useState, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import type { VisibilityType } from '@/components/visibility-selector';

interface VectorSearchResult {
  messageId: string;
  citations: any[];
  improvedQueries: string[];
}

interface UseVectorChatOptions {
  id: string;
  initialMessages: UIMessage[];
  initialChatModel: string;
  visibilityType: VisibilityType;
  enableVectorSearch?: boolean;
  onFinish?: () => void;
  onError?: (error: Error) => void;
}

export function useVectorChat({
  id,
  initialMessages,
  initialChatModel,
  visibilityType,
  enableVectorSearch = false,
  onFinish,
  onError,
}: UseVectorChatOptions) {
  const [vectorSearchData, setVectorSearchData] = useState<VectorSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const {
    messages,
    setMessages,
    handleSubmit: originalHandleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
    data,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    fetch: fetchWithErrorHandlers,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel: initialChatModel,
      selectedVisibilityType: visibilityType,
      messageId: vectorSearchData?.messageId, // Include messageId if available
    }),
    onFinish,
    onError,
  });

  const performVectorSearch = useCallback(async (userMessage: any) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/chat?vector=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          message: userMessage,
          selectedChatModel: initialChatModel,
          selectedVisibilityType: visibilityType,
        }),
      });

      if (!response.ok) {
        throw new Error('Vector search failed');
      }

      const data: VectorSearchResult = await response.json();
      setVectorSearchData(data);
      return data;
    } catch (error) {
      console.error('Vector search error:', error);
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, [id, initialChatModel, visibilityType]);

  const handleSubmit = useCallback(async (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: any[] }
  ) => {
    if (!enableVectorSearch) {
      return originalHandleSubmit(event, options);
    }

    // Generate message ID
    const messageId = generateUUID();
    const userMessage = {
      id: messageId,
      createdAt: new Date(),
      role: 'user' as const,
      content: input,
      parts: [{ type: 'text' as const, text: input }],
      experimental_attachments: options?.experimental_attachments,
    };

    try {
      // Step 1: Perform vector search
      const searchData = await performVectorSearch(userMessage);
      
      // Step 2: Submit with messageId for streaming
      return originalHandleSubmit(event, options);
    } catch (error) {
      console.error('Error in vector chat submit:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }, [enableVectorSearch, originalHandleSubmit, input, performVectorSearch, onError]);

  return {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
    data,
    vectorSearchData,
    isSearching,
  };
} 