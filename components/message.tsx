'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect, useRef } from 'react';
import type { Vote } from '@/lib/db/schema';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';

import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import { CitationMarker } from './citation-marker';
import { CitationModal } from './citation-modal';
import { Youtube, BookOpen, ScrollText } from 'lucide-react';
import { ChevronDownIcon } from './icons';
import { SourcesTab } from './sources-tab';
import { SourcePreviewCards } from './source-preview-cards';
import { determineCitationType, filterEligibleCitations, formatBookOrNamespace, RIS_NAMESPACES, YT_NAMESPACES } from './citation-utils';
import { SkeletonCard, SkeletonDots, SkeletonText } from './ui/skeleton';
import { useTelegramHaptics } from '@/hooks/use-telegram-haptics';
import { useTranslations } from '@/lib/i18n';

// Global debug state
let globalDebugEnabled = false;

// Add console command to toggle debug mode
if (typeof window !== 'undefined') {
  (window as any).toggleDebug = () => {
    globalDebugEnabled = !globalDebugEnabled;
    console.log(`Debug mode ${globalDebugEnabled ? 'enabled' : 'disabled'}. Refresh the page or trigger a re-render to see changes.`);
    // Trigger a re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('debugToggled'));
    return globalDebugEnabled;
  };
  console.log('Debug mode available. Use window.toggleDebug() to toggle.');
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
  vectorSearchData,
  isFirstAssistantMessagePart,
  allMessages,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  vectorSearchData?: any;
  isFirstAssistantMessagePart: boolean;
  allMessages?: UIMessage[];
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showRawData, setShowRawData] = useState(false);
  const [activeTab, setActiveTab] = useState('response');
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const [modalCitation, setModalCitation] = useState<{ citation: any; number: number } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(globalDebugEnabled);
  const [isQueryMappingExpanded, setIsQueryMappingExpanded] = useState(false);
  const { impactOccurred, selectionChanged } = useTelegramHaptics();
  const previousContentLengthRef = useRef(0);
  const { t } = useTranslations();

  // Listen for debug toggle events
  useEffect(() => {
    const handleDebugToggle = () => {
      setDebugEnabled(globalDebugEnabled);
    };
    
    window.addEventListener('debugToggled', handleDebugToggle);
    return () => window.removeEventListener('debugToggled', handleDebugToggle);
  }, []);

  // Haptic feedback when new message appears
  useEffect(() => {
    if (message.role === 'assistant' && isLoading) {
      // Light haptic when assistant message starts appearing
      impactOccurred('light');
    }
  }, [message.id, message.role, isLoading, impactOccurred]);

  // Haptic feedback for streaming chunks
  useEffect(() => {
    if (message.role === 'assistant' && isLoading && message.parts) {
      // Track the content length to detect new chunks
      const currentContent = message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');
      
      const currentLength = currentContent.length;
      
      // Soft haptic for each new chunk when content grows
      if (currentLength > previousContentLengthRef.current && previousContentLengthRef.current > 0) {
        impactOccurred('soft');
      }
      
      previousContentLengthRef.current = currentLength;
    }
  }, [message.parts, message.role, isLoading, impactOccurred]);

  // Haptic feedback for tab changes
  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      selectionChanged();
      setActiveTab(newTab);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key={`message-${message.id}`}
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
        style={{ isolation: 'isolate' }}
      >
        <div
          className={cn(
            'flex gap-4 w-full',
            {
              'w-full': mode === 'edit',
            },
          )}
        >
          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-row justify-end gap-2"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                // Check if there's a text part after this reasoning part with content
                const textPartAfter = message.parts?.find((p, idx) => idx > index && p.type === 'text');
                const hasTextContent = !!(textPartAfter && textPartAfter.type === 'text' && textPartAfter.text && textPartAfter.text.trim().length > 0);
                
                // If there's text content, don't render reasoning here - it will be in the Tasks tab
                if (hasTextContent) {
                  return null;
                }
                
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                    autoCollapse={hasTextContent}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <div className="flex flex-row gap-2 items-start">
                        {/* {message.role === 'user' && !isReadonly && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                data-testid="message-edit-button"
                                variant="ghost"
                                className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                                onClick={() => {
                                  setMode('edit');
                                }}
                              >
                                <PencilEditIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('message.editMessage')}</TooltipContent>
                          </Tooltip>
                        )} */}

                        {message.role === 'user' ? (
                          <div
                            data-testid="message-content"
                            className={cn('flex flex-col gap-4 text-2xl font-bold', {
                              // 'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                              //  message.role === 'user',
                            })}
                          >
                            {(() => {
                              const text = sanitizeText(part.text);
                              console.log('🔍 User message text:', text);
                              
                              // Check if text contains language instruction
                              const languageMatch = text.match(/\[Answer in ([^\]]+)\]/);
                              console.log('🔍 Language match:', languageMatch);
                              
                              if (languageMatch) {
                                const languageName = languageMatch[1];
                                const mainText = text.replace(/\n*\[Answer in [^\]]+\]\s*$/, '').trim();
                                console.log('🔍 Language name:', languageName);
                                console.log('🔍 Main text:', mainText);
                                
                                return (
                                  <div className="flex flex-col gap-2">
                                    <Markdown onCitationClick={(citationNumber) => {
                                      const citation = vectorSearchData.citations[citationNumber - 1];
                                      if (citation) {
                                        console.log('🔍 Citation clicked in text - Citation Number:', citationNumber);
                                        console.log('🔍 Citation clicked in text - Citation Data:', citation);
                                        console.log('🔍 Citation clicked in text - Citation Metadata:', citation.metadata);
                                        console.log('🔍 Citation clicked in text - Citation Namespace:', citation.namespace);
                                        setModalCitation({ 
                                          citation, 
                                          number: citationNumber
                                        });
                                      } else {
                                        console.error('❌ Citation not found for number:', citationNumber);
                                      }
                                    }}>
                                      {mainText}
                                    </Markdown>
                                    {/* Language badge hidden but functionality preserved */}
                                  </div>
                                );
                              }
                              return (
                                <Markdown onCitationClick={(citationNumber) => {
                                  const citation = vectorSearchData.citations[citationNumber - 1];
                                  if (citation) {
                                    console.log('🔍 Citation clicked in text - Citation Number:', citationNumber);
                                    console.log('🔍 Citation clicked in text - Citation Data:', citation);
                                    console.log('🔍 Citation clicked in text - Citation Metadata:', citation.metadata);
                                    console.log('🔍 Citation clicked in text - Citation Namespace:', citation.namespace);
                                    setModalCitation({ 
                                      citation, 
                                      number: citationNumber
                                    });
                                  } else {
                                    console.error('❌ Citation not found for number:', citationNumber);
                                  }
                                }}>
                                  {text}
                                </Markdown>
                              );
                            })()}
                          </div>
                        ) : (
                          // Assistant message with tabs
                          <div className="flex flex-col gap-4 w-full">
                            {vectorSearchData && vectorSearchData.citations && vectorSearchData.citations.length > 0 ? (
                              <>
                                {/* Source Preview Cards - Above tabs */}
                                <div className="hidden md:block">
                                  <SourcePreviewCards
                                    vectorSearchData={vectorSearchData}
                                    setModalCitation={setModalCitation}
                                    setActiveTab={setActiveTab}
                                    setHighlightedCitation={setHighlightedCitation}
                                  />
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b">
                                  <button
                                    onClick={() => handleTabChange('response')}
                                    className={cn(
                                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                      activeTab === 'response' 
                                        ? "border-foreground text-foreground" 
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {t('message.response')}
                                  </button>
                                  <button
                                    onClick={() => handleTabChange('sources')}
                                    className={cn(
                                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                      activeTab === 'sources' 
                                        ? "border-foreground text-foreground" 
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {t('message.sources')} ({filterEligibleCitations(vectorSearchData.citations).length})
                                  </button>
                                </div>

                                {/* Tab Content */}
                                <div className="mt-4">
                                  {activeTab === 'response' && (
                                    <div data-testid="message-content">
                                      <Markdown onCitationClick={(citationNumber) => {
                                        const citation = vectorSearchData.citations[citationNumber - 1];
                                        if (citation) {
                                          console.log('🔍 Citation clicked in text - Citation Number:', citationNumber);
                                          console.log('🔍 Citation clicked in text - Citation Data:', citation);
                                          console.log('🔍 Citation clicked in text - Citation Metadata:', citation.metadata);
                                          console.log('🔍 Citation clicked in text - Citation Namespace:', citation.namespace);
                                          setModalCitation({ 
                                            citation, 
                                            number: citationNumber
                                          });
                                        } else {
                                          console.error('❌ Citation not found for number:', citationNumber);
                                        }
                                      }}>
                                        {sanitizeText(part.text)}
                                      </Markdown>
                                    </div>
                                  )}

                                  {activeTab === 'sources' && (
                                    <SourcesTab
                                      vectorSearchData={vectorSearchData}
                                      setModalCitation={setModalCitation}
                                    />
                                  )}
                                </div>
                              </>
                            ) : (
                              // No vector search data, just show the response
                              <div data-testid="message-content">
                                <Markdown>{sanitizeText(part.text)}</Markdown>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Raw Debug Data - Always at the bottom */}
                      {message.role === 'assistant' && vectorSearchData && index === message.parts.length - 1 && debugEnabled && (
                        <div className="mt-4 border border-border rounded-lg p-3 bg-muted/50">
                          <button
                            onClick={() => setShowRawData(!showRawData)}
                            className="text-sm font-semibold mb-2 flex items-center gap-2 hover:opacity-80"
                          >
                            {showRawData ? '▼' : '▶'} {t('message.rawDebugData')}
                          </button>
                          
                          {showRawData && (
                            <div className="space-y-4 text-xs font-mono">
                              {/* Search Results Count */}
                              {vectorSearchData.citations && (
                                <div>
                                  <h4 className="font-semibold mb-1">{t('message.searchResultsCount')}</h4>
                                  <pre className="bg-background p-2 rounded overflow-auto">
                                    {JSON.stringify({
                                      classic: vectorSearchData.citations.filter((c: any) => determineCitationType(c) === 'CLS').length,
                                      modern: vectorSearchData.citations.filter((c: any) => determineCitationType(c) === 'MOD').length,
                                      risale: vectorSearchData.citations.filter((c: any) => determineCitationType(c) === 'RIS').length,
                                      youtube: vectorSearchData.citations.filter((c: any) => determineCitationType(c) === 'YT').length,
                                      unknown: vectorSearchData.citations.filter((c: any) => !['CLS', 'MOD', 'RIS', 'YT'].includes(determineCitationType(c))).length,
                                    }, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {/* Raw Citations */}
                              {vectorSearchData.citations && (
                                <div>
                                  <h4 className="font-semibold mb-1">{t('message.rawCitations')} ({vectorSearchData.citations.length} {t('message.total')}):</h4>
                                  <pre className="bg-background p-2 rounded overflow-auto max-h-96">
                                    {JSON.stringify(vectorSearchData.citations, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }


            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
      
      {/* Citation Modal */}
      {vectorSearchData && modalCitation && (
        <CitationModal
          isOpen={!!modalCitation}
          onClose={() => setModalCitation(null)}
          citation={modalCitation.citation}
          citationNumber={modalCitation.number}
          allMessages={allMessages}
        />
      )}
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (!equal(prevProps.vectorSearchData, nextProps.vectorSearchData)) return false;
    if (!equal(prevProps.allMessages, nextProps.allMessages)) return false;

    return true;
  },
);

export const ThinkingMessage = ({ vectorSearchProgress }: { vectorSearchProgress?: any }) => {
  const role = 'assistant';
  const { impactOccurred } = useTelegramHaptics();
  const { t } = useTranslations();

  // Haptic feedback when thinking message appears
  useEffect(() => {
    impactOccurred('soft');
  }, [impactOccurred]);

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.5 } }}
      data-role={role}
      style={{ isolation: 'isolate' }}
    >
      <div
        className={cn(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="flex flex-col gap-4 w-full">
          {/* Show improved queries if available */}
          {vectorSearchProgress?.improvedQueries && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1 text-xs text-muted-foreground"
            >
              {vectorSearchProgress.improvedQueries.map((q: string, i: number) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 0.7, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <span>→</span>
                  <span>{q}</span>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Beautiful animated skeleton citation cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <SkeletonCard key={i} delay={i * 0.2} />
            ))}
          </div>

          {/* Enhanced thinking indicator with dots and text */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-3 text-muted-foreground"
          >
            <SkeletonDots />
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-sm font-medium"
            >
              {t('message.thinkingAndSearching')}
            </motion.span>
          </motion.div>

          {/* Beautiful animated text skeleton for response */}
          <SkeletonText lines={3} delay={1} />
        </div>
      </div>
    </motion.div>
  );
};
