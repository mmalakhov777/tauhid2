'use client';

import { cn } from '@/lib/utils';
import { determineCitationType, formatBookOrNamespace, filterEligibleCitations } from './citation-utils';
import { Youtube, ScrollText } from 'lucide-react';

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

  // Sort citations by category priority: direct first, then context
  const sortedCitations = eligibleCitations.sort((a, b) => {
    const categoryA = a.citation.category || 'context';
    const categoryB = b.citation.category || 'context';
    
    // Direct citations come first
    if (categoryA === 'direct' && categoryB !== 'direct') return -1;
    if (categoryB === 'direct' && categoryA !== 'direct') return 1;
    
    // If both are same category, maintain original order
    return 0;
  });

  // Function to clean numbers from text
  const cleanNumbers = (text: string | undefined) => {
    if (!text) return '';
    return text.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-2">
      {/* First 3 citations */}
      {sortedCitations.slice(0, 3).map((item: {citation: any, i: number}) => {
        const { citation, i } = item;
        const type = determineCitationType(citation);
        const isYouTube = type === 'YT';
        const isIslamQA = type === 'islamqa_fatwa';
        const isFatawaQaziKhan = type === 'CLS' && (
          citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')
        );
        const isRaddulMuhtar = type === 'CLS' && citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol');
        const isBadaiAlSanai = type === 'CLS' && citation.metadata?.source_file?.match(/Badai-al-Sanai-Urdu-Vol-\d+_hocr_searchtext\.txt\.gz/);
        const isSharhWiqayah = type === 'CLS' && citation.metadata?.source_file?.match(/SharhWiqayah\d+_hocr_searchtext\.txt\.gz/);
        const isAlHidaya = type === 'CLS' && (citation.metadata?.book_name === 'Al-Hidaya' || citation.metadata?.source_file === 'Al_Hidaya_in_English.txt');
        const isAlMabsut = type === 'CLS' && (citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_HanafiFiqh.txt' || citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_Index.txt');
        const isUsulAlFiqhSarakhsi = type === 'CLS' && citation.metadata?.source_file === 'UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.txt';
        const isNukatZiyadat = type === 'CLS' && citation.metadata?.source_file === 'Nukat_ZiyadatAlZiyadat_HanafiNotes.txt';
        const isSharhSiyarAlKabir = type === 'CLS' && citation.metadata?.source_file === 'SharhSiyarAlKabir_Sarakhsi_InternationalLaw.txt';
        const thumbnailUrl = citation.metadata?.thumbnail_url;
        
        return (
          <div 
            key={`preview-${citation.id || i}`}
            className={cn(
              "rounded-md border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden w-full",
              isYouTube ? "flex flex-col h-20" : "flex h-20"
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
            ) : isIslamQA ? (
              // IslamQA layout - Favicon and text (smaller height)
              <>
                {/* Favicon - 30% */}
                <div className="w-[30%] shrink-0 flex items-center justify-center p-1">
                  {(() => {
                    // Extract domain from URL for favicon
                    const getUrlFromCitation = (citation: any) => {
                      const isSourceLinkValid = citation.metadata?.source_link && 
                        (citation.metadata.source_link.startsWith('http://') || 
                         citation.metadata.source_link.startsWith('https://'));
                      return isSourceLinkValid ? citation.metadata.source_link : citation.metadata?.url;
                    };
                    
                    const linkToUse = getUrlFromCitation(citation);
                    if (linkToUse) {
                      try {
                        const url = new URL(linkToUse);
                        const domain = url.hostname.replace('www.', '');
                        return (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <img 
                              src={`/favicons/${domain}.png`}
                              alt={`${domain} favicon`}
                              className="w-6 h-6 rounded-sm object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                // Show fallback icon
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            {/* Fallback icon */}
                            <div 
                              className="w-6 h-6 rounded-sm bg-emerald-600 border border-emerald-700 flex items-center justify-center text-white font-semibold text-sm absolute"
                              style={{ display: 'none' }}
                            >
                              <ScrollText className="w-3 h-3" />
                            </div>
                          </div>
                        );
                      } catch {
                        return (
                          <div className="w-6 h-6 rounded-sm bg-slate-600 border border-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                            <ScrollText className="w-3 h-3" />
                          </div>
                        );
                      }
                    }
                    return (
                      <div className="w-6 h-6 rounded-sm bg-emerald-700 border border-emerald-800 flex items-center justify-center text-white font-semibold text-sm">
                        <ScrollText className="w-3 h-3" />
                      </div>
                    );
                  })()}
                </div>
                
                {/* Content - 70% */}
                <div className="flex-1 p-2 flex flex-col justify-center">
                  <div className="font-semibold text-card-foreground mb-1 text-xs">
                    {(() => {
                      // Extract domain name for title
                      const getUrlFromCitation = (citation: any) => {
                        const isSourceLinkValid = citation.metadata?.source_link && 
                          (citation.metadata.source_link.startsWith('http://') || 
                           citation.metadata.source_link.startsWith('https://'));
                        return isSourceLinkValid ? citation.metadata.source_link : citation.metadata?.url;
                      };
                      
                      const linkToUse = getUrlFromCitation(citation);
                      if (linkToUse) {
                        try {
                          const url = new URL(linkToUse);
                          return url.hostname.replace('www.', '');
                        } catch {
                          return 'IslamQA';
                        }
                      }
                      return 'IslamQA';
                    })()}
                  </div>
                  {/* Text preview - Show more question text */}
                  <div className="text-[9px] text-muted-foreground line-clamp-3 italic mb-1">
                    {cleanNumbers(citation.text)}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-auto">
                    <span className="truncate">Fatwa Website</span>
                  </div>
                </div>
              </>
            ) : (
              // Other types layout - Cover in first 30%
              <>
                {/* Cover Image - 30% */}
                <div className="w-[30%] shrink-0">
                  <div className="relative h-full bg-muted">
                    {type === 'RIS' ? (
                      <img 
                        src={`/images/risaleinur/${citation.metadata?.book_name || 'placeholder'}.webp`}
                        alt={`${citation.metadata?.book_name?.replace(/_/g, ' ').replace(/-/g, ' ') || 'Risale-i Nur'} cover`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.webp';
                        }}
                      />
                    ) : isFatawaQaziKhan ? (
                      <img 
                        src="/images/fatawa-qazi-khan.webp" 
                        alt="Fatawa Qazi Khan cover"
                        className="w-full h-full object-cover"
                      />
                    ) : isRaddulMuhtar ? (
                      <img 
                        src="/images/raddul-muhtaar.webp" 
                        alt="Rad-ul-Muhtar cover"
                        className="w-full h-full object-cover"
                      />
                    ) : isBadaiAlSanai ? (
                      <img 
                        src="/images/badai-as-sanai-urdu.webp" 
                        alt="Badai-al-Sanai cover"
                        className="w-full h-full object-cover"
                      />
                    ) : isSharhWiqayah ? (
                      <img 
                        src="/images/sharh-al-wiqayah.webp" 
                        alt="Sharh al-Wiqayah cover"
                        className="w-full h-full object-cover"
                      />
                    ) : isAlHidaya ? (
                      <img 
                        src={citation.metadata?.source_file === 'Al_Hidaya_in_English.txt' ? "/images/Al_Hidaya_in_English.webp" : "/images/Al-Hidaya.webp"} 
                        alt="Al-Hidaya cover"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.webp';
                        }}
                      />
                    ) : isAlMabsut ? (
                      <img 
                        src={citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_Index.txt' ? "/images/Al-Mabsut_Sarakhsi_Index.webp" : "/images/Al-Mabsut_Sarakhsi_HanafiFiqh.webp"} 
                        alt="Al-Mabsut Sarakhsi cover"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.webp';
                        }}
                      />
                    ) : isUsulAlFiqhSarakhsi ? (
                      <img 
                        src="/images/UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.webp" 
                        alt="Usul al-Fiqh Sarakhsi cover"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.webp';
                        }}
                      />
                    ) : isNukatZiyadat ? (
                      <img 
                        src="/images/Nukat_ZiyadatAlZiyadat_HanafiNotes.webp" 
                        alt="Nukat Ziyadat al-Ziyadat cover"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.webp';
                        }}
                      />
                    ) : isSharhSiyarAlKabir ? (
                      <img 
                        src="/images/SharhSiyarAlKabir_Sarakhsi_InternationalLaw.webp" 
                        alt="Sharh Siyar al-Kabir Sarakhsi cover"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/fatawa-qazi-khan.webp';
                        }}
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
                  <div className="font-semibold text-card-foreground mb-1 line-clamp-1 text-xs">
                    {type === 'RIS' && citation.metadata?.book_name 
                      ? formatBookOrNamespace(citation.metadata.book_name)
                      : type === 'CLS' && citation.metadata?.source
                      ? citation.metadata.source
                      : citation.text?.slice(0, 50) || '[No text]'}...
                  </div>
                  {/* Text preview */}
                  <div className="text-[8px] text-muted-foreground line-clamp-2 italic mb-1">
                    {cleanNumbers(citation.text)}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-auto">
                    {type === 'RIS' && citation.metadata?.page_number && (
                      <span className="truncate">Pg: {citation.metadata.page_number}</span>
                    )}
                    {type === 'CLS' && !isFatawaQaziKhan && !isBadaiAlSanai && citation.metadata?.source && citation.metadata?.page_number && (
                      <span className="truncate">Pg: {citation.metadata.page_number}</span>
                    )}
                    {type === 'CLS' && isFatawaQaziKhan && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isRaddulMuhtar && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isBadaiAlSanai && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isSharhWiqayah && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isAlMabsut && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isUsulAlFiqhSarakhsi && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isNukatZiyadat && citation.metadata?.volume && (
                      <span className="truncate">Vol: {citation.metadata.volume}</span>
                    )}
                    {type === 'CLS' && isSharhSiyarAlKabir && citation.metadata?.volume && (
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
      {sortedCitations.length > 3 && (
        <div 
          key="more-sources-card"
          className="rounded-md border border-border bg-secondary/50 p-2 text-xs cursor-pointer hover:bg-secondary/70 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md h-20 w-full"
          onClick={() => setActiveTab('sources')}
        >
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              +{sortedCitations.length - 3}
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