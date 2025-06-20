import { useState } from 'react';
import { determineCitationType, filterEligibleCitations, TAF_NAMESPACES } from './citation-utils';
import { BookOpen } from 'lucide-react';

interface QuranTabProps {
  vectorSearchData: any;
  setModalCitation: (citation: { citation: any; number: number } | null) => void;
}

export function QuranTab({ vectorSearchData, setModalCitation }: QuranTabProps) {
  const eligibleCitations = filterEligibleCitations(vectorSearchData.citations);

  // Filter only tafsir citations
  const tafsirCitations = eligibleCitations.filter((item: {citation: any, i: number}) => {
    const type = determineCitationType(item.citation);
    return type === 'TAF' || type === 'tafsirs';
  });

  if (tafsirCitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No Quranic commentary (Tafsir) sources found for this query.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tafsir Citations - 2 per row */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tafsirCitations.map((item: {citation: any, i: number}) => {
            const { citation, i } = item;
            
            return (
              <div 
                key={`tafsir-${citation.id || i}`} 
                className="rounded-lg border border-border bg-card/50 flex flex-col transition-all duration-200 cursor-pointer hover:bg-card/70 hover:shadow-md overflow-hidden shadow-sm relative"
                onClick={() => {
                  console.log('🎯 Quran tab - Tafsir card clicked - Citation Index:', i);
                  console.log('🎯 Quran tab - Tafsir card clicked - Citation Data:', citation);
                  console.log('🎯 Quran tab - Tafsir card clicked - Citation Metadata:', citation.metadata);
                  console.log('🎯 Quran tab - Tafsir card clicked - Citation Namespace:', citation.namespace);
                  setModalCitation({ 
                    citation: citation, 
                    number: i + 1
                  });
                }}
              >
                {/* Simplified Tafsir Card */}
                <div className="flex items-center gap-3 p-4">
                  {/* Tafsir Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  <div className="flex-1">
                    {/* Tafsir name */}
                    <div className="text-sm font-semibold text-card-foreground mb-1">
                      {(() => {
                        switch (citation.namespace) {
                          case 'Maarif-ul-Quran':
                            return 'Maarif-ul-Quran';
                          case 'Bayan-ul-Quran':
                            return 'Bayan-ul-Quran';
                          case 'Kashf-Al-Asrar':
                            return 'Kashf Al-Asrar';
                          case 'Tazkirul-Quran':
                            return 'Tazkirul-Quran';
                          case 'Tanweer-Tafsir':
                            return 'Tanwir al-Miqbas';
                          default:
                            return 'Tafsir';
                        }
                      })()}
                    </div>
                    
                    {/* Surah and Ayah only */}
                    {(citation.metadata?.surah_number || citation.metadata?.ayah_number) && (
                      <div className="text-xs text-muted-foreground">
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
            );
          })}
        </div>
      </div>
    </div>
  );
} 