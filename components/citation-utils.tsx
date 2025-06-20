export const RIS_NAMESPACES = ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'];

export const YT_NAMESPACES = ['youtube-qa-pairs'];

export const TAF_NAMESPACES = ['Maarif-ul-Quran', 'Bayan-ul-Quran', 'Kashf-Al-Asrar', 'Tazkirul-Quran', 'Tanweer-Tafsir'];

export const determineCitationType = (citation: any): string => {
  if (citation.metadata?.type) {
    const type = citation.metadata.type.toLowerCase();
    if (['classic', 'cls'].includes(type)) return 'CLS';
    if (['modern', 'mod'].includes(type)) return 'MOD';
    if (['risale', 'ris'].includes(type)) return 'RIS';
    if (['youtube', 'yt'].includes(type)) return 'YT';
    return citation.metadata.type.toUpperCase();
  }
  // Check for islamqa_fatwa content type
  if (citation.metadata?.content_type === 'islamqa_fatwa') {
    return 'islamqa_fatwa';
  }
  if (citation.namespace) {
    if (RIS_NAMESPACES.includes(citation.namespace)) return 'RIS';
    if (YT_NAMESPACES.includes(citation.namespace)) return 'YT';
    if (TAF_NAMESPACES.includes(citation.namespace)) return 'TAF';
  }
  if (!citation.metadata?.type && !citation.namespace) return 'CLS';
  return 'UNKNOWN';
};

export const formatBookOrNamespace = (name: string): string => {
  return name.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export const filterEligibleCitations = (citations: any[]) => {
  const seenCitations = new Set<string>();
  
  return citations
    .map((citation: any, i: number) => ({ citation, i }))
    .filter((item: {citation: any, i: number}) => {
      const { citation } = item;
      const type = determineCitationType(citation);
      
      // Original filter for CLS type without source_file - but allow Al-Hidaya and other books with book_name
      if (type === 'CLS' && !citation.metadata?.source_file && !citation.metadata?.book_name) {
        return false;
      }

      // Refined filter: Check for sources with only specific metadata and no namespace
      // BUT allow islamqa_fatwa content_type to pass through
      if (!citation.namespace && citation.metadata) {
        // Allow islamqa_fatwa content type to pass through
        if (citation.metadata.content_type === 'islamqa_fatwa') {
          return true;
        }
        
        const metadataKeys = Object.keys(citation.metadata);
        const specificKeys = ['answer', 'question', 'text'];

        // Check if metadataKeys contains exactly the specificKeys and no others.
        const hasExactlySpecificKeys =
            metadataKeys.length === specificKeys.length &&
            specificKeys.every(key => metadataKeys.includes(key));

        if (hasExactlySpecificKeys) {
          console.log('🗑️ Filtering out citation with only specific metadata (answer, question, text) and no namespace:', citation);
          return false; // Filter out this citation
        }
      }

      // Deduplicate citations based on text content and metadata
      const citationKey = JSON.stringify({
        text: citation.text?.slice(0, 100), // Use first 100 chars for comparison
        source: citation.metadata?.source,
        source_file: citation.metadata?.source_file,
        namespace: citation.namespace,
        book_name: citation.metadata?.book_name,
        question: citation.metadata?.question,
        answer: citation.metadata?.answer
      });
      
      if (seenCitations.has(citationKey)) {
        console.log('🗑️ Filtering out duplicate citation:', citation);
        return false; // Filter out duplicate
      }
      
      seenCitations.add(citationKey);
      return true; // Keep citation if no filter condition met
    });
}; 