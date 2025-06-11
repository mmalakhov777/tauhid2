'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import type { Chat } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { ChatItem } from './sidebar-history-item';
import useSWRInfinite from 'swr/infinite';
import { LoaderIcon, PlusIcon } from './icons';
import { SkeletonWave } from './ui/skeleton';

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export interface ChatHistory {
  chats: Array<Chat>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) return `/api/history?limit=${PAGE_SIZE}`;

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) return null;

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
  });

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = async () => {
    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter((chat) => chat.id !== deleteId),
            }));
          }
        });

        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push('/');
    }
  };

  if (!user) {
    return (
      <>
        {/* Fixed New Chat Button */}
        <div className="flex-shrink-0 pt-4 px-2 pb-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setOpenMobile(false);
                  router.push('/');
                  router.refresh();
                }}
                size="lg" className="w-full justify-start gap-2 transition-all duration-300 bg-white/5 border border-white/20 hover:bg-white/10 rounded-[100px]"
                data-new-chat="true"
              >
                <PlusIcon size={16} />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
                Login to save and revisit previous chats!
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        {/* Fixed New Chat Button */}
        <div className="flex-shrink-0 pt-4 px-2 pb-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setOpenMobile(false);
                  router.push('/');
                  router.refresh();
                }}
                size="lg" className="w-full justify-start gap-2 transition-all duration-300 bg-white/5 border border-white/20 hover:bg-white/10 rounded-[100px]"
                data-new-chat="true"
              >
                <PlusIcon size={16} />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="mt-4">
                <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                  Today
                </div>
                <div className="flex flex-col gap-1">
                  {[44, 32, 28, 64, 52].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-md h-8 flex gap-2 px-2 items-center"
                    >
                      <SkeletonWave
                        className="h-4 flex-1 rounded-md"
                        delay={index * 0.1}
                        style={{
                          maxWidth: `${item}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <>
        {/* Fixed New Chat Button */}
        <div className="flex-shrink-0 pt-4 px-2 pb-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setOpenMobile(false);
                  router.push('/');
                  router.refresh();
                }}
                size="lg" className="w-full justify-start gap-2 transition-all duration-300 bg-white/5 border border-white/20 hover:bg-white/10 rounded-[100px]"
                data-new-chat="true"
              >
                <PlusIcon size={16} />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2 mt-4">
                Your conversations will appear here once you start chatting!
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Fixed New Chat Button */}
      <div className="flex-shrink-0 pt-4 px-2 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                setOpenMobile(false);
                router.push('/');
                router.refresh();
              }}
              size="lg" className="w-full justify-start gap-2 transition-all duration-300 bg-white/5 border border-white/20 hover:bg-white/10 rounded-[100px]"
              data-new-chat="true"
            >
              <PlusIcon size={16} />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {paginatedChatHistories &&
                (() => {
                  const chatsFromHistory = paginatedChatHistories.flatMap(
                    (paginatedChatHistory) => paginatedChatHistory.chats,
                  );

                  const groupedChats = groupChatsByDate(chatsFromHistory);
                  let globalIndex = 0;

                  return (
                    <div className="flex flex-col gap-6 mt-4">
                      {groupedChats.today.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                            Today
                          </div>
                          {groupedChats.today.map((chat) => (
                            <ChatItem
                              key={chat.id}
                              chat={chat}
                              isActive={chat.id === id}
                              onDelete={(chatId) => {
                                setDeleteId(chatId);
                                setShowDeleteDialog(true);
                              }}
                              setOpenMobile={setOpenMobile}
                              chatIndex={globalIndex++}
                            />
                          ))}
                        </div>
                      )}

                      {groupedChats.yesterday.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                            Yesterday
                          </div>
                          {groupedChats.yesterday.map((chat) => (
                            <ChatItem
                              key={chat.id}
                              chat={chat}
                              isActive={chat.id === id}
                              onDelete={(chatId) => {
                                setDeleteId(chatId);
                                setShowDeleteDialog(true);
                              }}
                              setOpenMobile={setOpenMobile}
                              chatIndex={globalIndex++}
                            />
                          ))}
                        </div>
                      )}

                      {groupedChats.lastWeek.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                            Last 7 days
                          </div>
                          {groupedChats.lastWeek.map((chat) => (
                            <ChatItem
                              key={chat.id}
                              chat={chat}
                              isActive={chat.id === id}
                              onDelete={(chatId) => {
                                setDeleteId(chatId);
                                setShowDeleteDialog(true);
                              }}
                              setOpenMobile={setOpenMobile}
                              chatIndex={globalIndex++}
                            />
                          ))}
                        </div>
                      )}

                      {groupedChats.lastMonth.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                            Last 30 days
                          </div>
                          {groupedChats.lastMonth.map((chat) => (
                            <ChatItem
                              key={chat.id}
                              chat={chat}
                              isActive={chat.id === id}
                              onDelete={(chatId) => {
                                setDeleteId(chatId);
                                setShowDeleteDialog(true);
                              }}
                              setOpenMobile={setOpenMobile}
                              chatIndex={globalIndex++}
                            />
                          ))}
                        </div>
                      )}

                      {groupedChats.older.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                            Older than last month
                          </div>
                          {groupedChats.older.map((chat) => (
                            <ChatItem
                              key={chat.id}
                              chat={chat}
                              isActive={chat.id === id}
                              onDelete={(chatId) => {
                                setDeleteId(chatId);
                                setShowDeleteDialog(true);
                              }}
                              setOpenMobile={setOpenMobile}
                              chatIndex={globalIndex++}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
            </SidebarMenu>

            <motion.div
              onViewportEnter={() => {
                if (!isValidating && !hasReachedEnd) {
                  setSize((size) => size + 1);
                }
              }}
            />

            {hasReachedEnd ? (
              <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2 mt-8">
                You have reached the end of your chat history.
              </div>
            ) : (
              <div className="p-2 text-zinc-500 dark:text-zinc-400 flex flex-row gap-2 items-center mt-8">
                <div className="animate-spin">
                  <LoaderIcon />
                </div>
                <div>Loading Chats...</div>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
