import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { memo, useState, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  vectorSearchProgress?: any;
  vectorSearchData?: any;
  dbOperationsComplete: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  vectorSearchProgress,
  vectorSearchData,
  dbOperationsComplete,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  const [messageVectorData, setMessageVectorData] = useState<Record<string, any>>({});

  // Load vector search data for existing messages - ONLY when not streaming AND DB operations are complete
  useEffect(() => {
    // Don't fetch data during streaming or while DB operations are still in progress
    if (status === 'streaming' || status === 'submitted' || !dbOperationsComplete) {
      return;
    }

    const loadVectorData = async () => {
      for (const message of messages) {
        if (message.role === 'assistant' && !messageVectorData[message.id]) {
          try {
            const response = await fetch(`/api/vector-search/${message.id}`);
            if (response.ok) {
              const result = await response.json();
              // Only set data if result is not null and has the expected structure
              if (result && (result.improvedQueries || result.citations)) {
                setMessageVectorData(prev => ({
                  ...prev,
                  [message.id]: {
                    improvedQueries: result.improvedQueries || [],
                    citations: result.citations || [],
                    searchResults: result.searchResultCounts || {},
                  }
                }));
              }
            } else {
              console.log('Failed to fetch vector data for message:', message.id, response.status);
            }
          } catch (error) {
            console.error('Failed to load vector data for message:', message.id, error);
          }
        }
      }
    };

    loadVectorData();
  }, [messages, messageVectorData, status, dbOperationsComplete]); // Added dbOperationsComplete as dependency

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative"
    >
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' && messages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          requiresScrollPadding={
            hasSentMessage && index === messages.length - 1
          }
          vectorSearchData={
            message.role === 'assistant' 
              ? (messageVectorData[message.id] || (index === messages.length - 1 ? vectorSearchData : null))
              : null
          }
          isFirstAssistantMessagePart={message.role === 'assistant' && index === messages.length - 1}
        />
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage vectorSearchProgress={vectorSearchProgress} />}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (!equal(prevProps.vectorSearchProgress, nextProps.vectorSearchProgress)) return false;
  if (!equal(prevProps.vectorSearchData, nextProps.vectorSearchData)) return false;
  if (prevProps.dbOperationsComplete !== nextProps.dbOperationsComplete) return false;

  return true;
});
