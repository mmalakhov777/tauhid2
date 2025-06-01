'use client';

import { cn } from '@/lib/utils';
import { Youtube } from 'lucide-react';
import { determineCitationType, filterEligibleCitations } from './citation-utils';

interface SourcesTabProps {
  vectorSearchData: {
    citations: any[];
  };
  setModalCitation: (citation: { citation: any; number: number } | null) => void;
}

export function SourcesTab({ vectorSearchData, setModalCitation }: SourcesTabProps) {
  const eligibleCitations = filterEligibleCitations(vectorSearchData.citations);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {eligibleCitations.map((item: {citation: any, i: number}) => {
        const { citation, i } = item;
        const type = determineCitationType(citation);
        const isYouTube = type === 'YT' || type === 'youtube';
        const thumbnailUrl = citation.metadata?.thumbnail_url;
        const isFatawaQaziKhan = type === 'CLS' && (
          citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')
        );
        const isRaddulMuhtar = type === 'CLS' && citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol');
        
        return (
          <div 
            key={`source-${citation.id || i}`} 
            className={cn(
              "rounded border bg-muted/40 flex flex-col transition-all cursor-pointer hover:bg-muted/30 overflow-hidden",
              isYouTube && "h-full p-0"
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
            }}
          >
            {/* YouTube Thumbnail */}
            {isYouTube && thumbnailUrl && (
              <div className="relative size-full aspect-video rounded overflow-hidden bg-muted group">
                <img 
                  src={thumbnailUrl} 
                  alt="YouTube video thumbnail"
                  className="size-full object-cover"
                />
                {citation.namespace && (
                  <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Youtube className="size-3" />
                    <span>{citation.namespace.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {citation.metadata?.timestamp && typeof citation.metadata.timestamp === 'number' && !isNaN(citation.metadata.timestamp) && (
                  <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {Math.floor(citation.metadata.timestamp / 60)}:{(citation.metadata.timestamp % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            )}
            
            {/* Classical Source Layout with 40/60 split */}
            {type === 'CLS' && isFatawaQaziKhan ? (
              <div className="flex gap-3">
                {/* Cover Image - 40% */}
                <div className="w-2/5 shrink-0">
                  <div className="relative size-full rounded-l overflow-hidden bg-muted">
                    <img 
                      src="/images/fatawa-qazi-khan.png" 
                      alt="Fatawa Qazi Khan cover"
                      className="size-full object-cover object-center"
                    />
                  </div>
                </div>
                
                {/* Content - 60% */}
                <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                  {/* Source as title */}
                  {citation.metadata?.source && (
                    <div className="text-sm font-semibold text-foreground line-clamp-1">
                      {citation.metadata.source}
                    </div>
                  )}
                  
                  {/* Text preview */}
                  <div className="text-[10px] text-muted-foreground line-clamp-2 italic">
                    {citation.text?.slice(0, 80)}...
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                    <span className="truncate">Fatawa Qazi Khan</span>
                    {citation.metadata?.volume && (
                      <div>Volume: {citation.metadata.volume}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : type === 'CLS' && isRaddulMuhtar ? (
              <div className="flex gap-3">
                {/* Cover Image - 40% */}
                <div className="w-2/5 shrink-0">
                  <div className="relative size-full rounded-l overflow-hidden bg-muted">
                    <img 
                      src="/images/raddul-muhtaar.png" 
                      alt="Rad-ul-Muhtar cover"
                      className="size-full object-cover object-center"
                    />
                  </div>
                </div>
                
                {/* Content - 60% */}
                <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                  {/* Source as title */}
                  {citation.metadata?.source && (
                    <div className="text-sm font-semibold text-foreground line-clamp-1">
                      {citation.metadata.source}
                    </div>
                  )}
                  
                  {/* Text preview */}
                  <div className="text-[10px] text-muted-foreground line-clamp-2 italic">
                    {citation.text?.slice(0, 80)}...
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                    <span className="truncate">Rad-ul-Muhtar</span>
                    {citation.metadata?.volume && (
                      <div>Volume: {citation.metadata.volume}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : type === 'RIS' ? (
              // RIS Source Layout with 40/60 split
              <div className="flex gap-0 h-full">
                {/* Cover Image - 40% */}
                <div className="w-2/5 shrink-0">
                  <div className="relative size-full overflow-hidden bg-muted">
                    <img 
                      src={`/images/risaleinur/${citation.metadata?.book_name || 'placeholder'}.png`}
                      alt={`${citation.metadata?.book_name?.replace(/_/g, ' ').replace(/-/g, ' ') || 'Risale-i Nur'} cover`}
                      className="size-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/fatawa-qazi-khan.png';
                      }}
                    />
                  </div>
                </div>
                
                {/* Content - 60% */}
                <div className="flex-1 flex flex-col justify-center gap-2">
                  {/* Book name as title */}
                  {citation.metadata?.book_name && (
                    <div className="text-sm font-semibold text-foreground line-clamp-1">
                      {citation.metadata.book_name.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                    </div>
                  )}
                  
                  {/* Text preview */}
                  <div className="text-[10px] text-muted-foreground line-clamp-2 italic">
                    {citation.text?.slice(0, 80)}...
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                    <span className="truncate">Risale-i Nur</span>
                    {citation.metadata?.page_number && (
                      <div>Page: {citation.metadata.page_number}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Other types
              <div>
                {!isYouTube && (
                  <>
                    {/* Source text preview */}
                    <div className="text-xs font-semibold text-foreground line-clamp-1">
                      {type === 'CLS' && citation.metadata?.source 
                        ? citation.metadata.source
                        : citation.text?.slice(0, 60) || '[No text]'}...
                    </div>
                    
                    {/* Preview */}
                    <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                      {citation.text?.slice(0, 100)}...
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                      {type !== 'YT' && type !== 'RIS' && (
                        <div className="flex items-center gap-1">
                          <span className="px-1 py-0.5 rounded bg-background text-[9px]">
                            {type}
                          </span>
                          <span className="truncate">{citation.metadata?.source || 'Unknown'}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* For YouTube without thumbnail */}
                {isYouTube && !thumbnailUrl && (
                  <div className="space-y-1 flex-1 flex flex-col">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Youtube className="size-3" />
                      {citation.namespace?.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2">
                      {citation.text?.slice(0, 100)}...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 