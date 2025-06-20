'use client';

import { cn } from '@/lib/utils';
import { determineCitationType, formatBookOrNamespace, filterEligibleCitations } from './citation-utils';
import { Youtube, ScrollText, BookOpen, Globe, Sparkles, TrendingUp } from 'lucide-react';

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

  // Group citations by type and count them
  const sourceTypeCounts = eligibleCitations.reduce((acc: any, item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    
    if (type === 'TAF' || type === 'tafsirs') {
      acc.tafsirs = (acc.tafsirs || 0) + 1;
      if (!acc.tafsirsCitations) acc.tafsirsCitations = [];
      acc.tafsirsCitations.push(item.citation);
    } else if (type === 'YT' || type === 'youtube') {
      acc.youtube = (acc.youtube || 0) + 1;
      if (!acc.youtubeCitations) acc.youtubeCitations = [];
      acc.youtubeCitations.push(item.citation);
    } else if (type === 'RIS' || type === 'risale' || type === 'CLS' || type === 'classic') {
      acc.books = (acc.books || 0) + 1;
      if (!acc.booksCitations) acc.booksCitations = [];
      acc.booksCitations.push(item.citation);
    } else if (type === 'islamqa_fatwa') {
      acc.fatwas = (acc.fatwas || 0) + 1;
      if (!acc.fatwasCitations) acc.fatwasCitations = [];
      acc.fatwasCitations.push(item.citation);
    } else {
      acc.others = (acc.others || 0) + 1;
      if (!acc.othersCitations) acc.othersCitations = [];
      acc.othersCitations.push(item.citation);
    }
    
    return acc;
  }, {});

  // Calculate total sources and direct sources
  const totalSources = eligibleCitations.length;
  const directSources = eligibleCitations.filter(item => item.citation.category === 'direct').length;

  // Create cards for each type that has sources
  const sourceTypeCards = [];

  // Tafsirs card
  if (sourceTypeCounts.tafsirs > 0) {
    const directCount = sourceTypeCounts.tafsirsCitations.filter((c: any) => c.category === 'direct').length;
    sourceTypeCards.push({
      type: 'tafsirs',
      count: sourceTypeCounts.tafsirs,
      directCount,
      label: 'Tafsirs',
      subtitle: 'Quranic Exegesis',
      icon: BookOpen,
      citations: sourceTypeCounts.tafsirsCitations,
      priority: 1
    });
  }

  // Books card
  if (sourceTypeCounts.books > 0) {
    const directCount = sourceTypeCounts.booksCitations.filter((c: any) => c.category === 'direct').length;
    sourceTypeCards.push({
      type: 'books',
      count: sourceTypeCounts.books,
      directCount,
      label: 'Classical Books',
      subtitle: 'Fiqh & Hadith',
      icon: BookOpen,
      citations: sourceTypeCounts.booksCitations,
      priority: 2
    });
  }

  // YouTube card
  if (sourceTypeCounts.youtube > 0) {
    const directCount = sourceTypeCounts.youtubeCitations.filter((c: any) => c.category === 'direct').length;
    sourceTypeCards.push({
      type: 'youtube',
      count: sourceTypeCounts.youtube,
      directCount,
      label: 'Video Lectures',
      subtitle: 'Scholarly Talks',
      icon: Youtube,
      citations: sourceTypeCounts.youtubeCitations,
      priority: 3
    });
  }

  // Fatwas card
  if (sourceTypeCounts.fatwas > 0) {
    const directCount = sourceTypeCounts.fatwasCitations.filter((c: any) => c.category === 'direct').length;
    sourceTypeCards.push({
      type: 'fatwas',
      count: sourceTypeCounts.fatwas,
      directCount,
      label: 'Online Fatwas',
      subtitle: 'Religious Rulings',
      icon: Globe,
      citations: sourceTypeCounts.fatwasCitations,
      priority: 4
    });
  }

  // Others card
  if (sourceTypeCounts.others > 0) {
    const directCount = sourceTypeCounts.othersCitations.filter((c: any) => c.category === 'direct').length;
    sourceTypeCards.push({
      type: 'others',
      count: sourceTypeCounts.others,
      directCount,
      label: 'Other Sources',
      subtitle: 'Misc. References',
      icon: ScrollText,
      citations: sourceTypeCounts.othersCitations,
      priority: 5
    });
  }

  // Sort by priority
  sourceTypeCards.sort((a, b) => a.priority - b.priority);

  // Function to get cover image for a citation
  const getCoverImage = (citation: any, type: string) => {
    if (type === 'youtube') {
      return citation.metadata?.thumbnail_url || null;
    } else if (type === 'tafsirs') {
      return `/images/${citation.namespace}.webp`;
    } else if (type === 'books') {
      const citationType = determineCitationType(citation);
      if (citationType === 'RIS') {
        return `/images/risaleinur/${citation.metadata?.book_name || 'placeholder'}.webp`;
      } else if (citationType === 'CLS') {
        if (citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')) {
          return '/images/fatawa-qazi-khan.webp';
        } else if (citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol')) {
          return '/images/raddul-muhtaar.webp';
        } else if (citation.metadata?.source_file?.match(/Badai-al-Sanai-Urdu-Vol-\d+_hocr_searchtext\.txt\.gz/)) {
          return '/images/badai-as-sanai-urdu.webp';
        } else if (citation.metadata?.book_name === 'Al-Hidaya' || citation.metadata?.source_file === 'Al_Hidaya_in_English.txt') {
          return citation.metadata?.source_file === 'Al_Hidaya_in_English.txt' ? '/images/Al_Hidaya_in_English.webp' : '/images/Al-Hidaya.webp';
        }
      }
      return '/images/fatawa-qazi-khan.webp'; // fallback
    } else if (type === 'fatwas') {
      // For fatwas, we'll use favicons
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
          return `/favicons/${domain}.png`;
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  return (
    <div className="mb-2">
      {/* Source Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {sourceTypeCards.map((card) => {
          const IconComponent = card.icon;
          
          // Get up to 3 unique cover images for stacking
          const coverImages = [];
          const seenImages = new Set();
          
          for (const citation of card.citations) {
            if (coverImages.length >= 3) break;
            const coverImage = getCoverImage(citation, card.type);
            if (coverImage && !seenImages.has(coverImage)) {
              coverImages.push(coverImage);
              seenImages.add(coverImage);
            }
          }
          
                        return (
            <div 
              key={`source-type-${card.type}`}
              className={cn(
                "group rounded-lg cursor-pointer transition-all duration-300 overflow-hidden w-full h-24 relative",
                card.type === 'youtube' ? "" : 
                card.type === 'fatwas' ? "bg-muted hover:bg-muted/80 flex flex-col p-2" :
                "bg-muted hover:bg-muted/80 flex pl-1"
              )}
              onClick={() => setActiveTab('sources')}
            >


              {/* YouTube Full Background Layout */}
              {card.type === 'youtube' && coverImages.length > 0 && (
                <div className="absolute inset-0">
                  <img 
                    src={coverImages[0]}
                    alt="YouTube background"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/40" />
                  {/* YouTube icon in top-right */}
                                        <div className="absolute top-1 right-1">
                    <div className="bg-red-600 rounded-sm p-1">
                      <Youtube className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              )}



              {/* Stacked Covers - 40% for books, 50% for others, hidden for YouTube and fatwas */}
              <div className={cn("shrink-0 relative bg-gradient-to-br from-muted to-muted/50 group-hover:from-muted/80 group-hover:to-muted/40 transition-colors duration-300", 
                card.type === 'youtube' || card.type === 'fatwas' ? "hidden" : 
                card.type === 'books' ? "w-[40%]" : "w-[50%]"
              )}>
                {coverImages.length > 0 ? (
                  <div className="relative w-full h-full">
                    {coverImages.map((image, index) => (
                      <div
                        key={index}
                        className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
                        style={{
                          transform: `translate(${index * 3}px, ${index * 3}px)`,
                          zIndex: coverImages.length - index,
                        }}
                      >
                        {card.type === 'fatwas' ? (
                          <div className="w-full h-full flex items-center justify-center bg-white/90 backdrop-blur-sm rounded">
                            <img 
                              src={image}
                              alt="Favicon"
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="fallback-icon w-8 h-8 bg-emerald-600 rounded-sm flex items-center justify-center text-white" style={{ display: 'none' }}>
                              <ScrollText className="w-4 h-4" />
                            </div>
                          </div>
                        ) : card.type === 'youtube' ? (
                          <div className="relative w-full h-full p-2 py-5">
                            <div className="relative w-full h-full bg-black rounded overflow-hidden">
                              <img 
                                src={image}
                                alt="YouTube thumbnail"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                                  const fallback = target.parentElement?.querySelector('.youtube-fallback') as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                              {/* YouTube play button overlay */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-red-600/90 rounded-full p-1.5">
                                  <div className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
                  </div>
                </div>
                              {/* Fallback */}
                              <div className="youtube-fallback absolute inset-0 bg-red-600 flex items-center justify-center" style={{ display: 'none' }}>
                                <Youtube className="w-8 h-8 text-white" />
                  </div>
                  </div>
                </div>
                        ) : (
                          <img 
                            src={image}
                            alt="Cover"
                            className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn("w-full h-full flex items-center justify-center", 
                    card.type === 'youtube' ? "bg-red-600" : ""
                  )}>
                    <IconComponent className={cn("size-8 transition-colors duration-300",
                      card.type === 'youtube' ? "text-white" : "text-muted-foreground/50 group-hover:text-muted-foreground/70"
                    )} />
                  </div>
                )}
                </div>
                
              {/* Content */}
              <div className={cn(
                "flex flex-col justify-between",
                card.type === 'youtube' ? "flex-1 pt-2.5 px-2.5 pb-2.5 relative z-10" : 
                card.type === 'fatwas' ? "pt-0.5" : "flex-1 pt-2.5 px-2.5 pb-2.5"
              )}>
                <div>
                  {card.type === 'fatwas' ? (
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                        {card.count}
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[11px] font-semibold text-foreground/80 leading-tight">
                          {card.label}
                        </div>
                        <div className="text-[9px] text-muted-foreground leading-tight">
                          {card.subtitle}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={cn(
                        "text-2xl font-bold mb-0.5 transition-colors duration-300",
                        card.type === 'youtube' ? "text-white drop-shadow-lg" : "text-foreground group-hover:text-primary"
                      )}>
                        {card.count}
                      </div>
                      <div className={cn(
                        "text-[11px] font-semibold",
                        card.type === 'youtube' ? "text-white drop-shadow-md" : "text-foreground/80"
                      )}>
                        {card.label}
                      </div>
                      <div className={cn(
                        "text-[9px]",
                        card.type === 'youtube' ? "text-white/90 drop-shadow-md" : "text-muted-foreground"
                      )}>
                        {card.subtitle}
                      </div>
                    </>
                                    )}
                </div>
              </div>

              {/* Fatwa Sites Layout - Favicons in a row (after content) */}
              {card.type === 'fatwas' && (
                <div className="flex gap-1.5 mt-2">
                  {coverImages.slice(0, 4).map((image, index) => (
                    <div
                      key={index}
                      className="w-8 h-8 bg-white rounded-sm flex items-center justify-center flex-shrink-0"
                    >
                      <img 
                        src={image}
                        alt="Favicon"
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="fallback-icon w-6 h-6 bg-emerald-600 rounded-sm flex items-center justify-center text-white" style={{ display: 'none' }}>
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                  </div>
                  ))}
                  {coverImages.length === 0 && (
                    <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                  </div>
                  )}
                </div>
            )}
          </div>
        );
      })}
      
        {/* Fill remaining slots with empty divs if less than 4 cards */}
        {Array.from({ length: Math.max(0, 4 - sourceTypeCards.length) }).map((_, index) => (
          <div key={`empty-${index}`} className="h-24 w-full" />
        ))}
        </div>
    </div>
  );
} 