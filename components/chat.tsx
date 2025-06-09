'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
// import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { SuggestedActions } from './suggested-actions';
import { AppFooter } from './app-footer';
import { SubscriptionModal } from './subscription-modal';
import type { VisibilityType } from './visibility-selector';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { useAuthLoading } from '@/contexts/AuthLoadingContext';
import { MenuIcon } from './icons';
import { Button } from './ui/button';
import { useSidebar } from './ui/sidebar';
import { useWindowSize } from 'usehooks-ts';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

export function Chat({
  id,
  initialMessages,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session | null;
  autoResume: boolean;
}) {
  console.log('[chat.tsx] 🚀 Chat component initialized:', {
    chatId: id,
    initialMessagesCount: initialMessages.length,
    initialVisibilityType,
    isReadonly,
    userType: session?.user?.type || 'no-session',
    userId: session?.user?.id || 'no-user-id',
    autoResume,
    timestamp: new Date().toISOString(),
    environment: typeof window !== 'undefined' ? 'client' : 'server',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent.substring(0, 100) : 'server'
  });

  const { mutate } = useSWRConfig();
  const [vectorSearchProgress, setVectorSearchProgress] = useState<any>(null);
  const [vectorSearchData, setVectorSearchData] = useState<any>(null);
  const [dbOperationsComplete, setDbOperationsComplete] = useState(true); // Track when DB operations are done
  const { setIsAuthLoading } = useAuthLoading();
  const [isChatReady, setIsChatReady] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { setOpenMobile } = useSidebar();
  const { width } = useWindowSize();
  
  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [userStats, setUserStats] = useState<{ messagesLast24h: number; totalMessages: number } | null>(null);

  // Fetch user stats for subscription modal
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/user/stats')
        .then(response => response.json())
        .then(data => {
          if (!data.error) {
            setUserStats(data);
          }
        })
        .catch(error => {
          console.error('Error fetching user stats:', error);
        });
    }
  }, [session?.user?.id]);

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
    experimental_prepareRequestBody: (body) => {
      try {
        const lastMessage = body?.messages?.at?.(-1);
        const selectedSources = (lastMessage?.data as any)?.selectedSources;
        
        console.log('[chat.tsx] Preparing request with sources:', {
          hasBody: !!body,
          hasMessages: !!body?.messages,
          messagesLength: body?.messages?.length || 0,
          hasLastMessage: !!lastMessage,
          hasData: !!(lastMessage?.data),
          selectedSources,
          messageId: lastMessage?.id,
          timestamp: new Date().toISOString()
        });
        
        const requestBody = {
          id,
          message: lastMessage,
          selectedChatModel: DEFAULT_CHAT_MODEL,
          selectedVisibilityType: visibilityType,
          selectedLanguage: (body as any)?.data?.selectedLanguage || 'en',
          selectedSources: selectedSources,
        };
        
        console.log('[chat.tsx] 🚀 Preparing request body:', {
          chatId: id,
          messageContent: requestBody.message?.content?.substring?.(0, 100) + '...',
          chatModel: requestBody.selectedChatModel,
          visibilityType: requestBody.selectedVisibilityType,
          language: requestBody.selectedLanguage,
          selectedSources: requestBody.selectedSources,
          timestamp: new Date().toISOString()
        });
        
        return requestBody;
      } catch (error) {
        console.error('[chat.tsx] ❌ Error in experimental_prepareRequestBody:', error);
        // Return a fallback request body
        return {
          id,
          message: body?.messages?.at?.(-1),
          selectedChatModel: DEFAULT_CHAT_MODEL,
          selectedVisibilityType: visibilityType,
          selectedLanguage: 'en',
          selectedSources: undefined,
        };
      }
    },
    onFinish: () => {
      console.log('[chat.tsx] ✅ Chat finished, mutating cache and resetting progress');
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      setVectorSearchProgress(null); // Reset progress when finished
      // Add a delay to ensure database operations are complete
      setTimeout(() => {
        setDbOperationsComplete(true);
        console.log('[chat.tsx] 📝 Database operations marked as complete');
      }, 1000); // Increased to 1000ms delay to ensure DB operations are done
    },
    onError: (error) => {
      console.error('[chat.tsx] ❌ Chat error occurred:', {
        error: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error,
        fullError: error,
        timestamp: new Date().toISOString()
      });
      
      if (error instanceof ChatSDKError) {
        console.log('[chat.tsx] 🔍 ChatSDKError details:', {
          type: error.type,
          surface: error.surface,
          userType: session?.user?.type
        });
        
        // Check if it's a rate limit error
        if (error.type === 'rate_limit' && error.surface === 'chat') {
          console.log('[chat.tsx] 🚫 Rate limit hit, showing subscription modal');
          
          // Show subscription modal instead of redirecting
          setShowSubscriptionModal(true);
          
          toast({
            type: 'error',
            description: 'You have reached your daily message limit. Please tell us more about your needs to continue.',
          });
        } else {
          toast({
            type: 'error',
            description: error instanceof Error ? error.message : 'An error occurred',
          });
        }
      }
      setVectorSearchProgress(null); // Reset progress on error
      setVectorSearchData(null); // Reset data on error
      setDbOperationsComplete(true); // Reset on error
    },
  });

  // Track when streaming starts to mark DB operations as incomplete
  useEffect(() => {
    console.log('[chat.tsx] 📊 Status changed to:', status);
    
    if (status === 'streaming' || status === 'submitted') {
      console.log('[chat.tsx] 🔄 Marking DB operations as incomplete due to status:', status);
      setDbOperationsComplete(false);
    }
  }, [status]);

  // Listen for vector search progress updates from the data stream
  useEffect(() => {
    console.log('[chat.tsx] 📡 Data stream update received:', {
      hasData: !!data,
      dataLength: data?.length || 0,
      dataTypes: data?.map((item, i) => `${i}: ${typeof item}`),
      timestamp: new Date().toISOString()
    });
    
    if (data && Array.isArray(data) && data.length > 0) {
      let foundRealProgress = false;
      // Process all data items, not just the latest
      data.forEach((item, index) => {
        console.log('[chat.tsx] 🔍 Processing data item', index, ':', {
          type: typeof item,
          hasType: item && typeof item === 'object' && 'type' in item,
          hasAnnotations: item && typeof item === 'object' && 'annotations' in item,
          itemPreview: typeof item === 'object' ? Object.keys(item || {}).slice(0, 5) : item
        });
        
        if (typeof item === 'object' && item !== null) {
          // Check for different possible data structures
          if ('type' in item && (item as any).type === 'vector-search-progress') {
            console.log('[chat.tsx] 🎯 Found vector-search-progress in data item:', {
              index,
              progressData: (item as any).progress,
              timestamp: new Date().toISOString()
            });
            
            try {
              const progressStr = (item as any).progress;
              const progress = typeof progressStr === 'string' ? JSON.parse(progressStr) : progressStr;
              
              console.log('[chat.tsx] 📈 Parsed vector search progress:', {
                step: progress.step,
                hasImprovedQueries: !!progress.improvedQueries,
                hasSearchResults: !!progress.searchResults,
                hasCitations: !!progress.citations,
                improvedQueriesCount: progress.improvedQueries?.length || 0,
                searchResultsKeys: progress.searchResults ? Object.keys(progress.searchResults) : [],
                citationsCount: progress.citations?.length || 0
              });
              
              setVectorSearchProgress(progress);
              foundRealProgress = true;
              
              // Store the final data when we reach step 3
              if (progress.step === 3) {
                console.log('[chat.tsx] 🎯 Step 3 reached, storing vector search data');
                setVectorSearchData({
                  improvedQueries: progress.improvedQueries,
                  searchResults: progress.searchResults,
                  citations: [] // Will be populated from API response
                });
              }
              
              // Store the complete data when we reach step 4 (final)
              if (progress.step === 4 && progress.citations) {
                console.log('[chat.tsx] 🏁 Step 4 reached with citations, storing complete data:', {
                  citationsCount: progress.citations.length,
                  citationTypes: progress.citations.map((c: any) => c.metadata?.type || 'unknown')
                });
                
                // Log metadata keys for classical sources
                progress.citations.forEach((c: any, i: number) => {
                  if ((c.metadata?.type === 'classic' || c.metadata?.type === 'CLS' || (!c.metadata?.type && !c.namespace)) && c.metadata) {
                    console.log(`[chat.tsx] 📚 Classic source ${i} metadata keys:`, Object.keys(c.metadata));
                  }
                });
                
                setVectorSearchData({
                  improvedQueries: progress.improvedQueries,
                  searchResults: progress.searchResults,
                  citations: progress.citations
                });
              }
            } catch (e) {
              console.error('[chat.tsx] ❌ Error parsing vector search progress:', e);
            }
          } else if ('annotations' in item) {
            console.log('[chat.tsx] 📝 Found annotations in data item:', {
              index,
              annotationsCount: Array.isArray((item as any).annotations) ? (item as any).annotations.length : 0
            });
            
            // Check if it's in annotations
            const annotations = (item as any).annotations;
            if (Array.isArray(annotations)) {
              annotations.forEach((annotation: any, annotationIndex: number) => {
                console.log('[chat.tsx] 🔍 Processing annotation', annotationIndex, ':', {
                  type: annotation.type,
                  hasData: !!annotation.data
                });
                
                if (annotation.type === 'vector-search-progress') {
                  console.log('[chat.tsx] 🎯 Found vector-search-progress in annotation:', annotation.data);
                  setVectorSearchProgress(annotation.data);
                }
              });
            }
          }
        }
      });
      
      console.log('[chat.tsx] 📊 Data processing complete:', {
        foundRealProgress,
        totalItems: data.length,
        timestamp: new Date().toISOString()
      });
    }
  }, [data]);

  // Reset vector search progress when status changes to submitted
  useEffect(() => {
    console.log('[chat.tsx] 🔄 Status change detected for vector search simulation:', status);
    
    if (status === 'submitted') {
      console.log('[chat.tsx] 🎬 Starting vector search progress simulation');
      
      // Simulate progress updates to show what is happening
      const simulateProgress = async () => {
        console.log('[chat.tsx] 📝 Simulating Step 1: Improving queries');
        // Step 1: Improving queries
        setVectorSearchProgress({ step: 1 });
        
        // Removed simulated loading messages
        // const simulatedQueries = [
        //   'Loading query improvements...',
        //   'Analyzing semantic variations...',
        //   'Expanding search scope...'
        // ];
        
        // setVectorSearchProgress({ 
        //   step: 1, 
        //   improvedQueries: simulatedQueries
        // });
        
        // Step 2: Searching
        // setVectorSearchProgress({ 
        //   step: 2,
        //   improvedQueries: simulatedQueries
        // });
        
        const simulatedResults = {
          classic: 3,
          modern: 2,
          risale: 3,
          youtube: 4,
          fatwa: 2
        };
        
        console.log('[chat.tsx] 🔍 Simulating Step 2: Searching with results:', simulatedResults);
        setVectorSearchProgress({ 
          step: 2,
          searchResults: simulatedResults
        });
        
        // Step 3: Generating
        console.log('[chat.tsx] ⚡ Simulating Step 3: Generating response');
        setVectorSearchProgress({ 
          step: 3,
          searchResults: simulatedResults
        });
        
        // Store simulated data for display (without sample citations)
        console.log('[chat.tsx] 💾 Storing simulated vector search data');
        setVectorSearchData({
          improvedQueries: [], // Empty array instead of simulated queries
          searchResults: simulatedResults,
          citations: [] // Empty array - will be populated when real data arrives
        });
      };
      
      simulateProgress();
    }
  }, [status]);

  const searchParams = useSearchParams();
  const query = searchParams.get('query');
  const messageParam = searchParams.get('message');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const [hasAppendedMessage, setHasAppendedMessage] = useState(false);

  useEffect(() => {
    console.log('[chat.tsx] 🔍 Query parameter check:', {
      query,
      hasAppendedQuery,
      chatId: id
    });
    
    if (query && !hasAppendedQuery) {
      console.log('[chat.tsx] 📤 Appending query from URL parameter:', query);
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
      console.log('[chat.tsx] 🔄 URL cleaned and query appended');
    }
  }, [query, append, hasAppendedQuery, id]);

  // Handle message parameter (for copied chats)
  useEffect(() => {
    console.log('[chat.tsx] 💬 Message parameter check:', {
      messageParam,
      hasAppendedMessage,
      hasAppendedQuery,
      chatId: id
    });
    
    if (messageParam && !hasAppendedMessage && !hasAppendedQuery) {
      console.log('[chat.tsx] 📤 Message parameter detected, sending message:', messageParam);
      append({
        role: 'user',
        content: messageParam,
      });

      setHasAppendedMessage(true);
      window.history.replaceState({}, '', `/chat/${id}`);
      
      // Scroll to bottom after appending the message
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
      
      console.log('[chat.tsx] 🔄 Message appended and scroll scheduled');
    }
  }, [messageParam, append, hasAppendedMessage, hasAppendedQuery, id]);

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

  // Mark chat as ready after initial render
  useEffect(() => {
    console.log('[chat.tsx] ✅ Chat marked as ready');
    setIsChatReady(true);
  }, []);

  // Scroll to top when opening existing chat
  useEffect(() => {
    console.log('[chat.tsx] 📜 Scroll effect triggered:', {
      initialMessagesLength: initialMessages.length,
      hasMessagesContainer: !!messagesContainerRef.current
    });
    
    if (initialMessages.length > 0 && messagesContainerRef.current) {
      console.log('[chat.tsx] ⬆️ Scrolling to top for existing chat');
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({
          top: 0,
          behavior: 'instant'
        });
        console.log('[chat.tsx] 📍 Scroll to top completed');
      }, 50);
    }
  }, [initialMessages.length]);

  // Clear auth loading when chat is ready
  useEffect(() => {
    console.log('[chat.tsx] 🔄 Auth loading effect triggered:', {
      isChatReady,
      timestamp: new Date().toISOString()
    });
    
    if (!isChatReady) return;
    
    console.log('[chat.tsx] 🎨 Starting auth loading clear sequence');
    
    // Use requestAnimationFrame to ensure the chat is painted before hiding loader
    const rafId = requestAnimationFrame(() => {
      console.log('[chat.tsx] 🖼️ First animation frame');
      // Additional frame to ensure everything is rendered
      requestAnimationFrame(() => {
        console.log('[chat.tsx] 🖼️ Second animation frame');
        // Small delay for smooth transition after paint
        setTimeout(() => {
          console.log('[chat.tsx] 🚫 Clearing auth loading state');
          setIsAuthLoading(false);
        }, 100);
      });
    });

    return () => {
      if (rafId) {
        console.log('[chat.tsx] 🗑️ Cleaning up animation frame');
        cancelAnimationFrame(rafId);
      }
    };
  }, [setIsAuthLoading, isChatReady]);

  // Get user entitlements for subscription modal
  const userType = session?.user?.type || 'guest';
  const entitlements = entitlementsByUserType[userType];
  const currentUsage = userStats?.messagesLast24h || 0;
  const maxLimit = entitlements.maxMessagesPerDay;

  return (
    <>
      {/* Subscription Modal */}
      <SubscriptionModal
        open={showSubscriptionModal}
        onOpenChange={setShowSubscriptionModal}
        currentUsage={currentUsage}
        maxLimit={maxLimit}
      />

      {/* Full page background image - only visible when no messages */}
      {messages.length === 0 && (
        <>
          {/* Light theme background */}
          <div 
            className="fixed inset-0 z-0 dark:hidden"
            style={{
              backgroundImage: "url('/images/bacground_white.jpeg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.4,
              filter: 'blur(0.5px)'
            }}
          />
          {/* Dark theme background */}
          <div 
            className="fixed inset-0 z-0 hidden dark:block"
            style={{
              backgroundImage: "url('/images/bacground_night.jpeg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.4,
              filter: 'blur(0.5px)'
            }}
          />
        </>
      )}
      
      <div className="flex flex-col min-w-0 h-dvh bg-transparent overflow-hidden pb-5 md:pb-0 relative z-10">
        {/* ChatHeader commented out - replaced by floating New Chat button
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          session={session}
        />
        */}

        {/* Conditional layout based on whether there are messages */}
        {messages.length === 0 ? (
          // Layout for empty state with footer at bottom
          <>
            {/* Main content area - centered */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-3 md:px-4 w-full max-w-3xl mx-auto overflow-hidden relative">
              {/* Content - no longer needs overlay wrapper */}
              <div className="w-full max-w-full flex flex-col items-center justify-center">
                {/* Mobile sidebar toggle button */}
                {width && width <= 768 && (
                  <div className="w-full flex justify-start mb-4">
                    <Button
                      data-testid="mobile-sidebar-toggle"
                      className="bg-white/5 backdrop-blur-md border border-white/20 hover:bg-white/10 transition-all duration-200 rounded-full shadow-lg"
                      size="icon"
                      variant="outline"
                      onClick={(event) => {
                        event.preventDefault();
                        setOpenMobile(true);
                      }}
                    >
                      <MenuIcon />
                    </Button>
                  </div>
                )}
                
                {/* Greeting section */}
                <div className="mb-6 sm:mb-8 w-full max-w-full">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 text-left break-words text-foreground">
                    Assalamu Alaikum!
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl text-muted-foreground text-left break-words">
                    How can I assist you with Islamic knowledge today?
                  </div>
                </div>
                
                {/* Input section right below greeting */}
                <div className="w-full max-w-full mb-4 sm:mb-6">
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
                      session={session}
                      isReadonly={isReadonly}
                      hideSuggestedActionsText={!isReadonly && attachments.length === 0}
                    />
                </div>
                
                {/* Show suggested actions below the input when no messages */}
                {!isReadonly && attachments.length === 0 && (
                  <div className="w-full max-w-full">
                    <SuggestedActions
                      append={append}
                      chatId={id}
                      selectedVisibilityType={visibilityType}
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer at bottom of page */}
            {!isReadonly && attachments.length === 0 && (
              <div className="w-full px-2 sm:px-3 md:px-4 pb-4 sm:pb-6">
                <AppFooter />
              </div>
            )}
          </>
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
              dbOperationsComplete={dbOperationsComplete}
              messagesContainerRef={messagesContainerRef}
            />

            <form className="flex mx-auto px-2 gap-2 w-full md:max-w-3xl">
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
                  session={session}
                  isReadonly={isReadonly}
                  hideSuggestedActionsText={false}
                />
            </form>
          </>
        )}
      </div>
    </>
  );
}
