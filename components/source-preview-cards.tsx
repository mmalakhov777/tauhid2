'use client';

import { cn } from '@/lib/utils';
import { determineCitationType, formatBookOrNamespace, filterEligibleCitations } from './citation-utils';

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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
      {/* First 3 citations */}
      {eligibleCitations.slice(0, 3).map((item: {citation: any, i: number}) => {
        const { citation, i } = item;
        const type = determineCitationType(citation);
        const isYouTube = type === 'YT';
        const isFatawaQaziKhan = type === 'CLS' && (
          citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')
        );
        const isRaddulMuhtar = type === 'CLS' && citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol');
        
        return (
          <div 
            key={`preview-${citation.id || i}`}
            className="rounded border bg-muted/20 p-2 text-xs cursor-pointer hover:bg-muted/30 transition-colors flex flex-col"
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
            <div className="font-semibold text-foreground mb-1 line-clamp-2">
              {type === 'RIS' && citation.metadata?.book_name 
                ? formatBookOrNamespace(citation.metadata.book_name)
                : type === 'YT' && citation.namespace
                ? citation.namespace.replace(/_/g, ' ')
                : type === 'CLS' && citation.metadata?.source
                ? citation.metadata.source
                : citation.text?.slice(0, 50) || '[No text]'}...
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-auto">
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
              {type === 'YT' && citation.metadata?.question && (
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2 italic">
                  {citation.metadata.question}
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* More sources card if there are more than 3 */}
      {eligibleCitations.length > 3 && (
        <div 
          key="more-sources-card"
          className="rounded border bg-secondary/50 p-2 text-xs cursor-pointer hover:bg-secondary/70 transition-colors flex items-center justify-center"
          onClick={() => setActiveTab('sources')}
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              +{eligibleCitations.length - 3}
            </div>
            <div className="text-[10px] text-muted-foreground">
              more sources
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 