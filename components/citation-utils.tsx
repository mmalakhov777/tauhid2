export const RIS_NAMESPACES = ['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'];

export const YT_NAMESPACES = ['4455', 'Islam_The_Ultimate_Peace', '2238', 'Islamic_Guidance', '2004', 'MercifulServant', '1572', 'Towards_Eternity'];

export const determineCitationType = (citation: any): string => {
  if (citation.metadata?.type) {
    const type = citation.metadata.type.toLowerCase();
    if (['classic', 'cls'].includes(type)) return 'CLS';
    if (['modern', 'mod'].includes(type)) return 'MOD';
    if (['risale', 'ris'].includes(type)) return 'RIS';
    if (['youtube', 'yt'].includes(type)) return 'YT';
    return citation.metadata.type.toUpperCase();
  }
  if (citation.namespace) {
    if (RIS_NAMESPACES.includes(citation.namespace)) return 'RIS';
    if (YT_NAMESPACES.includes(citation.namespace)) return 'YT';
  }
  if (!citation.metadata?.type && !citation.namespace) return 'CLS';
  return 'UNKNOWN';
};

export const formatBookOrNamespace = (name: string): string => {
  return name.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export const filterEligibleCitations = (citations: any[]) => {
  return citations
    .map((citation: any, i: number) => ({ citation, i }))
    .filter((item: {citation: any, i: number}) => {
      const { citation } = item;
      const type = determineCitationType(citation);
      
      // Original filter for CLS type without source_file
      if (type === 'CLS' && !citation.metadata?.source_file) {
        return false;
      }

      // Refined filter: Check for sources with only specific metadata and no namespace
      if (!citation.namespace && citation.metadata) {
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
      return true; // Keep citation if no filter condition met
    });
}; 