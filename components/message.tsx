'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
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
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showRawData, setShowRawData] = useState(false);
  const [activeTab, setActiveTab] = useState('response');
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const [modalCitation, setModalCitation] = useState<{ citation: any; number: number } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(globalDebugEnabled);
  const [isQueryMappingExpanded, setIsQueryMappingExpanded] = useState(false);

  // Listen for debug toggle events
  useEffect(() => {
    const handleDebugToggle = () => {
      setDebugEnabled(globalDebugEnabled);
    };
    
    window.addEventListener('debugToggled', handleDebugToggle);
    return () => window.removeEventListener('debugToggled', handleDebugToggle);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key={`message-${message.id}`}
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
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
                            <TooltipContent>Edit message</TooltipContent>
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
                                <SourcePreviewCards
                                  vectorSearchData={vectorSearchData}
                                  setModalCitation={setModalCitation}
                                  setActiveTab={setActiveTab}
                                  setHighlightedCitation={setHighlightedCitation}
                                />

                                {/* Tabs */}
                                <div className="flex border-b">
                                  <button
                                    onClick={() => setActiveTab('response')}
                                    className={cn(
                                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                      activeTab === 'response' 
                                        ? "border-foreground text-foreground" 
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    Response
                                  </button>
                                  <button
                                    onClick={() => setActiveTab('sources')}
                                    className={cn(
                                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                      activeTab === 'sources' 
                                        ? "border-foreground text-foreground" 
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    Sources ({filterEligibleCitations(vectorSearchData.citations).length})
                                  </button>
                                  <button
                                    onClick={() => setActiveTab('tasks')}
                                    className={cn(
                                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                      activeTab === 'tasks' 
                                        ? "border-foreground text-foreground" 
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    Tasks
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

                                  {activeTab === 'tasks' && (
                                    <div className="space-y-4">
                                      {/* Reasoning Section - Show when answer is ready */}
                                      {(() => {
                                        const reasoningPart = message.parts?.find(p => p.type === 'reasoning');
                                        const hasTextContent = part.text && part.text.trim().length > 0;
                                        
                                        if (reasoningPart && hasTextContent) {
                                          return (
                                            <div>
                                              <div className="text-sm text-muted-foreground mb-3 leading-relaxed">
                                                See the AI&apos;s step-by-step thought process and reasoning behind this response. This shows how the AI analyzed your question and planned its approach.
                                              </div>
                                              <MessageReasoning
                                                isLoading={false}
                                                reasoning={reasoningPart.reasoning}
                                                initiallyExpanded={false}
                                              />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}

                                      {/* Query to Citations Mapping */}
                                      {vectorSearchData.citations && vectorSearchData.improvedQueries && (
                                        <div>
                                          <div className="text-sm text-muted-foreground mb-3 leading-relaxed">
                                            Explore how your question was broken down into specific search queries and see which sources were found for each query. This transparency shows the search process behind the response.
                                          </div>
                                          <div className="flex flex-row gap-2 items-center mb-2">
                                            <div className="font-medium">Query to Citations Mapping</div>
                                            <button
                                              type="button"
                                              className="cursor-pointer"
                                              onClick={() => {
                                                setIsQueryMappingExpanded(!isQueryMappingExpanded);
                                              }}
                                            >
                                              <motion.div
                                                animate={{ rotate: isQueryMappingExpanded ? 0 : -90 }}
                                                transition={{ duration: 0.2 }}
                                              >
                                                <ChevronDownIcon />
                                              </motion.div>
                                            </button>
                                          </div>
                                          
                                          <AnimatePresence initial={false}>
                                            {isQueryMappingExpanded && (
                                              <motion.div
                                                key="query-mapping-content"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                style={{ overflow: 'hidden' }}
                                              >
                                                <div className="bg-muted/30 p-3 rounded space-y-3">
                                                  {(() => {
                                                    const hasQueryField = vectorSearchData.citations.some((c: any) => c.query !== undefined);
                                                    
                                                    // If no citations have query field, show a single message
                                                    if (!hasQueryField) {
                                                      return (
                                                        <div className="text-sm text-muted-foreground italic">
                                                          Query tracking not available for this search (performed before query tracking was implemented)
                                                        </div>
                                                      );
                                                    }
                                                    
                                                    // Otherwise show the mapping
                                                    return vectorSearchData.improvedQueries.map((query: string, qIndex: number) => {
                                                      const citationsForQuery = vectorSearchData.citations.filter((c: any) => c.query === query);
                                                      
                                                      return (
                                                        <div key={qIndex} className="border-b border-muted pb-2 last:border-0">
                                                          <div className="font-semibold text-sm mb-1">Query {qIndex + 1}: &quot;{query}&quot;</div>
                                                          <div className="pl-4 space-y-1">
                                                            {citationsForQuery.length > 0 ? (
                                                              citationsForQuery.map((c: any, cIndex: number) => {
                                                                // Determine the type based on various indicators
                                                                let type = 'unknown';
                                                                if (c.metadata?.type) {
                                                                  type = c.metadata.type;
                                                                } else if (c.namespace) {
                                                                  // Determine type from namespace
                                                                  if (RIS_NAMESPACES.includes(c.namespace)) {
                                                                    type = 'RIS';
                                                                  } else if (YT_NAMESPACES.includes(c.namespace)) {
                                                                    type = 'YT';
                                                                  }
                                                                } else if (!c.metadata?.type && !c.namespace) {
                                                                  // If no type and no namespace, likely classic
                                                                  type = 'CLS';
                                                                }

                                                                const originalIndex = vectorSearchData.citations.findIndex((vc: any) => vc.id === c.id);
                                                                
                                                                return (
                                                                  <div 
                                                                    key={`${qIndex}-${cIndex}-${c.id || 'no-id'}`}
                                                                    className="text-xs text-muted-foreground p-1 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                                                                    onClick={() => {
                                                                      if (originalIndex !== -1) {
                                                                        setModalCitation({
                                                                          citation: c,
                                                                          number: originalIndex + 1
                                                                        });
                                                                      }
                                                                    }}
                                                                  >
                                                                    • {type === 'YT' ? <Youtube className="size-3 inline mr-1" /> : type === 'RIS' ? <BookOpen className="size-3 inline mr-1" /> : type === 'CLS' ? <ScrollText className="size-3 inline mr-1" /> : type} | {c.text?.slice(0, 120)}...
                                                                  </div>
                                                                );
                                                              })
                                                            ) : (
                                                              <div className="text-xs text-muted-foreground italic">No results for this query</div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    });
                                                  })()}
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      )}
                                    </div>
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
                        <div className="mt-4 border rounded-lg p-3 bg-muted/30">
                          <button
                            onClick={() => setShowRawData(!showRawData)}
                            className="text-sm font-semibold mb-2 flex items-center gap-2 hover:opacity-80"
                          >
                            {showRawData ? '▼' : '▶'} Raw Debug Data
                          </button>
                          
                          {showRawData && (
                            <div className="space-y-4 text-xs font-mono">
                              {/* Search Results Count */}
                              {vectorSearchData.citations && (
                                <div>
                                  <h4 className="font-semibold mb-1">Search Results Count (computed):</h4>
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
                                  <h4 className="font-semibold mb-1">Raw Citations ({vectorSearchData.citations.length} total):</h4>
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

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : null}
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
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

    return true;
  },
);

export const ThinkingMessage = ({ vectorSearchProgress }: { vectorSearchProgress?: any }) => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.5 } }}
      data-role={role}
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
                <div key={i} className="opacity-70">→ {q}</div>
              ))}
            </motion.div>
          )}

          {/* Skeleton citation cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded border bg-muted/40 p-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded w-16"></div>
                  <div className="h-5 bg-muted rounded w-20"></div>
                  <div className="h-5 bg-muted rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Skeleton text area for response */}
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
            <div className="h-4 bg-muted rounded w-4/6"></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
