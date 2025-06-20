'use client';

import { cn } from '@/lib/utils';
import { Youtube, BookOpen, ScrollText } from 'lucide-react';
import { determineCitationType, filterEligibleCitations, RIS_NAMESPACES, YT_NAMESPACES, TAF_NAMESPACES } from './citation-utils';
import { ChevronDownIcon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { SOURCE_DESCRIPTIONS } from './source-descriptions';

interface SourcesTabProps {
  vectorSearchData: {
    citations: any[];
    improvedQueries?: string[];
  };
  setModalCitation: (citation: { citation: any; number: number } | null) => void;
  showDebug?: boolean;
}

export function SourcesTab({ vectorSearchData, setModalCitation, showDebug = false }: SourcesTabProps) {
  const [isQueryMappingExpanded, setIsQueryMappingExpanded] = useState(false);
  const eligibleCitations = filterEligibleCitations(vectorSearchData.citations);

  // Sort citations: DIRECT first (all types), then CONTEXT (all types), with type priority within each category
  const sortedCitations = eligibleCitations.sort((a, b) => {
    const typeA = determineCitationType(a.citation);
    const typeB = determineCitationType(b.citation);
    const categoryA = a.citation.category || 'context';
    const categoryB = b.citation.category || 'context';
    
    // Define type priority: 1=Tafsir, 2=Books, 3=YouTube, 4=Web-Fatwas, 5=Others
    const getTypePriority = (type: string) => {
      if (type === 'TAF' || type === 'tafsirs') return 1; // Tafsirs first
      if (type === 'RIS' || type === 'risale' || type === 'CLS' || type === 'classic') return 2; // Books second
      if (type === 'YT' || type === 'youtube') return 3; // YouTube third
      if (type === 'islamqa_fatwa') return 4; // Web-Fatwas fourth
      return 5; // Others last
    };
    
    const priorityA = getTypePriority(typeA);
    const priorityB = getTypePriority(typeB);
    
    // FIRST: All direct citations come before all context citations
    if (categoryA === 'direct' && categoryB !== 'direct') return -1;
    if (categoryB === 'direct' && categoryA !== 'direct') return 1;
    
    // SECOND: Within same category (direct or context), sort by type priority
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // If both same category and type, maintain original order
    return 0;
  });

  // Function to clean numbers from text
  const cleanNumbers = (text: string | undefined) => {
    if (!text) return '';
    return text.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  };

  // Separate citations by type to avoid mixing different types in same row
  const youTubeCitations = (() => {
    const ytCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
      const type = determineCitationType(item.citation);
      return type === 'YT' || type === 'youtube';
    });
    
    // Remove duplicates based on video_id
    const seenVideoIds = new Set<string>();
    return ytCitations.filter((item: {citation: any, i: number}) => {
      const videoId = item.citation.metadata?.video_id;
      if (!videoId) return true; // Keep citations without video_id
      
      if (seenVideoIds.has(videoId)) {
        return false; // Filter out duplicate
      }
      
      seenVideoIds.add(videoId);
      return true; // Keep first occurrence
    });
  })();

  const islamQACitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    if (type !== 'islamqa_fatwa') return false;
    
    // Check if citation has a valid URL and favicon exists
    const citation = item.citation;
    const getUrlFromCitation = (citation: any) => {
      const isSourceLinkValid = citation.metadata?.source_link && 
        (citation.metadata.source_link.startsWith('http://') || 
         citation.metadata.source_link.startsWith('https://'));
      return isSourceLinkValid ? citation.metadata.source_link : citation.metadata?.url;
    };
    
    const linkToUse = getUrlFromCitation(citation);
    if (!linkToUse) return false;
    
    try {
      const url = new URL(linkToUse);
      const domain = url.hostname.replace('www.', '');
      // Only show if we have a favicon for this domain
      // This is a basic check - in practice, you might want to maintain a list of domains with favicons
      const knownDomains = [
        'muftionline.co.za',
        'daruliftaa.us', 
        'askimam.org',
        'hadithanswers.com',
        'daruliftabirmingham.co.uk',
        'seekersguidance.org',
        'darulifta-deoband.com',
        'islamqa.org',
        'islamqa.info'
      ];
      return knownDomains.includes(domain);
    } catch {
      return false;
    }
  });

  const risaleCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return type === 'RIS' || type === 'risale';
  });

  const classicalCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return type === 'CLS' || type === 'classic';
  });

  const tafsirCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return type === 'TAF' || type === 'tafsirs';
  });

  // Combine RIS and CLS citations into one array (TAF now has its own section)
  const combinedRisaleAndClassicalCitations = [...risaleCitations, ...classicalCitations];

  const otherCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return !['YT', 'youtube', 'islamqa_fatwa', 'RIS', 'risale', 'CLS', 'classic', 'TAF', 'tafsirs'].includes(type);
  });

  return (
    <div className="space-y-6">
      {/* Tafsir Citations - 2 per row - Show first */}
      {tafsirCitations.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tafsirCitations.map((item: {citation: any, i: number}) => {
              const { citation, i } = item;
              const type = determineCitationType(citation);
              
              return (
                <div 
                  key={`tafsir-${citation.id || i}`} 
                  className="rounded-lg border border-border bg-card/50 flex flex-col transition-all duration-200 cursor-pointer hover:bg-card/70 hover:shadow-md overflow-hidden shadow-sm relative"
                  onClick={() => {
                    console.log('🎯 Tafsir card clicked - Citation Index:', i);
                    console.log('🎯 Tafsir card clicked - Citation Data:', citation);
                    console.log('🎯 Tafsir card clicked - Citation Metadata:', citation.metadata);
                    console.log('🎯 Tafsir card clicked - Citation Namespace:', citation.namespace);
                    setModalCitation({ 
                      citation: citation, 
                      number: i + 1
                    });
                  }}
                >
                  {/* Tafsir Source Layout - Match modal exactly but smaller */}
                  <div className="flex gap-0 h-24 sm:h-28">
                    {/* Cover Image - 40% to match modal */}
                    <div className="w-[40%] flex-shrink-0">
                      <div className="relative w-full h-full bg-muted">
                        <img 
                          src={`/images/${citation.namespace}.webp`}
                          alt={`${(() => {
                            switch (citation.namespace) {
                              case 'Maarif-ul-Quran':
                                return 'Maarif-ul-Quran';
                              case 'Bayan-ul-Quran':
                                return 'Tafsir Bayan ul Quran';
                              case 'Kashf-Al-Asrar':
                                return 'Kashf Al-Asrar Tafsir';
                              case 'Tazkirul-Quran':
                                return 'Tazkirul Quran';
                              case 'Tanweer-Tafsir':
                                return 'Tafseer Tanwir al-Miqbas';
                              default:
                                return 'Tafsir';
                            }
                          })()} cover`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = '<div class="text-2xl text-muted-foreground flex items-center justify-center h-full">📖</div>';
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Content - 60% to match modal */}
                    <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                      {/* Tafsir name as title */}
                      <div className="text-xs font-semibold text-card-foreground leading-tight">
                        {(() => {
                          switch (citation.namespace) {
                            case 'Maarif-ul-Quran':
                              return 'Maarif-ul-Quran';
                            case 'Bayan-ul-Quran':
                              return 'Tafsir Bayan ul Quran';
                            case 'Kashf-Al-Asrar':
                              return 'Kashf Al-Asrar Tafsir';
                            case 'Tazkirul-Quran':
                              return 'Tazkirul Quran';
                            case 'Tanweer-Tafsir':
                              return 'Tafseer Tanwir al-Miqbas';
                            default:
                              return 'Tafsir';
                          }
                        })()}
                      </div>
                      
                      {/* Author and description - match modal */}
                      <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                        {(() => {
                          switch (citation.namespace) {
                            case 'Maarif-ul-Quran':
                              return 'By Mufti Muhammad Shafi (Hanafi) - A comprehensive Quranic commentary';
                            case 'Bayan-ul-Quran':
                              return 'By Dr. Israr Ahmad (Hanafi) - Modern Urdu Quranic interpretation';
                            case 'Kashf-Al-Asrar':
                              return 'By Unknown Author (Hanafi, Sufi) - Mystical Quranic commentary';
                            case 'Tazkirul-Quran':
                              return 'By Maulana Wahid Uddin Khan (Hanafi) - Contemporary Quranic insights';
                            case 'Tanweer-Tafsir':
                              return 'By Tanweer (Hanafi) - Classical Arabic Quranic commentary';
                            default:
                              return 'Quranic commentary and interpretation';
                          }
                        })()}
                      </div>
                      
                      {/* Metadata - match modal */}
                      <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                        {/* Source info */}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px]">Tafsir Commentary</span>
                        </div>
                        
                        {/* Surah and Ayah numbers */}
                        {(citation.metadata?.surah_number || citation.metadata?.ayah_number) && (
                          <div className="text-[9px]">
                            {citation.metadata?.surah_number && citation.metadata?.ayah_number 
                              ? `Surah ${citation.metadata.surah_number}, Ayah ${citation.metadata.ayah_number}`
                              : citation.metadata?.surah_number 
                                ? `Surah ${citation.metadata.surah_number}`
                                : `Ayah ${citation.metadata.ayah_number}`
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Combined Risale-i Nur and Classical Citations (Books) - 2 per row - Second priority */}
      {combinedRisaleAndClassicalCitations.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {combinedRisaleAndClassicalCitations.map((item: {citation: any, i: number}) => {
              const { citation, i } = item;
              const type = determineCitationType(citation);
              
              // Check if this is a RIS citation
              const isRisale = type === 'RIS' || type === 'risale';
              
              // Check classical source types
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
              
              return (
                <div 
                  key={`source-${citation.id || i}`} 
                  className="rounded-lg border border-border bg-card/50 flex flex-col transition-all duration-200 cursor-pointer hover:bg-card/70 hover:shadow-md overflow-hidden shadow-sm relative"
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
                  {/* Render based on citation type */}
                  {isRisale ? (
                    /* RIS Source Layout - Match modal exactly but smaller */
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% to match modal */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src={`/images/risaleinur/${citation.metadata?.book_name || 'placeholder'}.webp`}
                            alt={`${citation.metadata?.book_name?.replace(/_/g, ' ').replace(/-/g, ' ') || 'Risale-i Nur'} cover`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% to match modal */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        {citation.metadata?.book_name && (
                          <div className="text-xs font-semibold text-card-foreground leading-tight">
                            {citation.metadata.book_name.replace(/-/g, ' ').replace(/_/g, ' ')}
                          </div>
                        )}
                        
                        {/* Description - match modal */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          A profound work from the Risale-i Nur collection by Bediuzzaman Said Nursi, offering deep insights into Islamic spirituality and theology.
                        </div>
                        
                        {/* Metadata - match modal */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          {/* Source info */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Risale-i Nur Collection</span>
                          </div>
                          
                          {/* Author */}
                          <div className="text-[9px]">
                            Author: Bediuzzaman Said Nursi
                          </div>
                          
                          {/* Page info */}
                          {citation.metadata?.page_number && (
                            <div className="text-[9px]">
                              Page: {citation.metadata.page_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isFatawaQaziKhan ? (
                    /* Classical Source Layout - Match modal exactly but smaller */
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% to match modal */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/fatawa-qazi-khan.webp" 
                            alt="Fatawa Qazi Khan cover"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% to match modal */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Fatawa Qazi Khan
                        </div>
                        
                        {/* Book description - match modal */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Fatawa Qazi Khan']}
                        </div>
                        
                        {/* Metadata - match modal */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          {/* Source info */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          
                          {/* Volume info */}
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isRaddulMuhtar ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/raddul-muhtaar.webp" 
                            alt="Rad-ul-Muhtar cover"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Rad-ul-Muhtar
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Rad-ul-Muhtar']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isBadaiAlSanai ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/badai-as-sanai-urdu.webp" 
                            alt="Badai-al-Sanai cover"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Badai-al-Sanai
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Badai-al-Sanai']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isSharhWiqayah ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/sharh-al-wiqayah.webp" 
                            alt="Sharh al-Wiqayah cover"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Sharh al-Wiqayah
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Sharh al-Wiqayah']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isAlHidaya ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src={citation.metadata?.source_file === 'Al_Hidaya_in_English.txt' ? "/images/Al_Hidaya_in_English.webp" : "/images/Al-Hidaya.webp"} 
                            alt="Al-Hidaya cover"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Al-Hidaya
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Al-Hidaya']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isAlMabsut ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src={citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_Index.txt' ? "/images/Al-Mabsut_Sarakhsi_Index.webp" : "/images/Al-Mabsut_Sarakhsi_HanafiFiqh.webp"} 
                            alt="Al-Mabsut Sarakhsi cover"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Al-Mabsut Sarakhsi
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Al-Mabsut Sarakhsi']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isUsulAlFiqhSarakhsi ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.webp" 
                            alt="Usul al-Fiqh Sarakhsi cover"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Usul al-Fiqh Sarakhsi
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Usul al-Fiqh Sarakhsi']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isNukatZiyadat ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/Nukat_ZiyadatAlZiyadat_HanafiNotes.webp" 
                            alt="Nukat Ziyadat al-Ziyadat cover"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Nukat Ziyadat al-Ziyadat
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Nukat Ziyadat al-Ziyadat']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isSharhSiyarAlKabir ? (
                    <div className="flex gap-0 h-24 sm:h-28">
                      {/* Cover Image - 40% */}
                      <div className="w-[40%] flex-shrink-0">
                        <div className="relative w-full h-full bg-muted">
                          <img 
                            src="/images/SharhSiyarAlKabir_Sarakhsi_InternationalLaw.webp" 
                            alt="Sharh Siyar al-Kabir Sarakhsi cover"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5 p-2">
                        {/* Book name as title */}
                        <div className="text-xs font-semibold text-card-foreground leading-tight">
                          Sharh Siyar al-Kabir Sarakhsi
                        </div>
                        
                        {/* Book description */}
                        <div className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2">
                          {SOURCE_DESCRIPTIONS['Sharh Siyar al-Kabir Sarakhsi']}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground mt-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]">Classical Islamic Text</span>
                          </div>
                          {citation.metadata?.volume && (
                            <div className="text-[9px]">
                              Volume: {citation.metadata.volume}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Other classical sources
                    <div className="p-3">
                      {/* Source text preview */}
                      <div className="text-xs font-semibold text-card-foreground line-clamp-2">
                        {citation.metadata?.source || citation.text?.slice(0, 60) || '[No text]'}...
                      </div>
                      
                      {/* Preview */}
                      <div className="text-[10px] text-muted-foreground line-clamp-4 mt-1">
                        {cleanNumbers(citation.text)}
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                        <div className="flex items-center gap-1">
                          <span className="px-1 py-0.5 rounded bg-secondary text-secondary-foreground text-[9px]">
                            Classical
                          </span>
                          <span className="truncate">{citation.metadata?.source || 'Classical Source'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* YouTube Cards - 2 per row on mobile, 3 per row on desktop - Third priority */}
      {youTubeCitations.length > 0 && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
            {youTubeCitations.map((item: {citation: any, i: number}) => {
              const { citation, i } = item;
              const thumbnailUrl = citation.metadata?.thumbnail_url;
              
              return (
                <div 
                  key={`source-${citation.id || i}`} 
                  className="rounded-lg border border-border bg-card/50 flex flex-col transition-all duration-200 cursor-pointer hover:bg-card/70 hover:shadow-md overflow-hidden shadow-sm h-fit relative"
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
                  {thumbnailUrl ? (
                    <div className="relative w-full aspect-video rounded overflow-hidden bg-muted group">
                      <img 
                        src={thumbnailUrl} 
                        alt="YouTube video thumbnail"
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300"
                      />
                      
                      {/* YouTube Play Button - Big Red Icon in Center */}
                      <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <div className="relative">
                          {/* Red Rounded Rectangle Background - Like Real YouTube */}
                          <div className="w-12 h-8 md:w-14 md:h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg">
                            {/* White Triangle Play Icon */}
                            <div className="w-0 h-0 border-l-[6px] md:border-l-[7px] border-l-white border-t-[4px] md:border-t-[5px] border-t-transparent border-b-[4px] md:border-b-[5px] border-b-transparent ml-0.5"></div>
                          </div>
                        </div>
                      </div>
                      
                      {citation.namespace && (
                        <div className="absolute top-1 left-1 md:top-1.5 md:left-1.5 bg-black/80 text-white text-[8px] md:text-[9px] px-1 md:px-1.5 py-0.5 rounded flex items-center gap-0.5 md:gap-1">
                          <Youtube className="size-2 md:size-2.5" />
                          <span className="hidden sm:inline">YouTube</span>
                        </div>
                      )}
                      {citation.metadata?.timestamp && typeof citation.metadata.timestamp === 'number' && !isNaN(citation.metadata.timestamp) && (
                        <div className="absolute bottom-1 left-1 md:bottom-1.5 md:left-1.5 bg-black/80 text-white text-[7px] md:text-[8px] px-1 py-0.5 rounded">
                          {Math.floor(citation.metadata.timestamp / 60)}:{(citation.metadata.timestamp % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* YouTube without thumbnail */
                    <div className="p-2 md:p-3 space-y-1 flex-1 flex flex-col">
                      <div className="text-[9px] md:text-[10px] font-semibold text-card-foreground flex items-center gap-1">
                        <Youtube className="size-2 md:size-2.5" />
                        <span className="line-clamp-2">YouTube</span>
                      </div>
                      <div className="text-[8px] md:text-[9px] text-muted-foreground line-clamp-3">
                        {cleanNumbers(citation.text)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IslamQA Citations (Web-Fatwas) - 2 per row - Fourth priority */}
      {islamQACitations.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {islamQACitations.map((item: {citation: any, i: number}) => {
              const { citation, i } = item;
              const type = determineCitationType(citation);
              
              return (
                <div 
                  key={`source-${citation.id || i}`} 
                  className="rounded-lg border border-border bg-card/50 flex flex-col transition-all duration-200 cursor-pointer hover:bg-card/70 hover:shadow-md overflow-hidden shadow-sm relative"
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
                  {/* IslamQA Fatwa Layout - Match modal but smaller */}
                  <div className="p-2">
                    <div className="flex items-start gap-2">
                      {/* Favicon - smaller than modal */}
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
                              <div className="w-6 h-6 rounded-md flex-shrink-0 relative">
                                <img 
                                  src={`/favicons/${domain}.png`}
                                  alt={`${domain} favicon`}
                                  className="w-6 h-6 rounded-md"
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
                                  className="w-6 h-6 rounded-md bg-emerald-600 border border-emerald-700 flex items-center justify-center text-white font-semibold text-xs absolute top-0 left-0 shadow-sm"
                                  style={{ display: 'none' }}
                                >
                                  <ScrollText className="w-3 h-3" />
                                </div>
                              </div>
                            );
                          } catch {
                            return (
                              <div className="w-6 h-6 rounded-md bg-slate-600 border border-slate-700 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 shadow-sm">
                                <ScrollText className="w-3 h-3" />
                              </div>
                            );
                          }
                        }
                        return (
                          <div className="w-6 h-6 rounded-md bg-emerald-700 border border-emerald-800 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 shadow-sm">
                            <ScrollText className="w-3 h-3" />
                          </div>
                        );
                      })()}
                      
                      {/* Scholar and Domain */}
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold text-card-foreground line-clamp-2">
                          {(() => {
                            // Extract scholar information up until "Short"
                            const text = citation.text || '';
                            const shortIndex = text.indexOf('Short');
                            const relevantText = shortIndex !== -1 ? text.substring(0, shortIndex).trim() : text;
                            
                            // Look for scholar pattern like "Scholar: Name"
                            const scholarMatch = relevantText.match(/Scholar:\s*([^.\n]+)/i);
                            if (scholarMatch) {
                              return `Scholar: ${scholarMatch[1].trim()}`;
                            }
                            
                            // Fallback to question if available
                            return citation.metadata?.question || citation.text?.slice(0, 80) || '[No scholar information available]';
                          })()}
                        </div>
                        {/* Domain name */}
                        <div className="text-[8px] text-muted-foreground mt-1">
                          {(() => {
                            // Extract domain from URL
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
                                return null;
                              }
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Citations - 2 per row - Fifth priority */}
      {otherCitations.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherCitations.map((item: {citation: any, i: number}) => {
              const { citation, i } = item;
              const type = determineCitationType(citation);
              
              return (
                <div 
                  key={`source-${citation.id || i}`} 
                  className="rounded-lg border border-border bg-card/50 flex flex-col transition-all duration-200 cursor-pointer hover:bg-card/70 hover:shadow-md overflow-hidden shadow-sm relative"
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
                  {/* Other types - smaller */}
                  <div className="p-2">
                    <div className="text-[10px] font-semibold text-card-foreground line-clamp-2">
                      {citation.text?.slice(0, 60) || '[No text]'}...
                    </div>
                    
                    {/* Preview */}
                    <div className="text-[8px] text-muted-foreground line-clamp-4 mt-1">
                      {cleanNumbers(citation.text)}
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex flex-col gap-0.5 text-[8px] text-muted-foreground mt-auto">
                      <div className="flex items-center gap-1">
                        <span className="px-1 py-0.5 rounded bg-secondary text-secondary-foreground text-[7px]">
                          {type}
                        </span>
                        <span className="truncate">{citation.metadata?.source || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Query to Citations Mapping - At the bottom of sources - Only show in debug mode */}
      {showDebug && vectorSearchData.citations && vectorSearchData.improvedQueries && (
        <div className="border-t border-border pt-6">
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
                style={{ isolation: 'isolate' }}
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
                style={{ overflow: 'hidden', isolation: 'isolate' }}
              >
                <div className="bg-muted/50 border border-border p-3 rounded space-y-3">
                  <div className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    Explore how your question was broken down into specific search queries and see which sources were found for each query. This transparency shows the search process behind the response.
                  </div>
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
                        <div key={qIndex} className="border-b border-border pb-2 last:border-0">
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
                              } else if (c.metadata?.content_type === 'islamqa_fatwa') {
                                type = 'islamqa_fatwa';
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
                                    • {type === 'YT' ? <Youtube className="size-3 inline mr-1" /> : type === 'RIS' ? <BookOpen className="size-3 inline mr-1" /> : type === 'CLS' ? <ScrollText className="size-3 inline mr-1" /> : type === 'islamqa_fatwa' ? 'IslamQA' : type} | {c.text?.slice(0, 120)}...
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
  );
}