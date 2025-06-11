'use client';
'use client';

import type { Attachment, UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { useCopyToClipboard } from 'usehooks-ts';
import { useTelegramHaptics } from '@/hooks/use-telegram-haptics';
import { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from '@/components/sidebar-history';


import { ArrowUpIcon, PaperclipIcon, StopIcon, PlusIcon, ShareIcon, MenuIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { PromptInputBox } from './ui/ai-prompt-box';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import { VisibilitySelector } from './visibility-selector';
import { SourceSelector, type SourceSelection, DEFAULT_SOURCES } from './source-selector';
import type { Session } from 'next-auth';
import { useSidebar } from './ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { updateChatVisibility, copyChatForUser } from '@/app/(chat)/actions';
import { Loader2 } from 'lucide-react';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  selectedVisibilityType,
  session,
  isReadonly,
  hideSuggestedActionsText,
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
  selectedVisibilityType: VisibilityType;
  session: Session | null;
  isReadonly?: boolean;
  hideSuggestedActionsText?: boolean;
}) {
  const { width } = useWindowSize();
  const router = useRouter();
  const { webApp, user: telegramUser } = useTelegram();
  const [_, copyToClipboard] = useCopyToClipboard();
  const { impactOccurred, notificationOccurred } = useTelegramHaptics();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInputActive, setIsInputActive] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isMakingPublic, setIsMakingPublic] = useState(false);
  const [shareButtonText, setShareButtonText] = useState('Share');
  const [isCopyingChat, setIsCopyingChat] = useState(false);
  const [selectedSources, setSelectedSources] = useLocalStorage<SourceSelection>(
    'selectedSources',
    DEFAULT_SOURCES
  );

  // Debug effect to track source changes
  useEffect(() => {
    console.log('[multimodal-input] Selected sources changed:', {
      selectedSources,
      selectedCount: Object.values(selectedSources).filter(Boolean).length,
      timestamp: new Date().toISOString()
    });
  }, [selectedSources]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    // Initialize input from localStorage if available
    const finalValue = localStorageInput || '';
    setInput(finalValue);
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      }
    },
    [setAttachments],
  );

  const handleSend = useCallback(async (message: string, files?: File[]) => {
    console.log('[handleSend] Starting send process:', {
      isReadonly,
      chatId,
      sessionUserId: session?.user?.id,
      message: message.substring(0, 50) + '...'
    });

    // Check if this is a readonly chat (viewing someone else's chat)
    if (isReadonly) {
      console.log('[handleSend] Readonly chat detected, copying chat for user...');
      toast.info('Creating a copy of this conversation for you...');
      setIsCopyingChat(true);

      try {
        const result = await copyChatForUser(chatId);
        console.log('[handleSend] Copy chat result:', result);
        
        if (result.success && result.newChatId) {
          // Navigate to the new chat with the message as a query parameter
          const newUrl = `/chat/${result.newChatId}?message=${encodeURIComponent(message)}`;
          console.log('[handleSend] Navigating to new chat:', newUrl);
          router.push(newUrl);
          return;
        } else {
          console.error('[handleSend] Failed to copy chat:', result.error);
          toast.error('Failed to create a copy of the conversation');
          setIsCopyingChat(false);
          return;
        }
      } catch (error) {
        console.error('[handleSend] Error copying chat:', error);
        toast.error('Failed to create a copy of the conversation');
        setIsCopyingChat(false);
        return;
      }
    }

    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Handle file uploads if any
    let uploadedAttachments: Array<Attachment> = [];
    if (files && files.length > 0) {
      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadResults = await Promise.all(uploadPromises);
        uploadedAttachments = uploadResults.filter(
          (attachment) => attachment !== undefined,
        ) as Array<Attachment>;
      } catch (error) {
        console.error('Error uploading files!', error);
        toast.error('Failed to upload files');
        return;
      }
    }

    // Get selected language from localStorage
    const selectedLanguage = localStorage.getItem('selectedLanguage') || 'en';
    console.log('🔍 Selected language from localStorage:', selectedLanguage);
    
    // Language names mapping
    const languageNames: { [key: string]: string } = {
      'en': 'English',
      'tr': 'Turkish',
      'ar': 'Arabic',
      'ru': 'Russian',
      'de': 'German',
      'fr': 'French',
      'es': 'Spanish',
    };

    const languageName = languageNames[selectedLanguage] || 'English';
    console.log('🔍 Language name:', languageName);
    
    // Create the final input with language instruction if not English
    let finalInput = message;
    if (selectedLanguage !== 'en') {
      finalInput = `${message}\n\n[Answer in ${languageName}]`;
      console.log('🔍 Final input with language instruction:', finalInput);
    } else {
      console.log('🔍 English selected, no language instruction added');
    }

    // Use append to add the message with the language instruction and selected sources
    console.log('[multimodal-input] Sending message with selected sources:', {
      selectedSources,
      finalInput: finalInput.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });
    
    append({
      role: 'user',
      content: finalInput,
      experimental_attachments: [...attachments, ...uploadedAttachments],
      data: {
        selectedSources: selectedSources as any,
      },
    });

    setAttachments([]);
    setLocalStorageInput('');
    setInput('');

    if (width && width > 768) {
      // Focus will be handled by the PromptInputBox component
    }
  }, [
    attachments,
    append,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    setInput,
    isReadonly,
    router,
    selectedSources,
  ]);

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  // Handle click outside to deactivate input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inputContainer = document.querySelector('[data-input-container]');
      if (inputContainer && !inputContainer.contains(target)) {
        setIsInputActive(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to get enhanced conversation preview
  const getConversationPreview = useCallback(() => {
    const userMessage = messages.find(msg => msg.role === 'user');
    const assistantMessage = messages.find(msg => msg.role === 'assistant');
    
    if (!userMessage || !assistantMessage) {
      return {
        preview: 'Check out this interesting Islamic Q&A conversation!',
        sourcesCount: 0,
        messageCount: messages.length
      };
    }
    
    // Get user question and clean language instructions
    const userContent = typeof userMessage.content === 'string' ? userMessage.content : '';
    // Remove language instruction pattern like [Answer in Russian], [Answer in Turkish], etc.
    const cleanedUserContent = userContent.replace(/\n\n\[Answer in [^\]]+\]$/i, '').trim();
    
    // Get assistant response (first 30 words for a more engaging preview)
    const assistantContent = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
    const assistantWords = assistantContent.trim().split(/\s+/);
    const assistantPreview = assistantWords.slice(0, 30).join(' ') + (assistantWords.length > 30 ? '...' : '');
    
    // Count sources mentioned in the conversation
    const sourcesCount = assistantContent.match(/\[(\d+)\]/g)?.length || 0;
    
    // Create a more engaging preview that focuses on the answer
    // If the question is short (under 10 words), include it, otherwise just show the answer
    const userWords = cleanedUserContent.trim().split(/\s+/);
    let preview;
    
    if (userWords.length <= 10) {
      // Short question - show both Q&A
      const userPreview = cleanedUserContent;
      preview = `"${userPreview}"\n\n${assistantPreview}`;
    } else {
      // Long question - just show the answer with context
      preview = `Islamic guidance: ${assistantPreview}`;
    }
    
    return {
      preview,
      sourcesCount,
      messageCount: messages.length
    };
  }, [messages]);

  // Helper function to get first 10 words from first agent response (legacy)
  const getFirstAgentResponsePreview = useCallback(() => {
    const firstAgentMessage = messages.find(msg => msg.role === 'assistant');
    if (!firstAgentMessage || typeof firstAgentMessage.content !== 'string') {
      return 'Check out this interesting conversation!';
    }
    
    const words = firstAgentMessage.content.trim().split(/\s+/);
    const first10Words = words.slice(0, 10).join(' ');
    return first10Words + (words.length > 10 ? '...' : '');
  }, [messages]);

  const handleMakePublicAndShare = async () => {
    setIsMakingPublic(true);
    setIsSharing(true); // Start loading state immediately
    
    try {
      await updateChatVisibility({
        chatId,
        visibility: 'public',
      });
      
      // Refresh the visibility state in SWR cache
      mutate(`${chatId}-visibility`, 'public', false);
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      mutate('/api/history');
      
      // Close modal and proceed with sharing
      setShowShareModal(false);
      setIsMakingPublic(false);
      
      // Wait a moment for the visibility update to propagate
      setTimeout(() => {
        handleShareInternal();
      }, 500);
      
    } catch (error) {
      console.error('Failed to make chat public:', error);
      toast.error('Failed to make chat public');
      setIsMakingPublic(false);
      setIsSharing(false); // Reset loading state on error
    }
  };

  const handleShare = async () => {
    // Check if chat is private
    if (selectedVisibilityType === 'private') {
      setShowShareModal(true);
      return;
    }
    
    // If public, proceed with sharing
    setIsSharing(true); // Start loading state
    handleShareInternal();
  };

  const handleShareInternal = async () => {
    // Prevent multiple simultaneous shares
    if (isSharing && shareButtonText !== 'Share') return;
    
    // Get the current URL
    const currentUrl = window.location.href;
    
    console.log('[handleShare] Starting share process...');
    console.log('[handleShare] Current URL:', currentUrl);
    console.log('[handleShare] WebApp available:', !!webApp);
    console.log('[handleShare] Telegram WebApp object:', (window as any).Telegram?.WebApp);
    
    // Haptic feedback when share is initiated
    impactOccurred('light');
    
    if (webApp && (window as any).Telegram?.WebApp?.shareMessage) {
      console.log('[handleShare] Using Telegram shareMessage API');
      
      try {
        // First, prepare the message via our API (it will fetch messages from DB)
        console.log('[handleShare] Preparing message via API...');
        const prepareResponse = await fetch('/api/telegram/prepare-share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            chatUrl: currentUrl,
          }),
        });

        const prepareData = await prepareResponse.json();
        console.log('[handleShare] Prepare API response:', prepareData);

        if (!prepareResponse.ok) {
          console.error('[handleShare] Failed to prepare message:', prepareData);
          
          // If prepare fails, fall back to simple copy
          console.log('[handleShare] Falling back to copy link');
          await copyToClipboard(currentUrl);
          setShareButtonText('Link Copied');
          notificationOccurred('success');
          toast.success('Chat link copied to clipboard!');
          
          // Reset button text after 2 seconds
          setTimeout(() => {
            setShareButtonText('Share');
            setIsSharing(false);
          }, 2000);
          return;
        }

        // Add small delay for better UX (show preparation state)
        await new Promise(resolve => setTimeout(resolve, 800));

        // Now use the prepared message ID with shareMessage
        console.log('[handleShare] Calling Telegram shareMessage with ID:', prepareData.preparedMessageId);
        
        (window as any).Telegram.WebApp.shareMessage(
          prepareData.preparedMessageId,
          (success: boolean) => {
            console.log('[handleShare] Share callback - Success:', success);
            if (success) {
              notificationOccurred('success');
              toast.success('Chat shared successfully!');
            } else {
              notificationOccurred('warning');
              toast.error('Share was cancelled');
            }
            // Add small delay before resetting
            setTimeout(() => {
              setIsSharing(false);
            }, 300);
          }
        );
        
      } catch (error) {
        console.error('[handleShare] Error during share process:', error);
        
        // Fallback to copying link with button state change
        try {
          await copyToClipboard(currentUrl);
          setShareButtonText('Link Copied');
          notificationOccurred('success');
          toast.success('Chat link copied to clipboard!');
          
          // Reset button text after 2 seconds
          setTimeout(() => {
            setShareButtonText('Share');
            setIsSharing(false);
          }, 2000);
        } catch (copyError) {
          console.error('[handleShare] Failed to copy as fallback:', copyError);
          notificationOccurred('error');
          toast.error('Failed to copy link');
          setIsSharing(false);
        }
      }
    } else {
      // For non-Telegram users or if shareMessage is not available
      console.log('[handleShare] Telegram shareMessage not available, using fallback');
      console.log('[handleShare] WebApp methods available:', webApp ? Object.keys(webApp) : 'No WebApp');
      
      try {
        // Add small delay for preparation feel
        await new Promise(resolve => setTimeout(resolve, 600));
        
        await copyToClipboard(currentUrl);
        setShareButtonText('Link Copied');
        notificationOccurred('success');
        toast.success('Chat link copied to clipboard!');
        
        // Reset button text after 2 seconds
        setTimeout(() => {
          setShareButtonText('Share');
          setIsSharing(false);
        }, 2000);
        
        // If we have openTelegramLink, use the share URL as additional option
        if (webApp?.openTelegramLink) {
          console.log('[handleShare] Opening Telegram share link as fallback');
          const shareText = `Check out this chat: ${currentUrl}`;
          const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
          webApp.openTelegramLink(telegramShareUrl);
        }
      } catch (error) {
        console.error('[handleShare] Failed to copy link:', error);
        notificationOccurred('error');
        toast.error('Failed to copy link');
        setIsSharing(false);
      }
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-1">
      {/* Loading overlay while copying chat */}
      {isCopyingChat && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Creating your copy of the conversation...</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {!isAtBottom && messages.length > 0 && !isInputActive && (status === 'ready' || status === 'error' || !status) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute bottom-36 left-[45%] -translate-x-1/2 z-20 flex justify-center items-center"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full shadow-lg"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAtBottom && messages.length > 0 && !isInputActive && (status === 'ready' || status === 'error' || !status) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute bottom-36 left-0 right-0 z-20 flex justify-center items-center gap-3"
          >
            {/* Hide sidebar toggle button on desktop */}
            {width && width <= 768 && (
              <Button
                data-testid="sidebar-toggle-button"
                className="rounded-full shadow-lg"
                size="icon"
                variant="outline"
                onClick={(event) => {
                  event.preventDefault();
                  setOpenMobile(true);
                }}
              >
                <MenuIcon />
              </Button>
            )}
            
            <Button
              data-testid="new-chat-button"
              className="rounded-full shadow-lg px-4 py-2 h-auto"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="ml-2">New Chat</span>
            </Button>
            
            <Button
              data-testid="share-chat-button"
              className="rounded-full shadow-lg px-4 py-2 h-auto"
              variant="outline"
              disabled={isSharing}
              onClick={(event) => {
                event.preventDefault();
                handleShare();
              }}
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShareIcon />
              )}
              <span className="ml-2">
                {isSharing ? 'Preparing...' : shareButtonText}
              </span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <div 
        className="relative"
        data-input-container
        onFocus={() => setIsInputActive(true)}
        onBlur={() => setIsInputActive(false)}
        onMouseDown={() => setIsInputActive(true)}
      >
        <PromptInputBox
          onSend={handleSend}
          isLoading={status === 'submitted' || status === 'streaming' || isCopyingChat}
          placeholder={
            isCopyingChat
              ? "Creating your copy of the conversation..."
              : status === 'submitted' 
                ? "Processing your message..." 
                : status === 'streaming' 
                  ? "Generating response..." 
                  : messages.length > 0
                    ? "Ask follow up..."
                    : "Send a message..."
          }
          className={cx(
            'w-full',
            // Make input bigger when shown with suggested actions (empty state)
            messages.length === 0 && '[&_textarea]:min-h-[60px] [&_textarea]:text-lg',
            // Apply glass styling when in empty state (with suggested actions)
            messages.length === 0 && 'bg-white/10 backdrop-blur-md border-white/20 shadow-lg',
            className,
          )}
          showStopButton={status === 'submitted' || status === 'streaming'}
          onStopClick={() => {
            stop();
            setMessages((messages) => messages);
          }}
        />

        {/* Visibility Selector and Source Selector - Bottom Left Inside */}
        <div className="absolute bottom-3 left-3 flex flex-row gap-1 items-center">
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            className="!h-8 !text-xs !px-2 !bg-white/5 !backdrop-blur-md !border !border-white/20 hover:!bg-white/10 !transition-all !duration-200 !rounded-full"
          />
          <SourceSelector
            selectedSources={selectedSources}
            onSourcesChange={setSelectedSources}
            className="!h-8 !text-xs !px-2 !bg-white/5 !backdrop-blur-md !border !border-white/20 hover:!bg-white/10 !transition-all !duration-200 !rounded-full"
          />
        </div>
      </div>

      {/* Consent Text */}
      {!hideSuggestedActionsText && (
        <div className="text-xs text-muted-foreground text-center px-1 py-1.5">
          It&apos;s always better to ask an Imam. 
          <a 
            href="https://www.google.com/maps/search/mosque+near+me" 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-2 text-primary hover:text-primary/80"
          >
            Find near mosque
          </a>
        </div>
      )}

      {/* Show attachments preview below the input */}
      {attachments.length > 0 && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end px-1"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}
        </div>
      )}

      {/* Share Modal for Private Chats */}
      <AlertDialog open={showShareModal} onOpenChange={setShowShareModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make Chat Public to Share</AlertDialogTitle>
            <AlertDialogDescription>
              This chat is currently private and can only be viewed by you. To share it with others, you need to make it public first. 
              Anyone with the link will be able to view the conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMakingPublic}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMakePublicAndShare}
              disabled={isMakingPublic}
              className="flex items-center gap-2"
            >
              {isMakingPublic && <Loader2 className="h-4 w-4 animate-spin" />}
              {isMakingPublic ? 'Making Public...' : 'Make Public & Share'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.hideSuggestedActionsText !== nextProps.hideSuggestedActionsText)
      return false;

    return true;
  },
);
