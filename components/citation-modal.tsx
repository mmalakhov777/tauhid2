'use client';

import { X, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CitationMarker } from './citation-marker';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: any;
  citationNumber: number;
}

export function CitationModal({ isOpen, onClose, citation, citationNumber }: CitationModalProps) {
  // Log what data is received by the modal
  console.log('🔧 CitationModal received - isOpen:', isOpen);
  console.log('🔧 CitationModal received - citationNumber:', citationNumber);
  console.log('🔧 CitationModal received - citation:', citation);
  console.log('🔧 CitationModal received - citation.metadata:', citation?.metadata);
  console.log('🔧 CitationModal received - citation.namespace:', citation?.namespace);
  
  if (!citation) return null;

  // Determine the type
  let type = 'unknown';
  if (citation.metadata?.type) {
    type = citation.metadata.type;
  } else if (citation.namespace) {
    if (['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(citation.namespace)) {
      type = 'RIS';
    } else if (['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance', '2004', 'MercifulServant', '1572', 'Towards_Eternity'].includes(citation.namespace)) {
      type = 'YT';
    }
  } else if (!citation.metadata?.type && !citation.namespace) {
    type = 'CLS';
  }

  const typeLabels: Record<string, string> = {
    'RIS': 'Risale-i Nur',
    'YT': 'YouTube',
    'CLS': 'Classical Source',
    'classic': 'Classical Source',
    'modern': 'Modern Source',
    'risale': 'Risale-i Nur',
    'youtube': 'YouTube',
    'unknown': 'Unknown Source'
  };

  const isYouTube = type === 'YT' || type === 'youtube';
  const isClassical = type === 'CLS' || type === 'classic';
  const isRisale = type === 'RIS' || type === 'risale';
  const thumbnailUrl = citation.metadata?.thumbnail_url;
  const videoId = citation.metadata?.video_id;
  const timestamp = citation.metadata?.timestamp;
  
  // Check if this is Fatawa Qazi Khan
  const isFatawaQaziKhan = isClassical && (
    citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')
  );

  // Check if this is Rad-ul-Muhtar
  const isRaddulMuhtar = isClassical && citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol');

  // Build YouTube embed URL with timestamp if available
  let embedUrl = '';
  if (videoId) {
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
    if (timestamp) {
      // YouTube embed uses 'start' parameter for seconds
      embedUrl += `?start=${timestamp}`;
    }
  }

  // Build PDF URL for Risale-i Nur sources
  let pdfUrl = '';
  if (isRisale) {
    // Get the book identifier from namespace or book_name
    const bookIdentifier = citation.namespace || citation.metadata?.book_name;
    if (bookIdentifier) {
      // Map to PDF filename
      const pdfFilename = `${bookIdentifier}.pdf`;
      // Build the URL path
      pdfUrl = `/pdfs/Risale-i Nur Bediuzzaman Said Nursi/${pdfFilename}`;
      
      // If page_number is available, add it to the URL
      if (citation.metadata?.page_number) {
        pdfUrl += `#page=${citation.metadata.page_number}`;
      }
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l shadow-xl z-[60] overflow-hidden"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <CitationMarker number={citationNumber} className="cursor-default" />
                  <h2 className="text-lg font-semibold">Citation Details</h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* YouTube Video/Thumbnail */}
                {isYouTube && (videoId || thumbnailUrl) && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                    {videoId ? (
                      <iframe
                        key={`youtube-${timestamp}`}
                        src={embedUrl}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    ) : thumbnailUrl ? (
                      <img 
                        src={thumbnailUrl} 
                        alt="YouTube video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                )}
                
                {/* Risale-i Nur PDF Viewer */}
                {isRisale && pdfUrl && (
                  <div className="relative w-full h-[600px] rounded-lg overflow-hidden bg-muted border">
                    <iframe
                      key={`pdf-${citation.metadata?.page_number}`}
                      src={pdfUrl}
                      title="Risale-i Nur PDF"
                      className="w-full h-full"
                      style={{ border: 'none' }}
                    />
                  </div>
                )}
                
                {/* Classical Source with 40/60 split layout for Fatawa Qazi Khan */}
                {isFatawaQaziKhan && (
                  <div className="rounded-lg border bg-muted/20 overflow-hidden">
                    <div className="flex gap-0">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/fatawa-qazi-khan.png" 
                            alt="Fatawa Qazi Khan cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-3 p-4">
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-base font-semibold text-foreground">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Interpretation as description */}
                        {citation.metadata?.interpretation && (
                          <div className="text-sm text-muted-foreground italic">
                            {citation.metadata.interpretation}
                          </div>
                        )}
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-auto">
                          {/* Source info */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs">Fatawa Qazi Khan</span>
                          </div>
                          
                          {/* Volume info */}
                          {citation.metadata?.volume && (
                            <div className="text-xs">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Classical Source with 40/60 split layout for Rad-ul-Muhtar */}
                {isRaddulMuhtar && (
                  <div className="rounded-lg border bg-muted/20 overflow-hidden">
                    <div className="flex gap-0">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/raddul-muhtaar.png" 
                            alt="Rad-ul-Muhtar cover"
                            className="w-full h-full object-cover object-center"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-3 p-4">
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-base font-semibold text-foreground">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Interpretation as description */}
                        {citation.metadata?.interpretation && (
                          <div className="text-sm text-muted-foreground italic">
                            {citation.metadata.interpretation}
                          </div>
                        )}
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-auto">
                          {/* Source info */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs">Rad-ul-Muhtar</span>
                          </div>
                          
                          {/* Volume info */}
                          {citation.metadata?.volume && (
                            <div className="text-xs">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Source Type */}
                {!isYouTube && !isFatawaQaziKhan && !isRaddulMuhtar && !isRisale && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Source Type</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {typeLabels[type] || type}
                      </span>
                    </div>
                  </div>
                )}

                {/* Full Text */}
                {!isYouTube && !isFatawaQaziKhan && !isRaddulMuhtar && !isRisale && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Full Text</h3>
                    <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed">
                      {citation.text || '[No text available]'}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div>
                  {!isYouTube && !isFatawaQaziKhan && !isRaddulMuhtar && !isRisale && (
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Metadata</h3>
                  )}
                  <div className="space-y-2">
                    {isYouTube ? (
                      // YouTube-specific fields only
                      <>
                        {citation.metadata?.author && (
                          <div className="flex items-center gap-2 py-2">
                            <Youtube className="w-5 h-5 text-red-600" />
                            <span className="text-base font-medium">{citation.metadata.author}</span>
                          </div>
                        )}
                        
                        {citation.metadata?.timestamp && typeof citation.metadata.timestamp === 'number' && !isNaN(citation.metadata.timestamp) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Starting at</span>
                            <span className="font-mono font-medium">
                              {Math.floor(citation.metadata.timestamp / 60)}:{(citation.metadata.timestamp % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                        )}
                        
                        {citation.metadata?.question && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Question</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.question}</div>
                          </div>
                        )}
                        
                        {citation.metadata?.answer && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Answer</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.answer}</div>
                          </div>
                        )}
                        
                        {citation.metadata?.context && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Context</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.context}</div>
                          </div>
                        )}
                      </>
                    ) : isClassical ? (
                      // Classical source - show only specific fields in user-friendly format
                      <>
                        {citation.metadata?.question && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Question</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.question}</div>
                          </div>
                        )}
                        
                        {citation.metadata?.answer && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Answer</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.answer}</div>
                          </div>
                        )}
                        
                        {citation.metadata?.interpretation && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Interpretation</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.interpretation}</div>
                          </div>
                        )}
                        
                        {citation.metadata?.modern_usage && (
                          <div className="mt-4">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">Modern Usage</div>
                            <div className="text-sm bg-muted/30 rounded-lg p-3">{citation.metadata.modern_usage}</div>
                          </div>
                        )}
                      </>
                    ) : isRisale ? (
                      // Risale-i Nur - show only book_name, page_number, and Search Query
                      <>
                        {/* Metadata - Only specific fields */}
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Metadata</h3>
                        
                        {citation.metadata?.book_name && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">Book Name</span>
                            <span className="text-sm font-mono">{citation.metadata.book_name}</span>
                          </div>
                        )}
                        
                        {citation.metadata?.page_number && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">Page Number</span>
                            <span className="text-sm font-mono">{citation.metadata.page_number}</span>
                          </div>
                        )}

                        {citation.query && (
                          <div className="py-2 border-b">
                            <span className="text-sm text-muted-foreground">Search Query</span>
                            <div className="mt-1 text-sm font-mono bg-muted/50 rounded p-2">
                              {citation.query}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // Non-YouTube, non-Classical citations show all fields as before
                      <>
                        {citation.score !== undefined && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">Relevance Score</span>
                            <span className="text-sm font-mono">{citation.score.toFixed(4)}</span>
                          </div>
                        )}
                        
                        {citation.metadata?.source && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">Source</span>
                            <span className="text-sm font-mono">{citation.metadata.source}</span>
                          </div>
                        )}
                        
                        {citation.namespace && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">Namespace</span>
                            <span className="text-sm font-mono">{citation.namespace}</span>
                          </div>
                        )}
                        
                        {citation.id && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">ID</span>
                            <span className="text-xs font-mono">{citation.id}</span>
                          </div>
                        )}

                        {citation.query && (
                          <div className="py-2 border-b">
                            <span className="text-sm text-muted-foreground">Search Query</span>
                            <div className="mt-1 text-sm font-mono bg-muted/50 rounded p-2">
                              {citation.query}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Additional metadata fields */}
                {!isYouTube && !isFatawaQaziKhan && !isRaddulMuhtar && !isRisale && citation.metadata && Object.keys(citation.metadata).length > 1 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Additional Information</h3>
                    <div className="space-y-2">
                      {Object.entries(citation.metadata).map(([key, value]) => {
                        // Always exclude these fields
                        if (key === 'source' || key === 'type' || key === 'thumbnail_url' || key === 'video_id' || key === 'timestamp') return null;
                        
                        return (
                          <div key={key} className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">{key}</span>
                            <span className="text-sm">{String(value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
} 