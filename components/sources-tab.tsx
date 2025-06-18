'use client';

import { cn } from '@/lib/utils';
import { Youtube, BookOpen, ScrollText } from 'lucide-react';
import { determineCitationType, filterEligibleCitations, RIS_NAMESPACES, YT_NAMESPACES } from './citation-utils';
import { ChevronDownIcon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

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

  // Separate citations by type to avoid mixing different types in same row
  const youTubeCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return type === 'YT' || type === 'youtube';
  });

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

  // Combine RIS and CLS citations into one array
  const combinedRisaleAndClassicalCitations = [...risaleCitations, ...classicalCitations];

  const otherCitations = sortedCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return !['YT', 'youtube', 'islamqa_fatwa', 'RIS', 'risale', 'CLS', 'classic'].includes(type);
  });

  return (
    <div className="space-y-6">
      {/* Combined Risale-i Nur and Classical Citations - 2 per row */}
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
                    /* RIS Source Layout with 40/60 split */
                    <div className="flex gap-0 h-full">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full overflow-hidden bg-muted">
                          <img 
                            src={`/images/risaleinur/${citation.metadata?.book_name || 'placeholder'}.webp`}
                            alt={`${citation.metadata?.book_name?.replace(/_/g, ' ').replace(/-/g, ' ') || 'Risale-i Nur'} cover`}
                            className="size-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 p-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Book name as title */}
                        {citation.metadata?.book_name && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.book_name.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
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
                  ) : isFatawaQaziKhan ? (
                    /* Classical Source Layout with 40/60 split */
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/fatawa-qazi-khan.webp" 
                            alt="Fatawa Qazi Khan cover"
                            className="size-full object-cover object-center"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
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
                  ) : isRaddulMuhtar ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/raddul-muhtaar.webp" 
                            alt="Rad-ul-Muhtar cover"
                            className="size-full object-cover object-center"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
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
                  ) : isBadaiAlSanai ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/badai-as-sanai-urdu.webp" 
                            alt="Badai-al-Sanai cover"
                            className="size-full object-cover object-center"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Badai-al-Sanai</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isSharhWiqayah ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/sharh-al-wiqayah.webp" 
                            alt="Sharh al-Wiqayah cover"
                            className="size-full object-cover object-center"
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Sharh al-Wiqayah</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isAlHidaya ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src={citation.metadata?.source_file === 'Al_Hidaya_in_English.txt' ? "/images/Al_Hidaya_in_English.webp" : "/images/Al-Hidaya.webp"} 
                            alt="Al-Hidaya cover"
                            className="size-full object-cover object-center"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Al-Hidaya</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isAlMabsut ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src={citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_Index.txt' ? "/images/Al-Mabsut_Sarakhsi_Index.webp" : "/images/Al-Mabsut_Sarakhsi_HanafiFiqh.webp"} 
                            alt="Al-Mabsut Sarakhsi cover"
                            className="size-full object-cover object-center"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Al-Mabsut Sarakhsi</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isUsulAlFiqhSarakhsi ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.webp" 
                            alt="Usul al-Fiqh Sarakhsi cover"
                            className="size-full object-cover object-center"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Usul al-Fiqh Sarakhsi</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isNukatZiyadat ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/Nukat_ZiyadatAlZiyadat_HanafiNotes.webp" 
                            alt="Nukat Ziyadat al-Ziyadat cover"
                            className="size-full object-cover object-center"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Nukat Ziyadat al-Ziyadat</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isSharhSiyarAlKabir ? (
                    <div className="flex gap-3">
                      {/* Cover Image - 40% */}
                      <div className="w-2/5 shrink-0">
                        <div className="relative size-full rounded-l overflow-hidden bg-muted">
                          <img 
                            src="/images/SharhSiyarAlKabir_Sarakhsi_InternationalLaw.webp" 
                            alt="Sharh Siyar al-Kabir Sarakhsi cover"
                            className="size-full object-cover object-center"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/fatawa-qazi-khan.webp';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Content - 60% */}
                      <div className="flex-1 flex flex-col justify-center gap-2 py-3 pr-3">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        {/* Source as title */}
                        {citation.metadata?.source && (
                          <div className="text-sm font-semibold text-card-foreground line-clamp-2">
                            {citation.metadata.source}
                          </div>
                        )}
                        
                        {/* Text preview */}
                        <div className="text-[10px] text-muted-foreground line-clamp-4 italic">
                          {cleanNumbers(citation.text)}
                        </div>
                        
                        {/* Metadata */}
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                          <span className="truncate">Sharh Siyar al-Kabir Sarakhsi</span>
                          {citation.metadata?.volume && (
                            <div>Volume: {citation.metadata.volume}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Other classical sources
                    <div className="p-3">
                      {/* Category Badge */}
                      {citation.category && (
                        <div className="mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                            citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                          </span>
                        </div>
                      )}
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

      {/* IslamQA Citations - 2 per row */}
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
                  {/* IslamQA Fatwa Layout - Favicon and Question only */}
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Favicon */}
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
                              <div className="w-8 h-8 rounded-md flex-shrink-0 relative">
                                <img 
                                  src={`/favicons/${domain}.png`}
                                  alt={`${domain} favicon`}
                                  className="w-8 h-8 rounded-md"
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
                                  className="w-8 h-8 rounded-md bg-emerald-600 border border-emerald-700 flex items-center justify-center text-white font-semibold text-sm absolute top-0 left-0 shadow-sm"
                                  style={{ display: 'none' }}
                                >
                                  <ScrollText className="w-4 h-4" />
                                </div>
                              </div>
                            );
                                                      } catch {
                              return (
                                <div className="w-8 h-8 rounded-md bg-slate-600 border border-slate-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
                                  <ScrollText className="w-4 h-4" />
                                </div>
                              );
                            }
                        }
                        return (
                          <div className="w-8 h-8 rounded-md bg-emerald-700 border border-emerald-800 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
                            <ScrollText className="w-4 h-4" />
                          </div>
                        );
                      })()}
                      
                      {/* Scholar and Domain */}
                      <div className="flex-1">
                        {/* Category Badge */}
                        {citation.category && (
                          <div className="mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                              citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                            </span>
                          </div>
                        )}
                        <div className="text-xs font-semibold text-card-foreground line-clamp-2">
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
                        <div className="text-[10px] text-muted-foreground mt-1">
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

      {/* Other Citations - 2 per row */}
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
                  {/* Other types */}
                  <div className="p-3">
                    {/* Category Badge */}
                    {citation.category && (
                      <div className="mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                          citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                        </span>
                      </div>
                    )}
                    {/* Source text preview */}
                    <div className="text-xs font-semibold text-card-foreground line-clamp-2">
                      {citation.text?.slice(0, 60) || '[No text]'}...
                    </div>
                    
                    {/* Preview */}
                    <div className="text-[10px] text-muted-foreground line-clamp-4 mt-1">
                      {cleanNumbers(citation.text)}
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground mt-auto">
                      <div className="flex items-center gap-1">
                        <span className="px-1 py-0.5 rounded bg-secondary text-secondary-foreground text-[9px]">
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

      {/* YouTube Cards - 2 per row on mobile, 3 per row on desktop - Always below other sources */}
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
                        className="w-full h-full object-cover"
                      />
                      {citation.namespace && (
                        <div className="absolute top-1 left-1 md:top-1.5 md:left-1.5 bg-black/80 text-white text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded flex items-center gap-0.5 md:gap-1">
                          <Youtube className="size-2 md:size-2.5" />
                          <span className="hidden sm:inline">{citation.namespace.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {citation.category && (
                        <div className="absolute top-1 right-1 md:top-1.5 md:right-1.5">
                          <span className={`px-1 py-0.5 rounded text-[8px] md:text-[9px] font-medium ${
                            citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                            citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                          </span>
                        </div>
                      )}
                      {citation.metadata?.timestamp && typeof citation.metadata.timestamp === 'number' && !isNaN(citation.metadata.timestamp) && (
                        <div className="absolute bottom-1 left-1 md:bottom-1.5 md:left-1.5 bg-black/80 text-white text-[8px] md:text-[9px] px-1 py-0.5 rounded">
                          {Math.floor(citation.metadata.timestamp / 60)}:{(citation.metadata.timestamp % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* YouTube without thumbnail */
                    <div className="p-2 md:p-3 space-y-1 flex-1 flex flex-col">
                      {/* Category Badge */}
                      {citation.category && (
                        <div className="mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            citation.category === 'direct' ? 'bg-green-100 text-green-800' :
                            citation.category === 'context' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {citation.category?.toUpperCase() || 'UNCATEGORIZED'}
                          </span>
                        </div>
                      )}
                      <div className="text-[10px] md:text-xs font-semibold text-card-foreground flex items-center gap-1">
                        <Youtube className="size-2.5 md:size-3" />
                        <span className="line-clamp-2">{citation.namespace?.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-[9px] md:text-[10px] text-muted-foreground line-clamp-3">
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