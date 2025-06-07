import type { Message } from 'ai';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon, ShareIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { toast } from 'sonner';
import { useTelegram } from '@/hooks/useTelegram';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const { webApp } = useTelegram();

  if (isLoading) return null;
  if (message.role === 'user') return null;

  const handleShare = async () => {
    // Get the message content
    const textFromParts = message.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim();

    if (!textFromParts) {
      toast.error("There's no text to share!");
      return;
    }
    
    if (webApp) {
      // For Telegram users
      try {
        // First, copy to clipboard as fallback
        await copyToClipboard(textFromParts);
        
        // Check if we have the shareMessage method (Bot API 8.0+)
        if (webApp.shareMessage && webApp.isVersionAtLeast('8.0')) {
          // Use the proper Bot API 8.0+ shareMessage method
          toast.loading('Preparing message for sharing...');
          
          try {
            // Call our backend API to prepare the inline message
            const prepareResponse = await fetch('/api/telegram/prepare-message', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messageContent: textFromParts
              }),
            });

            if (!prepareResponse.ok) {
              throw new Error('Failed to prepare message');
            }

            const { preparedMessageId } = await prepareResponse.json();
            
            // Use Telegram's shareMessage with the prepared message ID
            webApp.shareMessage(preparedMessageId, (success: boolean) => {
              if (success) {
                toast.success('Message shared successfully!');
              } else {
                toast.error('Failed to share message');
              }
            });
            
            // Dismiss the loading toast
            toast.dismiss();
            
          } catch (error) {
            console.error('Error preparing message:', error);
            toast.error('Failed to prepare message for sharing');
            
            // Fallback to URL sharing
            const shareText = textFromParts.length > 4000 
              ? textFromParts.substring(0, 3997) + '...' 
              : textFromParts;
            
            const telegramShareUrl = `https://t.me/share/url?text=${encodeURIComponent(shareText)}`;
            webApp.openTelegramLink?.(telegramShareUrl);
            toast.success('Opening Telegram share dialog...');
          }
        } else if (webApp.openTelegramLink) {
          // Fallback to URL sharing for older versions
          const shareText = textFromParts.length > 4000 
            ? textFromParts.substring(0, 3997) + '...' 
            : textFromParts;
          
          const telegramShareUrl = `https://t.me/share/url?text=${encodeURIComponent(shareText)}`;
          webApp.openTelegramLink(telegramShareUrl);
          
          toast.success('Opening Telegram share dialog...');
        } else {
          // Fallback: just notify that content was copied
          toast.success('Message copied to clipboard! You can paste it in any chat.');
        }
      } catch (error) {
        toast.error('Failed to share message');
      }
    } else {
      // For non-Telegram users, copy the message content
      try {
        await copyToClipboard(textFromParts);
        
        // Also try to use the Web Share API if available
        if (navigator.share && window.isSecureContext) {
          try {
            await navigator.share({
              text: textFromParts,
              title: 'Shared Message'
            });
            toast.success('Message shared!');
          } catch (shareError) {
            // User cancelled or share failed, but we already copied to clipboard
            if ((shareError as Error).name !== 'AbortError') {
              toast.success('Message copied to clipboard!');
            }
          }
        } else {
          toast.success('Message copied to clipboard!');
        }
      } catch (error) {
        toast.error('Failed to copy message');
      }
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                const textFromParts = message.parts
                  ?.filter((part) => part.type === 'text')
                  .map((part) => part.text)
                  .join('\n')
                  .trim();

                if (!textFromParts) {
                  toast.error("There's no text to copy!");
                  return;
                }

                await copyToClipboard(textFromParts);
                toast.success('Copied to clipboard!');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={handleShare}
            >
              <ShareIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share Message</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="message-upvote"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              disabled={vote?.isUpvoted}
              variant="outline"
              onClick={async () => {
                const upvote = fetch('/api/vote', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    chatId,
                    messageId: message.id,
                    type: 'up',
                  }),
                });

                toast.promise(upvote, {
                  loading: 'Upvoting Response...',
                  success: () => {
                    mutate<Array<Vote>>(
                      `/api/vote?chatId=${chatId}`,
                      (currentVotes) => {
                        if (!currentVotes) return [];

                        const votesWithoutCurrent = currentVotes.filter(
                          (vote) => vote.messageId !== message.id,
                        );

                        return [
                          ...votesWithoutCurrent,
                          {
                            chatId,
                            messageId: message.id,
                            isUpvoted: true,
                          },
                        ];
                      },
                      { revalidate: false },
                    );

                    return 'Upvoted Response!';
                  },
                  error: 'Failed to upvote response.',
                });
              }}
            >
              <ThumbUpIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upvote Response</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="message-downvote"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              disabled={vote && !vote.isUpvoted}
              onClick={async () => {
                const downvote = fetch('/api/vote', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    chatId,
                    messageId: message.id,
                    type: 'down',
                  }),
                });

                toast.promise(downvote, {
                  loading: 'Downvoting Response...',
                  success: () => {
                    mutate<Array<Vote>>(
                      `/api/vote?chatId=${chatId}`,
                      (currentVotes) => {
                        if (!currentVotes) return [];

                        const votesWithoutCurrent = currentVotes.filter(
                          (vote) => vote.messageId !== message.id,
                        );

                        return [
                          ...votesWithoutCurrent,
                          {
                            chatId,
                            messageId: message.id,
                            isUpvoted: false,
                          },
                        ];
                      },
                      { revalidate: false },
                    );

                    return 'Downvoted Response!';
                  },
                  error: 'Failed to downvote response.',
                });
              }}
            >
              <ThumbDownIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Downvote Response</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  },
);
