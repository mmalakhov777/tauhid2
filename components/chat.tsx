'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { SuggestedActions } from './suggested-actions';
import type { VisibilityType } from './visibility-selector';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session | null;
  autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [vectorSearchProgress, setVectorSearchProgress] = useState<any>(null);
  const [vectorSearchData, setVectorSearchData] = useState<any>(null);

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const {
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
      selectedLanguage: (body as any).data?.selectedLanguage || 'en',
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      setVectorSearchProgress(null); // Reset progress when finished
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
      setVectorSearchProgress(null); // Reset progress on error
      setVectorSearchData(null); // Reset data on error
    },
  });

  // Listen for vector search progress updates from the data stream
  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      let foundRealProgress = false;
      // Process all data items, not just the latest
      data.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // Check for different possible data structures
          if ('type' in item && (item as any).type === 'vector-search-progress') {
            try {
              const progressStr = (item as any).progress;
              const progress = typeof progressStr === 'string' ? JSON.parse(progressStr) : progressStr;
              setVectorSearchProgress(progress);
              foundRealProgress = true;
              
              // Store the final data when we reach step 3
              if (progress.step === 3) {
                setVectorSearchData({
                  improvedQueries: progress.improvedQueries,
                  searchResults: progress.searchResults,
                  citations: [] // Will be populated from API response
                });
              }
              
              // Store the complete data when we reach step 4 (final)
              if (progress.step === 4 && progress.citations) {
                // Log metadata keys for classical sources
                progress.citations.forEach((c: any) => {
                  if ((c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)) && c.metadata) {
                    console.log(`[chat.tsx] Classic source metadata keys:`, Object.keys(c.metadata));
                  }
                });
                
                setVectorSearchData({
                  improvedQueries: progress.improvedQueries,
                  searchResults: progress.searchResults,
                  citations: progress.citations
                });
              }
            } catch (e) {
              console.error('Error parsing progress:', e);
            }
          } else if ('annotations' in item) {
            // Check if it's in annotations
            const annotations = (item as any).annotations;
            if (Array.isArray(annotations)) {
              annotations.forEach((annotation: any) => {
                if (annotation.type === 'vector-search-progress') {
                  setVectorSearchProgress(annotation.data);
                }
              });
            }
          }
        }
      });
    }
  }, [data]);

  // Reset vector search progress when status changes to submitted
  useEffect(() => {
    if (status === 'submitted') {
      // Simulate progress updates to show what's happening
      const simulateProgress = async () => {
        // Step 1: Improving queries
        setVectorSearchProgress({ step: 1 });
        
        const simulatedQueries = [
          'Loading query improvements...',
          'Analyzing semantic variations...',
          'Expanding search scope...'
        ];
        
        setVectorSearchProgress({ 
          step: 1, 
          improvedQueries: simulatedQueries
        });
        
        // Step 2: Searching
        setVectorSearchProgress({ 
          step: 2,
          improvedQueries: simulatedQueries
        });
        
        const simulatedResults = {
          classic: 3,
          modern: 2,
          risale: 3,
          youtube: 4
        };
        
        setVectorSearchProgress({ 
          step: 2,
          improvedQueries: simulatedQueries,
          searchResults: simulatedResults
        });
        
        // Step 3: Generating
        setVectorSearchProgress({ 
          step: 3,
          improvedQueries: simulatedQueries,
          searchResults: simulatedResults
        });
        
        // Store simulated data for display (without sample citations)
        setVectorSearchData({
          improvedQueries: simulatedQueries,
          searchResults: simulatedResults,
          citations: [] // Empty array - will be populated when real data arrives
        });
      };
      
      simulateProgress();
    }
  }, [status]);

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, append, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  useAutoResume({
    autoResume,
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          session={session}
        />

        {/* Conditional layout based on whether there are messages */}
        {messages.length === 0 ? (
          // Centered layout for empty state with greeting and input together
          <div className="flex-1 flex flex-col items-center justify-center px-4 w-full max-w-3xl mx-auto">
            {/* Greeting section */}
            <div className="mb-8 w-full">
              <div className="text-2xl font-semibold mb-2 text-left">
                Hello there!
              </div>
              <div className="text-2xl text-zinc-500 text-left">
                How can I help you today?
              </div>
            </div>
            
            {/* Input section right below greeting */}
            <div className="w-full mb-6">
              {!isReadonly && (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  status={status}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={setMessages}
                  append={append}
                  selectedVisibilityType={visibilityType}
                  selectedModelId={initialChatModel}
                  session={session}
                />
              )}
            </div>
            
            {/* Show suggested actions below the input when no messages */}
            {!isReadonly && attachments.length === 0 && (
              <div className="w-full">
                <SuggestedActions
                  append={append}
                  chatId={id}
                  selectedVisibilityType={visibilityType}
                />
              </div>
            )}
          </div>
        ) : (
          // Layout for when there are messages - Messages component and bottom input
          <>
            <Messages
              chatId={id}
              status={status}
              votes={votes}
              messages={messages}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              vectorSearchProgress={vectorSearchProgress}
              vectorSearchData={vectorSearchData}
            />

            <form className="flex mx-auto px-4 pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
              {!isReadonly && (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  status={status}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={setMessages}
                  append={append}
                  selectedVisibilityType={visibilityType}
                  selectedModelId={initialChatModel}
                  session={session}
                />
              )}
            </form>
          </>
        )}
      </div>
    </>
  );
}
