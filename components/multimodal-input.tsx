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

import { ArrowUpIcon, PaperclipIcon, StopIcon, PlusIcon, ShareIcon } from './icons';
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
import type { Session } from 'next-auth';

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
}) {
  const { width } = useWindowSize();
  const router = useRouter();
  const { webApp } = useTelegram();
  const [_, copyToClipboard] = useCopyToClipboard();
  const { impactOccurred, notificationOccurred } = useTelegramHaptics();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInputActive, setIsInputActive] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

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

    // Use append to add the message with the language instruction
    append({
      role: 'user',
      content: finalInput,
      experimental_attachments: [...attachments, ...uploadedAttachments],
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

  // Helper function to get first 10 words from first agent response
  const getFirstAgentResponsePreview = useCallback(() => {
    const firstAgentMessage = messages.find(msg => msg.role === 'assistant');
    if (!firstAgentMessage || typeof firstAgentMessage.content !== 'string') {
      return 'Check out this interesting conversation!';
    }
    
    const words = firstAgentMessage.content.trim().split(/\s+/);
    const first10Words = words.slice(0, 10).join(' ');
    return first10Words + (words.length > 10 ? '...' : '');
  }, [messages]);

  const handleShare = async () => {
    // Prevent multiple simultaneous shares
    if (isSharing) return;
    
    setIsSharing(true);
    
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
        // Get preview text from first agent response
        const previewText = getFirstAgentResponsePreview();
        
        // First, prepare the message via our API
        console.log('[handleShare] Preparing message via API...');
        const prepareResponse = await fetch('/api/telegram/prepare-share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            chatUrl: currentUrl,
            previewText,
          }),
        });

        const prepareData = await prepareResponse.json();
        console.log('[handleShare] Prepare API response:', prepareData);

        if (!prepareResponse.ok) {
          console.error('[handleShare] Failed to prepare message:', prepareData);
          notificationOccurred('error');
          toast.error(`Failed to prepare share: ${prepareData.details || prepareData.error}`);
          
          // Fallback to copying link
          await copyToClipboard(currentUrl);
          toast.success('Chat link copied to clipboard!');
          return;
        }

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
            setIsSharing(false);
          }
        );
        
      } catch (error) {
        console.error('[handleShare] Error during share process:', error);
        notificationOccurred('error');
        toast.error('Failed to share chat');
        
        // Fallback to copying link
        try {
          await copyToClipboard(currentUrl);
          toast.success('Chat link copied to clipboard instead!');
        } catch (copyError) {
          console.error('[handleShare] Failed to copy as fallback:', copyError);
        }
        setIsSharing(false);
      }
    } else {
      // For non-Telegram users or if shareMessage is not available
      console.log('[handleShare] Telegram shareMessage not available, using fallback');
      console.log('[handleShare] WebApp methods available:', webApp ? Object.keys(webApp) : 'No WebApp');
      
      try {
        await copyToClipboard(currentUrl);
        notificationOccurred('success');
        toast.success('Chat link copied to clipboard!');
        
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
      }
      setIsSharing(false);
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-1">
      <AnimatePresence>
        {!isAtBottom && messages.length > 0 && !isInputActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute bottom-36 left-[45%] -translate-x-1/2 z-50 flex justify-center items-center"
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
        {isAtBottom && messages.length > 0 && !isInputActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute bottom-36 left-0 right-0 z-50 flex justify-center items-center gap-3"
          >
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
              <ShareIcon />
              <span className="ml-2">{isSharing ? 'Sharing...' : 'Share'}</span>
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
          isLoading={status === 'submitted' || status === 'streaming'}
          placeholder={
            status === 'submitted' 
              ? "Processing your message..." 
              : status === 'streaming' 
                ? "Generating response..." 
                : "Send a message..."
          }
          className={cx(
            'w-full',
            className,
          )}
          onAttachmentClick={() => fileInputRef.current?.click()}
          attachmentCount={attachments.length}
          showStopButton={status === 'submitted' || status === 'streaming'}
          onStopClick={() => {
            stop();
            setMessages((messages) => messages);
          }}
        />

        {/* Visibility Selector - Bottom Left Inside */}
        <div className="absolute bottom-3 left-3 flex flex-row gap-1 items-center">
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            className="!h-8 !text-xs !px-2 !border-border !bg-background hover:!bg-accent !text-muted-foreground hover:!text-accent-foreground !rounded-full"
          />
        </div>
      </div>

      {/* Consent Text */}
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

    return true;
  },
);
