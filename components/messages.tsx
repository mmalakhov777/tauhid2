import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { memo, useState, useEffect, type RefObject, useRef } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import { useTelegramHaptics } from '@/hooks/use-telegram-haptics';

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
  messagesContainerRef?: RefObject<HTMLDivElement>;
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
  messagesContainerRef,
}: MessagesProps) {
  const {
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  const { impactOccurred, notificationOccurred } = useTelegramHaptics();

  const [messageVectorData, setMessageVectorData] = useState<Record<string, any>>({});
  const [previousStatus, setPreviousStatus] = useState(status);
  
  // Use provided ref or create a local one
  const localContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = messagesContainerRef || localContainerRef;

  // Haptic feedback for status changes
  useEffect(() => {
    if (previousStatus !== status) {
      if (status === 'submitted') {
        // Light haptic when message is submitted
        impactOccurred('light');
      } else if (status === 'streaming' && previousStatus === 'submitted') {
        // Medium haptic when streaming starts
        impactOccurred('medium');
      } else if (previousStatus === 'streaming' && (status === 'ready' || status === 'error')) {
        // Success haptic when streaming completes successfully, warning for errors
        if (status === 'ready') {
          notificationOccurred('success');
        } else {
          notificationOccurred('error');
        }
      }
      setPreviousStatus(status);
    }
  }, [status, previousStatus, impactOccurred, notificationOccurred]);

  // Store live vector search data when it becomes available for the current streaming message
  useEffect(() => {
    if (vectorSearchData && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && vectorSearchData.citations && vectorSearchData.citations.length > 0) {
        console.log(`[messages.tsx] Storing vector data for message ${lastMessage.id}:`, {
          citationsCount: vectorSearchData.citations.length,
          searchResults: vectorSearchData.searchResults
        });
        setMessageVectorData(prev => ({
          ...prev,
          [lastMessage.id]: {
            improvedQueries: vectorSearchData.improvedQueries || [],
            citations: vectorSearchData.citations || [],
            searchResults: vectorSearchData.searchResults || {},
          }
        }));
      }
    }
  }, [vectorSearchData, messages]);

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
                console.log(`[messages.tsx] Loaded vector data from DB for message ${message.id}:`, {
                  citationsCount: result.citations?.length || 0,
                  searchResults: result.searchResultCounts
                });
                setMessageVectorData(prev => ({
                  ...prev,
                  [message.id]: {
                    improvedQueries: result.improvedQueries || [],
                    citations: result.citations || [],
                    searchResults: result.searchResultCounts || {},
                  }
                }));
              } else {
                console.log(`[messages.tsx] No vector data found in DB for message ${message.id}`);
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
      ref={containerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative bg-background text-foreground"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--muted-foreground)) transparent',
      }}
    >
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background-color: hsl(var(--muted-foreground));
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background-color: hsl(var(--foreground));
        }
      `}</style>
      
      {messages.map((message, index) => {
        // Log vector data assignment
        const messageVectorDataAssigned = message.role === 'assistant' 
          ? (messageVectorData[message.id] || (index === messages.length - 1 ? vectorSearchData : null))
          : null;
        
        if (message.role === 'assistant') {
          console.log(`[messages.tsx] Rendering message ${message.id} (index ${index}/${messages.length - 1}):`, {
            hasStoredData: !!messageVectorData[message.id],
            isLastMessage: index === messages.length - 1,
            hasLiveData: !!vectorSearchData,
            vectorDataAssigned: !!messageVectorDataAssigned
          });
        }
        
        return (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.3, 
            delay: index * 0.05,
            ease: "easeOut" 
          }}
        >
          <PreviewMessage
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
            vectorSearchData={messageVectorDataAssigned}
            isFirstAssistantMessagePart={message.role === 'assistant' && index === messages.length - 1}
          />
        </motion.div>
      );
    })}

    {status === 'submitted' &&
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ThinkingMessage vectorSearchProgress={vectorSearchProgress} />
        </motion.div>
      )}

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
