'use client';

import { cn } from '@/lib/utils';
import { determineCitationType, formatBookOrNamespace, filterEligibleCitations } from './citation-utils';
import { Youtube } from 'lucide-react';

interface SourcePreviewCardsProps {
  vectorSearchData: {
    citations: any[];
  };
  setModalCitation: (citation: { citation: any; number: number } | null) => void;
  setActiveTab: (tab: string) => void;
  setHighlightedCitation: (citation: number | null) => void;
}

export function SourcePreviewCards({ 
  vectorSearchData, 
  setModalCitation, 
  setActiveTab, 
  setHighlightedCitation 
}: SourcePreviewCardsProps) {
  const eligibleCitations = filterEligibleCitations(vectorSearchData.citations);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-2">
      {/* First 3 citations */}
      {eligibleCitations.slice(0, 3).map((item: {citation: any, i: number}) => {
        const { citation, i } = item;
        const type = determineCitationType(citation);
        const isYouTube = type === 'YT';
        const isFatawaQaziKhan = type === 'CLS' && (
          citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')
        );
        const isRaddulMuhtar = type === 'CLS' && citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol');
        const thumbnailUrl = citation.metadata?.thumbnail_url;
        
        return (
          <div 
            key={`preview-${citation.id || i}`}
            className={cn(
              "rounded-md border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden h-20",
              isYouTube ? "flex flex-col" : "flex"
            )}
            onClick={() => {
              console.log('🎯 Preview card clicked - Citation Index:', i);
              console.log('🎯 Preview card clicked - Citation Data:', citation);
              console.log('🎯 Preview card clicked - Citation Metadata:', citation.metadata);
              console.log('🎯 Preview card clicked - Citation Namespace:', citation.namespace);
              setModalCitation({ 
                citation: citation, 
                number: i + 1
              });
              setHighlightedCitation(null);
            }}
          >
            {isYouTube ? (
              // YouTube layout - Cover fills entire card
              <>
                {thumbnailUrl ? (
                  <div className="relative w-full h-full bg-muted">
                    <img 
                      src={thumbnailUrl} 
                      alt="YouTube thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0.5 right-0.5">
                      <Youtube className="size-2.5 text-white drop-shadow-lg" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Youtube className="size-4 text-muted-foreground" />
                  </div>
                )}
              </>
            ) : (
              // Other types layout - Cover in first 30%
              <>
                {/* Cover Image - 30% */}
                <div className="w-[30%] shrink-0">
                  <div className="relative h-full bg-muted">
                    {type === 'RIS' ? (
                      <img 
                        src={`/images/risaleinur/${citation.metadata?.book_name || 'placeholder'}.png`}
                        alt={`${citation.metadata?.book_name?.replace(/_/g, ' ').replace(/-/g, ' ') || 'Risale-i Nur'} cover`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.png';
                        }}
                      />
                    ) : isFatawaQaziKhan ? (
                      <img 
                        src="/images/fatawa-qazi-khan.png" 
                        alt="Fatawa Qazi Khan cover"
                        className="w-full h-full object-cover"
                      />
                    ) : isRaddulMuhtar ? (
                      <img 
                        src="/images/raddul-muhtaar.png" 
                        alt="Rad-ul-Muhtar cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <div className="text-xs text-muted-foreground">📚</div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Content - 70% */}
                <div className="flex-1 p-2 flex flex-col justify-center">
                  <div className="font-semibold text-card-foreground mb-1 line-clamp-2 text-xs">
                    {type === 'RIS' && citation.metadata?.book_name 
                      ? formatBookOrNamespace(citation.metadata.book_name)
                      : type === 'CLS' && citation.metadata?.source
                      ? citation.metadata.source
                      : citation.text?.slice(0, 50) || '[No text]'}...
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-auto">
                    {type === 'RIS' && citation.metadata?.page_number && (
                      <span className="truncate">Pg: {citation.metadata.page_number}</span>
                    )}
                    {type === 'CLS' && !isFatawaQaziKhan && citation.metadata?.source && citation.metadata?.page_number && (
                      <span className="truncate">Pg: {citation.metadata.page_number}</span>
                    )}
                    {type === 'CLS' && isFatawaQaziKhan && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isRaddulMuhtar && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
      
      {/* More sources card if there are more than 3 */}
      {eligibleCitations.length > 3 && (
        <div 
          key="more-sources-card"
          className="rounded-md border border-border bg-secondary/50 p-2 text-xs cursor-pointer hover:bg-secondary/70 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md h-20"
          onClick={() => setActiveTab('sources')}
        >
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              +{eligibleCitations.length - 3}
            </div>
            <div className="text-[9px] text-muted-foreground">
              more sources
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 