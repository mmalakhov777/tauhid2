export const SOURCE_DESCRIPTIONS: Record<string, string> = {
  // IslamQA domains
  'islamqa.org': 'A comprehensive Islamic Q&A website providing authentic Islamic rulings and guidance based on Quran and Sunnah.',
  'islamqa.info': 'An Islamic question and answer website offering scholarly responses to various Islamic queries.',
  
  // Major Islamic Q&A platforms
  'muftionline.co.za': 'A leading South African Islamic Q&A platform providing authentic Hanafi fiqh rulings from qualified Muftis.',
  'daruliftaa.us': 'An American Islamic jurisprudence institute offering reliable fatwas and religious guidance from trained scholars.',
  'askimam.org': 'A trusted Islamic Q&A platform where qualified Muftis provide authentic Islamic rulings and guidance.',
  'hadithanswers.com': 'A specialized platform focusing on Hadith verification and Islamic scholarly answers with authentic references.',
  'daruliftabirmingham.co.uk': 'A UK-based Islamic institute providing Hanafi fiqh rulings and religious guidance from qualified scholars.',
  'seekersguidance.org': 'An online Islamic learning platform offering courses and answers from traditional Islamic scholars.',
  'darulifta-deoband.com': 'The official fatwa portal of Darul Uloom Deoband, providing authentic Islamic rulings from renowned Deobandi scholars.',
  
  // Shariah Board domains
  'shariahboard.org': 'An Islamic jurisprudence platform providing Hanafi fiqh rulings and religious guidance from qualified scholars.',
  
  // Other Islamic sources
  'islamweb.net': 'A comprehensive Islamic website offering fatwas, articles, and religious guidance in multiple languages.',
  'dar-alifta.org': 'The official website of Dar al-Ifta Al-Missriyyah, providing authoritative Islamic rulings from Egyptian scholars.',
  'islamonline.net': 'A global Islamic website providing contemporary Islamic perspectives on various life matters.',
  
  // Classical Islamic sources
  'CLS': 'Classical Islamic texts and jurisprudential works from renowned Islamic scholars and jurists throughout history.',
  'classic': 'Traditional Islamic scholarly works that form the foundation of Islamic jurisprudence and theology.',
  
  // Specific Classical Books
  'Fatawa Qazi Khan': 'A comprehensive collection of Hanafi jurisprudential rulings compiled by Qazi Khan, serving as a foundational reference for Islamic legal decisions and scholarly opinions.',
  'Rad-ul-Muhtar': 'A detailed commentary on Al-Durr al-Mukhtar by Ibn Abidin, considered one of the most authoritative works in Hanafi jurisprudence and Islamic legal methodology.',
  'Badai-al-Sanai': 'A masterwork of Hanafi jurisprudence by Al-Kasani, providing detailed explanations of Islamic legal principles and their practical applications in daily life.',
  'Sharh al-Wiqayah': 'An important commentary on Al-Wiqayah by Ubaydullah ibn Masud, offering profound insights into Hanafi legal theory and jurisprudential methodology.',
  
  // Modern Islamic sources
  'MOD': 'Contemporary Islamic scholarly works and modern interpretations of Islamic teachings.',
  'modern': 'Modern Islamic scholarship addressing contemporary issues through traditional Islamic methodology.',
  
  // Risale-i Nur
  'RIS': 'The Risale-i Nur collection by Bediuzzaman Said Nursi, offering profound insights into Islamic spirituality and theology.',
  'risale': 'Works from the Risale-i Nur collection, providing deep spiritual and theological guidance.',
  
  // Default fallbacks
  'islamqa_fatwa': 'Islamic scholarly rulings and guidance provided through question and answer format.',
  'unknown': 'Islamic source providing religious guidance and scholarly opinions.',
};

export const getSourceDescription = (domain: string, type?: string): string => {
  // First try to get description by domain
  if (domain && SOURCE_DESCRIPTIONS[domain]) {
    return SOURCE_DESCRIPTIONS[domain];
  }
  
  // Then try by type
  if (type && SOURCE_DESCRIPTIONS[type]) {
    return SOURCE_DESCRIPTIONS[type];
  }
  
  // Default fallback
  return SOURCE_DESCRIPTIONS['unknown'];
}; 