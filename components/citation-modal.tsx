'use client';

import { X, Youtube, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CitationMarker } from './citation-marker';
import { useState, useEffect } from 'react';
import { getSourceDescription, SOURCE_DESCRIPTIONS } from './source-descriptions';
import { Button } from './ui/button';
import { useTelegramHaptics } from '@/hooks/use-telegram-haptics';
import { Markdown } from './markdown';
import { createPortal } from 'react-dom';
import { useTranslations } from '@/contexts/TranslationContext';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: any;
  citationNumber: number;
  allMessages?: any[];
}

export function CitationModal({ isOpen, onClose, citation, citationNumber, allMessages }: CitationModalProps) {
  const { t, translations, language } = useTranslations();
  
  // Create a safe translation function that works in portal context
  const safeT = (key: string): string => {
    // First try the regular t function
    try {
      const result = t(key);
      // If translation exists and is different from key, use it
      if (result !== key) {
        return result;
      }
    } catch (error) {
      // If t() fails, continue to fallback
    }
    
    // Fallback to English translations
    const fallbacks: Record<string, string> = {
      'citationModal.citationDetails': 'Citation Details',
      'citationModal.originalText': 'Original Text',
      'citationModal.fullText': 'Full Text',
      'citationModal.sourceType': 'Source Type',
      'citationModal.metadata': 'Metadata',
      'citationModal.additionalInformation': 'Additional Information',
      'citationModal.aiExplanation': 'AI Explanation',
      'citationModal.analyzingConnection': 'Analyzing the connection...',
      'citationModal.backToResponse': 'Back to response',
      'citationModal.noTextAvailable': '[No text available]',
      'citationModal.noOriginalTextAvailable': '[No original text available]',
      'citationModal.noTextFromPdf': '[No text available from PDF]',
      'citationModal.noTranscriptAvailable': '[No transcript available]',
      'citationModal.failedToLoadPdfText': 'Failed to load text from PDF',
      'citationModal.failedToLoadYoutubeTranscript': 'Failed to load transcript from YouTube',
      'citationModal.failedToGenerateExplanation': 'Failed to generate explanation. Please try again.',
      'citationModal.relevanceScore': 'Relevance Score',
      'citationModal.source': 'Source',
      'citationModal.namespace': 'Namespace',
      'citationModal.searchQuery': 'Search Query',
      'citationModal.volume': 'Volume',
      'citationModal.page': 'Page',
      'citationModal.classicalIslamicText': 'Classical Islamic Text',
      'citationModal.risaleiNurCollection': 'Risale-i Nur Collection',
      'citationModal.author': 'Author',
      'citationModal.extractedText': 'Extracted Text',
      'citationModal.sourceLink': 'Source Link',
      'citationModal.url': 'URL',
      'citationModal.sourceName': 'Source Name',
      'citationModal.alterLink': 'Alter Link',
      'citationModal.id': 'ID',
      'citationModal.typeLabels.risaleNur': 'Risale-i Nur',
      'citationModal.typeLabels.youtube': 'YouTube',
      'citationModal.typeLabels.classicalSource': 'Classical Source',
      'citationModal.typeLabels.modernSource': 'Modern Source',
      'citationModal.typeLabels.islamqaFatwa': 'IslamQA Fatwa',
      'citationModal.typeLabels.unknownSource': 'Unknown Source'
    };
    
    return fallbacks[key] || key;
  };
  const [activeTab, setActiveTab] = useState<'details' | 'original'>('details');
  const [pdfText, setPdfText] = useState<string>('');
  const [isLoadingPdfText, setIsLoadingPdfText] = useState(false);
  const [pdfTextError, setPdfTextError] = useState<string | null>(null);
  const [youtubeTranscript, setYoutubeTranscript] = useState<string>('');
  const [isLoadingYoutubeTranscript, setIsLoadingYoutubeTranscript] = useState(false);
  const [youtubeTranscriptError, setYoutubeTranscriptError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const { impactOccurred, notificationOccurred } = useTelegramHaptics();
  
  // Add glass effect styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .citation-modal-glass {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.30) 0%, 
          rgba(255, 255, 255, 0.16) 50%, 
          rgba(255, 255, 255, 0.30) 100%) !important;
        backdrop-filter: blur(30px) saturate(180%) contrast(100%) brightness(100%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(180%) contrast(100%) brightness(100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 16px !important;
        margin: 8px !important;
        height: calc(100vh - 16px) !important;
        width: calc(100% - 16px) !important;
        max-width: calc(32rem - 16px) !important;
        box-shadow: 
          0 16px 50px 0 rgba(0, 0, 0, 0.03),
          0 4px 25px 0 rgba(0, 0, 0, 0.015) !important;
      }
      .dark .citation-modal-glass {
        background: linear-gradient(135deg, 
          rgba(255, 255, 255, 0.001) 0%, 
          rgba(255, 255, 255, 0.0005) 50%, 
          rgba(255, 255, 255, 0.001) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 16px !important;
        margin: 8px !important;
        height: calc(100vh - 16px) !important;
        width: calc(100% - 16px) !important;
        max-width: calc(32rem - 16px) !important;
        box-shadow: 
          0 16px 50px 0 rgba(0, 0, 0, 0.15),
          0 4px 25px 0 rgba(0, 0, 0, 0.08) !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Log what data is received by the modal
  console.log('🔧 CitationModal received - isOpen:', isOpen);
  console.log('🔧 CitationModal received - citationNumber:', citationNumber);
  console.log('🔧 CitationModal received - citation:', citation);
  console.log('🔧 CitationModal received - citation.metadata:', citation?.metadata);
  console.log('🔧 CitationModal received - citation.namespace:', citation?.namespace);
  
  if (!citation) return null;

  // Determine the type
  let type = 'unknown';
  if (citation.metadata?.type) {
    type = citation.metadata.type;
  } else if (citation.metadata?.content_type === 'islamqa_fatwa') {
    type = 'islamqa_fatwa';
  } else if (citation.namespace) {
    if (['Sozler-Bediuzzaman_Said_Nursi', 'Mektubat-Bediuzzaman_Said_Nursi', 'lemalar-bediuzzaman_said_nursi', 'Hasir_Risalesi-Bediuzzaman_Said_Nursi', 'Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi', 'Hastalar_Risalesi-Bediuzzaman_Said_Nursi', 'ihlas_risaleleri-bediuzzaman_said_nursi', 'enne_ve_zerre_risalesi-bediuzzaman_said_nursi', 'tabiat_risalesi-bediuzzaman_said_nursi', 'kader_risalesi-bediuzzaman_said_nursi'].includes(citation.namespace)) {
      type = 'RIS';
    } else if (['youtube-qa-pairs'].includes(citation.namespace)) {
      type = 'YT';
    } else if (['Maarif-ul-Quran', 'Bayan-ul-Quran', 'Kashf-Al-Asrar', 'Tazkirul-Quran', 'Tanweer-Tafsir'].includes(citation.namespace)) {
      type = 'TAF';
    }
  } else if (!citation.metadata?.type && !citation.namespace) {
    type = 'CLS';
  }

  const typeLabels: Record<string, string> = {
    'RIS': safeT('citationModal.typeLabels.risaleNur'),
    'YT': safeT('citationModal.typeLabels.youtube'),
    'TAF': 'Tafsir',
    'CLS': safeT('citationModal.typeLabels.classicalSource'),
    'classic': safeT('citationModal.typeLabels.classicalSource'),
    'modern': safeT('citationModal.typeLabels.modernSource'),
    'risale': safeT('citationModal.typeLabels.risaleNur'),
    'youtube': safeT('citationModal.typeLabels.youtube'),
    'tafsirs': 'Tafsir',
    'islamqa_fatwa': safeT('citationModal.typeLabels.islamqaFatwa'),
    'unknown': safeT('citationModal.typeLabels.unknownSource')
  };

  const isYouTube = type === 'YT' || type === 'youtube';
  const isClassical = type === 'CLS' || type === 'classic';
  const isRisale = type === 'RIS' || type === 'risale';
  const isTafsir = type === 'TAF' || type === 'tafsirs';
  const isIslamQA = type === 'islamqa_fatwa';
  const thumbnailUrl = citation.metadata?.thumbnail_url;
  const videoId = citation.metadata?.video_id;
  const timestamp = citation.metadata?.timestamp;
  
  // Check if this is Fatawa Qazi Khan
  const isFatawaQaziKhan = isClassical && (
    citation.metadata?.source_file?.includes('FATAWA-QAZI-KHAN-')
  );

  // Check if this is Rad-ul-Muhtar
  const isRaddulMuhtar = isClassical && citation.metadata?.source_file?.startsWith('Rad-ul-Muhtar-Vol');

  // Check if this is Badai-al-Sanai
  const isBadaiAlSanai = isClassical && citation.metadata?.source_file?.match(/Badai-al-Sanai-Urdu-Vol-\d+_hocr_searchtext\.txt\.gz/);

  // Check if this is Sharh al-Wiqayah
  const isSharhWiqayah = isClassical && citation.metadata?.source_file?.match(/SharhWiqayah\d+_hocr_searchtext\.txt\.gz/);

  // Check if this is Al-Hidaya
  const isAlHidaya = isClassical && (citation.metadata?.book_name === 'Al-Hidaya' || citation.metadata?.source_file === 'Al_Hidaya_in_English.txt');

  // Check if this is Al-Mabsut Sarakhsi
  const isAlMabsut = isClassical && (citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_HanafiFiqh.txt' || citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_Index.txt');

  // Check if this is Usul al-Fiqh Sarakhsi
  const isUsulAlFiqhSarakhsi = isClassical && citation.metadata?.source_file === 'UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.txt';

  // Check if this is Nukat Ziyadat al-Ziyadat
  const isNukatZiyadat = isClassical && citation.metadata?.source_file === 'Nukat_ZiyadatAlZiyadat_HanafiNotes.txt';

  // Check if this is Sharh Siyar al-Kabir Sarakhsi
  const isSharhSiyarAlKabir = isClassical && citation.metadata?.source_file === 'SharhSiyarAlKabir_Sarakhsi_InternationalLaw.txt';

  // Build YouTube embed URL with timestamp if available
  let embedUrl = '';
  if (videoId) {
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
    if (timestamp) {
      // YouTube embed uses 'start' parameter for seconds
      embedUrl += `?start=${timestamp}`;
    }
  }

  // Build PDF URL for Risale-i Nur sources
  let pdfUrl = '';
  if (isRisale) {
    // Get the book identifier from namespace or book_name
    const bookIdentifier = citation.namespace || citation.metadata?.book_name;
    if (bookIdentifier) {
      // Map to PDF filename
      const pdfFilename = `${bookIdentifier}.pdf`;
      // Build the URL path
      pdfUrl = `/pdfs/Risale-i Nur Bediuzzaman Said Nursi/${pdfFilename}`;
      
      // If page_number is available, add it to the URL
      if (citation.metadata?.page_number) {
        pdfUrl += `#page=${citation.metadata.page_number}`;
      }
    }
  }

  // Fetch PDF text when modal opens for Risale-i Nur sources
  useEffect(() => {
    if (isOpen && isRisale && citation.metadata?.book_name && citation.metadata?.page_number) {
      const fetchPdfText = async () => {
        setIsLoadingPdfText(true);
        setPdfTextError(null);
        
        try {
          const response = await fetch('/api/pdf-text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bookName: citation.metadata.book_name,
              pageNumber: citation.metadata.page_number,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to fetch PDF text');
          }

          const data = await response.json();
          setPdfText(data.text || '');
        } catch (error) {
          console.error('Error fetching PDF text:', error);
          setPdfTextError(safeT('citationModal.failedToLoadPdfText'));
        } finally {
          setIsLoadingPdfText(false);
        }
      };

      fetchPdfText();
    }
  }, [isOpen, isRisale, citation.metadata?.book_name, citation.metadata?.page_number]);

  // Fetch YouTube transcript when modal opens for YouTube sources
  useEffect(() => {
    if (isOpen && isYouTube && citation.metadata?.video_id) {
      const fetchYoutubeTranscript = async () => {
        setIsLoadingYoutubeTranscript(true);
        setYoutubeTranscriptError(null);
        
        try {
          const response = await fetch('/api/youtube-transcript', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId: citation.metadata.video_id,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to fetch YouTube transcript');
          }

          const data = await response.json();
          setYoutubeTranscript(data.transcript || '');
        } catch (error) {
          console.error('Error fetching YouTube transcript:', error);
          setYoutubeTranscriptError(safeT('citationModal.failedToLoadYoutubeTranscript'));
        } finally {
          setIsLoadingYoutubeTranscript(false);
        }
      };

      fetchYoutubeTranscript();
    }
  }, [isOpen, isYouTube, citation.metadata?.video_id]);

  // Auto-generate explanation when modal opens
  useEffect(() => {
    if (isOpen && allMessages && allMessages.length > 0) {
      // Small delay to ensure all data is loaded
      const timer = setTimeout(() => {
        generateExplanation();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, allMessages]);

  // Function to generate explanation
  const generateExplanation = async () => {
    setIsLoadingExplanation(true);
    setShowExplanation(true);
    impactOccurred('light'); // Haptic feedback when starting
    
    try {
      // Get user's question and assistant's response from allMessages
      let lastUserMessage = '';
      let lastAssistantMessage = '';
      
      if (allMessages && allMessages.length > 0) {
        // Find the last user message
        for (let i = allMessages.length - 1; i >= 0; i--) {
          const msg = allMessages[i];
          if (msg.role === 'user' && msg.parts) {
            const textPart = msg.parts.find((p: any) => p.type === 'text');
            if (textPart && textPart.text) {
              lastUserMessage = textPart.text;
              break;
            }
          }
        }
        
        // Find the last assistant message
        for (let i = allMessages.length - 1; i >= 0; i--) {
          const msg = allMessages[i];
          if (msg.role === 'assistant' && msg.parts) {
            const textPart = msg.parts.find((p: any) => p.type === 'text');
            if (textPart && textPart.text) {
              lastAssistantMessage = textPart.text;
              break;
            }
          }
        }
      }
      
      // Get selected language from localStorage
      const selectedLanguage = localStorage.getItem('selectedLanguage') || 'en';
      
      console.log('Message extraction results:', {
        hasAllMessages: !!allMessages,
        messagesCount: allMessages?.length || 0,
        lastUserMessage: lastUserMessage.substring(0, 100) + '...',
        lastAssistantMessage: lastAssistantMessage.substring(0, 100) + '...',
      });
      
      // Validate we have the required data
      if (!lastUserMessage || !lastAssistantMessage) {
        console.error('Missing message content:', {
          hasUserMessage: !!lastUserMessage,
          hasAssistantMessage: !!lastAssistantMessage,
          allMessagesLength: allMessages?.length || 0
        });
        setExplanation('Unable to find the conversation context. Please try again.');
        setIsLoadingExplanation(false);
        return;
      }
      
      // Get source name
      let sourceName = '';
      if (isClassical) {
        // For classical sources, use the source metadata or book name
        sourceName = citation.metadata?.source || 'Classical Islamic Text';
        // Add specific book names if available
        if (isFatawaQaziKhan) {
          sourceName = 'Fatawa Qazi Khan';
        } else if (isRaddulMuhtar) {
          sourceName = 'Rad-ul-Muhtar';
        } else if (isBadaiAlSanai) {
          sourceName = 'Badai-al-Sanai';
        } else if (isSharhWiqayah) {
          sourceName = 'Sharh al-Wiqayah';
        } else if (isAlHidaya) {
          sourceName = 'Al-Hidaya';
        } else if (isAlMabsut) {
          sourceName = 'Al-Mabsut Sarakhsi';
        } else if (isUsulAlFiqhSarakhsi) {
          sourceName = 'Usul al-Fiqh Sarakhsi';
        } else if (isNukatZiyadat) {
          sourceName = 'Nukat Ziyadat al-Ziyadat';
        } else if (isSharhSiyarAlKabir) {
          sourceName = 'Sharh Siyar al-Kabir Sarakhsi';
        }
      } else if (isRisale) {
        // For Risale-i Nur sources, use the book name
        sourceName = citation.metadata?.book_name?.replace(/-/g, ' ').replace(/_/g, ' ') || 'Risale-i Nur';
      } else if (isTafsir) {
        // For Tafsir sources, use the namespace to determine the name
        switch (citation.namespace) {
          case 'Maarif-ul-Quran':
            sourceName = 'Maarif-ul-Quran';
            break;
          case 'Bayan-ul-Quran':
            sourceName = 'Tafsir Bayan ul Quran';
            break;
          case 'Kashf-Al-Asrar':
            sourceName = 'Kashf Al-Asrar Tafsir';
            break;
          case 'Tazkirul-Quran':
            sourceName = 'Tazkirul Quran';
            break;
          case 'Tanweer-Tafsir':
            sourceName = 'Tafseer Tanwir al-Miqbas';
            break;
          default:
            sourceName = 'Tafsir';
        }
      } else if (isYouTube) {
        // For YouTube sources, use the author/channel name
        sourceName = citation.metadata?.author || 'YouTube Video';
      } else {
        // For IslamQA sources, extract from URL
        try {
          const url = new URL(citation.metadata?.source_link || citation.metadata?.url || '');
          sourceName = url.hostname.replace('www.', '');
        } catch {
          sourceName = 'IslamQA';
        }
      }
      
      // Get the original text based on source type
      let originalText = '';
      if (isClassical) {
        // For classical sources, use original_text from metadata
        originalText = citation.metadata?.original_text || citation.text || '[No original text available]';
      } else if (isRisale) {
        // For Risale-i Nur sources, use the PDF text if available, otherwise fallback to citation text
        originalText = pdfText || citation.text || '[No text available from PDF]';
      } else if (isTafsir) {
        // For Tafsir sources, use the text field
        originalText = citation.text || '[No tafsir text available]';
      } else if (isYouTube) {
        // For YouTube sources, use the transcript if available, otherwise fallback to citation text
        originalText = youtubeTranscript || citation.text || '[No transcript available]';
      } else {
        // For other sources (IslamQA, etc.), use the text field
        originalText = citation.text || '[No text available]';
      }
      
      console.log('Sending fatwa explanation request:', {
        originalTextLength: originalText.length,
        userQuestionLength: lastUserMessage.length,
        responseContentLength: lastAssistantMessage.length,
        selectedLanguage,
        citationNumber,
        sourceName,
        sourceType: isClassical ? 'classical' : isRisale ? 'risale' : isTafsir ? 'tafsir' : isYouTube ? 'youtube' : 'islamqa',
      });
      
      const response = await fetch('/api/fatwa-explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalText,
          userQuestion: lastUserMessage,
          responseContent: lastAssistantMessage,
          selectedLanguage,
          citationNumber,
          sourceName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fatwa explanation API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(`Failed to generate explanation: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullExplanation = '';

      if (reader) {
        // Start with empty explanation to show streaming
        setExplanation('');
        
        const processText = (text: string) => {
          // Process text to ensure smooth word-by-word streaming
          const words = text.split(/(\s+)/);
          return words.join('');
        };
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining buffer
            if (buffer) {
              fullExplanation += buffer;
              setExplanation(processText(fullExplanation));
            }
            break;
          }
          
          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete words/sentences
          const lastSpaceIndex = buffer.lastIndexOf(' ');
          if (lastSpaceIndex !== -1) {
            const completeText = buffer.substring(0, lastSpaceIndex + 1);
            buffer = buffer.substring(lastSpaceIndex + 1);
            fullExplanation += completeText;
            setExplanation(processText(fullExplanation));
          }
          
          // If buffer gets too large, flush it
          if (buffer.length > 100) {
            fullExplanation += buffer;
            buffer = '';
            setExplanation(processText(fullExplanation));
          }
        }
        
        // Haptic feedback when streaming completes
        notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error generating explanation:', error);
      setExplanation(safeT('citationModal.failedToGenerateExplanation'));
      notificationOccurred('error'); // Error haptic
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  // Use portal to render outside the chat container's stacking context
  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[99999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg z-[99999] overflow-hidden citation-modal-glass"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <CitationMarker number={citationNumber} className="cursor-default" />
                  {isClassical ? (
                    <div className="flex items-center gap-4">
                      {/* Tabs for classical sources */}
                      <div className="flex bg-muted rounded-lg p-1">
                        <button
                          onClick={() => setActiveTab('details')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'details' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.citationDetails')}
                        </button>
                        <button
                          onClick={() => setActiveTab('original')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'original' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.originalText')}
                        </button>
                      </div>
                    </div>
                  ) : isRisale ? (
                    <div className="flex items-center gap-4">
                      {/* Tabs for Risale-i Nur sources */}
                      <div className="flex bg-muted rounded-lg p-1">
                        <button
                          onClick={() => setActiveTab('details')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'details' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.citationDetails')}
                        </button>
                        <button
                          onClick={() => setActiveTab('original')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'original' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.originalText')}
                        </button>
                      </div>
                    </div>
                  ) : isTafsir ? (
                    <div className="flex items-center gap-4">
                      {/* Tabs for Tafsir sources */}
                      <div className="flex bg-muted rounded-lg p-1">
                        <button
                          onClick={() => setActiveTab('details')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'details' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.citationDetails')}
                        </button>
                        <button
                          onClick={() => setActiveTab('original')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'original' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.originalText')}
                        </button>
                      </div>
                    </div>
                  ) : isIslamQA ? (
                    <div className="flex items-center gap-4">
                      {/* Tabs for IslamQA sources */}
                      <div className="flex bg-muted rounded-lg p-1">
                        <button
                          onClick={() => setActiveTab('details')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'details' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.citationDetails')}
                        </button>
                        <button
                          onClick={() => setActiveTab('original')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'original' 
                              ? "bg-background text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {safeT('citationModal.originalText')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-lg font-semibold">{safeT('citationModal.citationDetails')}</h2>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20 sm:pb-6">
                {/* Classical sources with tabs */}
                {isClassical ? (
                  <>
                    {/* Citation Details Tab */}
                    {activeTab === 'details' && (
                      <>
                        {/* Fatawa Qazi Khan */}
                        {isFatawaQaziKhan && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
                              {/* Cover Image - 40% */}
                              <div className="w-[40%] flex-shrink-0">
                                <div className="relative w-full h-full bg-muted">
                                  <img 
                                    src="/images/fatawa-qazi-khan.webp" 
                                    alt="Fatawa Qazi Khan cover"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                              
                              {/* Content - 60% */}
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Fatawa Qazi Khan
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Fatawa Qazi Khan']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Rad-ul-Muhtar */}
                        {isRaddulMuhtar && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
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
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Rad-ul-Muhtar
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Rad-ul-Muhtar']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Badai-al-Sanai */}
                        {isBadaiAlSanai && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
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
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Badai-al-Sanai
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Badai-al-Sanai']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sharh al-Wiqayah */}
                        {isSharhWiqayah && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
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
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Sharh al-Wiqayah
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Sharh al-Wiqayah']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Al-Mabsut Sarakhsi */}
                        {isAlMabsut && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
                              {/* Cover Image - 40% */}
                              <div className="w-[40%] flex-shrink-0">
                                <div className="relative w-full h-full bg-muted">
                                  <img 
                                    src={citation.metadata?.source_file === 'Al-Mabsut_Sarakhsi_Index.txt' ? "/images/Al-Mabsut_Sarakhsi_Index.webp" : "/images/Al-Mabsut_Sarakhsi_HanafiFiqh.webp"} 
                                    alt="Al-Mabsut Sarakhsi cover"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                              
                              {/* Content - 60% */}
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Al-Mabsut Sarakhsi
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Al-Mabsut Sarakhsi']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Al-Hidaya */}
                        {isAlHidaya && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
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
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Al-Hidaya
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Al-Hidaya']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Usul al-Fiqh Sarakhsi */}
                        {isUsulAlFiqhSarakhsi && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
                              {/* Cover Image - 40% */}
                              <div className="w-[40%] flex-shrink-0">
                                <div className="relative w-full h-full bg-muted">
                                  <img 
                                    src="/images/UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.webp" 
                                    alt="Usul al-Fiqh Sarakhsi cover"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                              
                              {/* Content - 60% */}
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Usul al-Fiqh Sarakhsi
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Usul al-Fiqh Sarakhsi']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Nukat Ziyadat al-Ziyadat */}
                        {isNukatZiyadat && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
                              {/* Cover Image - 40% */}
                              <div className="w-[40%] flex-shrink-0">
                                <div className="relative w-full h-full bg-muted">
                                  <img 
                                    src="/images/Nukat_ZiyadatAlZiyadat_HanafiNotes.webp" 
                                    alt="Nukat Ziyadat al-Ziyadat cover"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                              
                              {/* Content - 60% */}
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Nukat Ziyadat al-Ziyadat
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Nukat Ziyadat al-Ziyadat']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sharh Siyar al-Kabir Sarakhsi */}
                        {isSharhSiyarAlKabir && (
                          <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                            <div className="flex gap-0 h-32 sm:h-40">
                              {/* Cover Image - 40% */}
                              <div className="w-[40%] flex-shrink-0">
                                <div className="relative w-full h-full bg-muted">
                                  <img 
                                    src="/images/SharhSiyarAlKabir_Sarakhsi_InternationalLaw.webp" 
                                    alt="Sharh Siyar al-Kabir Sarakhsi cover"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                              
                              {/* Content - 60% */}
                              <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                                {/* Book name as title */}
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  Sharh Siyar al-Kabir Sarakhsi
                                </div>
                                
                                {/* Book description */}
                                <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                  {SOURCE_DESCRIPTIONS['Sharh Siyar al-Kabir Sarakhsi']}
                                </div>
                                
                                {/* Metadata */}
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                  {/* Source info */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">{safeT('citationModal.classicalIslamicText')}</span>
                                  </div>
                                  
                                  {/* Volume info */}
                                  {citation.metadata?.volume && (
                                    <div className="text-xs">
                                      {safeT('citationModal.volume')}: {citation.metadata.volume}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Classical source metadata - Question, Answer, Interpretation, and Modern Usage sections are now hidden */}
                        
                        {/* Show explanation */}
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {safeT('citationModal.aiExplanation')}
                            </h3>
                            {isLoadingExplanation && !explanation ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="relative">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20"></div>
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent absolute inset-0"></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground animate-pulse">{safeT('citationModal.analyzingConnection')}</span>
                                </div>
                              </div>
                            ) : (
                              <Markdown>
                                {explanation}
                              </Markdown>
                            )}
                          </motion.div>
                        )}
                      </>
                    )}

                    {/* Original Text Tab */}
                    {activeTab === 'original' && (
                      <div>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed border border-border">
                          {citation.metadata?.original_text || safeT('citationModal.noOriginalTextAvailable')}
                        </div>
                      </div>
                    )}
                  </>
                ) : isRisale ? (
                  <>
                    {/* Citation Details Tab */}
                    {activeTab === 'details' && (
                      <>
                        {/* Risale-i Nur Book Cover and Info */}
                        <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                          <div className="flex gap-0 h-32 sm:h-40">
                            {/* Cover Image - 40% */}
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
                            
                            {/* Content - 60% */}
                            <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                              {/* Book name as title */}
                              {citation.metadata?.book_name && (
                                <div className="text-sm font-semibold text-card-foreground leading-tight">
                                  {citation.metadata.book_name.replace(/-/g, ' ').replace(/_/g, ' ')}
                                </div>
                              )}
                              
                              {/* Dummy description */}
                              <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
                                A profound work from the Risale-i Nur collection by Bediuzzaman Said Nursi, offering deep insights into Islamic spirituality and theology.
                              </div>
                              
                              {/* Metadata */}
                              <div className="flex flex-col gap-0.5 text-xs sm:text-xs text-muted-foreground mt-auto">
                                {/* Source info */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] sm:text-xs">{safeT('citationModal.risaleiNurCollection')}</span>
                                </div>
                                
                                {/* Author */}
                                <div className="text-[10px] sm:text-xs">
                                  {safeT('citationModal.author')}: Bediuzzaman Said Nursi
                                </div>
                                
                                {/* Page info */}
                                {citation.metadata?.page_number && (
                                  <div className="text-[10px] sm:text-xs">
                                    {safeT('citationModal.page')}: {citation.metadata.page_number}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Metadata section is now hidden for Risale-i Nur sources */}
                        
                        {/* Show explanation */}
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {safeT('citationModal.aiExplanation')}
                            </h3>
                            {isLoadingExplanation && !explanation ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="relative">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20"></div>
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent absolute inset-0"></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground animate-pulse">{safeT('citationModal.analyzingConnection')}</span>
                                </div>
                              </div>
                            ) : (
                              <Markdown>
                                {explanation}
                              </Markdown>
                            )}
                          </motion.div>
                        )}
                      </>
                    )}

                    {/* Original Text Tab - PDF Viewer */}
                    {activeTab === 'original' && (
                      <div className="space-y-4">
                        {/* Mobile: Show extracted text */}
                        <div className="block sm:hidden">
                          <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.extractedText')}</h3>
                          {isLoadingPdfText ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="flex flex-col items-center gap-3">
                                <div className="relative">
                                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/20"></div>
                                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent absolute inset-0"></div>
                                </div>
                                <span className="text-sm text-muted-foreground">Loading text...</span>
                              </div>
                            </div>
                          ) : pdfTextError ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                              {pdfTextError}
                            </div>
                          ) : (
                            <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed border border-border max-h-96 overflow-y-auto">
                              {pdfText || citation.text || safeT('citationModal.noTextAvailable')}
                            </div>
                          )}
                        </div>

                        {/* Desktop: Show PDF viewer */}
                        {pdfUrl && (
                          <div className="hidden sm:block">
                            <div className="relative w-full h-[600px] rounded-lg overflow-hidden bg-muted border">
                              <iframe
                                key={`pdf-${citation.metadata?.page_number}`}
                                src={pdfUrl}
                                title="Risale-i Nur PDF"
                                className="w-full h-full"
                                style={{ border: 'none' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : isTafsir ? (
                  <>
                    {/* Citation Details Tab */}
                    {activeTab === 'details' && (
                      <>
                        {/* Tafsir Book Cover and Info */}
                        <div className="rounded-lg border border-border bg-card/50 overflow-hidden shadow-lg">
                          <div className="flex gap-0 h-32 sm:h-40">
                            {/* Cover Image - 40% */}
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
                                    target.parentElement!.innerHTML = '<div class="text-4xl text-muted-foreground flex items-center justify-center h-full">📖</div>';
                                  }}
                                />
                              </div>
                            </div>
                            
                            {/* Content - 60% */}
                            <div className="flex-1 flex flex-col justify-center gap-1.5 p-3">
                              {/* Tafsir name as title */}
                              <div className="text-sm font-semibold text-card-foreground leading-tight">
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
                              
                              {/* Author and description */}
                              <div className="text-xs text-muted-foreground italic leading-tight line-clamp-2">
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
                              
                                                             {/* Metadata */}
                               <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-auto">
                                 {/* Source info */}
                                 <div className="flex items-center gap-2">
                                   <span className="text-xs">Tafsir Commentary</span>
                                 </div>
                                 
                                 {/* Surah and Ayah numbers */}
                                 {(citation.metadata?.surah_number || citation.metadata?.ayah_number) && (
                                   <div className="text-xs">
                                     {citation.metadata?.surah_number && citation.metadata?.ayah_number 
                                       ? `Surah ${citation.metadata.surah_number}, Ayah ${citation.metadata.ayah_number}`
                                       : citation.metadata?.surah_number 
                                         ? `Surah ${citation.metadata.surah_number}`
                                         : `Ayah ${citation.metadata.ayah_number}`
                                     }
                                   </div>
                                 )}
                                 
                                 {/* Language */}
                                 <div className="text-xs">
                                   Language: {(() => {
                                     switch (citation.namespace) {
                                       case 'Maarif-ul-Quran':
                                       case 'Kashf-Al-Asrar':
                                       case 'Tazkirul-Quran':
                                         return 'English';
                                       case 'Bayan-ul-Quran':
                                         return 'Urdu';
                                       case 'Tanweer-Tafsir':
                                         return 'Arabic';
                                       default:
                                         return 'Unknown';
                                     }
                                   })()}
                                 </div>
                               </div>
                            </div>
                          </div>
                        </div>

                        {/* Show explanation */}
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {safeT('citationModal.aiExplanation')}
                            </h3>
                            {isLoadingExplanation && !explanation ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="relative">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20"></div>
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent absolute inset-0"></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground animate-pulse">{safeT('citationModal.analyzingConnection')}</span>
                                </div>
                              </div>
                            ) : (
                              <Markdown>
                                {explanation}
                              </Markdown>
                            )}
                          </motion.div>
                        )}
                      </>
                    )}

                    {/* Original Text Tab */}
                    {activeTab === 'original' && (
                      <div>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed border border-border">
                          {citation.text || safeT('citationModal.noTextAvailable')}
                        </div>
                      </div>
                    )}
                  </>
                ) : isIslamQA ? (
                  <>
                    {/* Citation Details Tab */}
                    {activeTab === 'details' && (
                      <div className="space-y-4">
                        {/* Primary Link - Source Link with URL as fallback */}
                        {(() => {
                          // Check if source_link is a valid URL (starts with http/https)
                          const isSourceLinkValid = citation.metadata?.source_link && 
                            (citation.metadata.source_link.startsWith('http://') || 
                             citation.metadata.source_link.startsWith('https://'));
                          
                          const linkToUse = isSourceLinkValid ? citation.metadata.source_link : citation.metadata?.url;
                          const labelToUse = isSourceLinkValid ? safeT('citationModal.sourceLink') : safeT('citationModal.url');
                          
                          return linkToUse ? (
                            <div className="space-y-4">
                              {/* Source Name - Domain from link */}
                              <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.sourceName')}</h3>
                                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                  <div className="flex items-start gap-3">
                                    {/* Favicon */}
                                    {(() => {
                                      try {
                                        const url = new URL(linkToUse);
                                        const domain = url.hostname.replace('www.', '');
                                        return (
                                          <img 
                                            src={`/favicons/${domain}.png`}
                                            alt={`${domain} favicon`}
                                            className="w-24 h-24 rounded-lg shadow-sm flex-shrink-0"
                                            onError={(e) => {
                                              // Hide the image if favicon doesn't exist
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                            }}
                                          />
                                        );
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                    
                                    {/* Name and description column */}
                                    <div className="flex-1 space-y-1">
                                      {/* Domain name */}
                                      <div className="text-base font-semibold text-foreground">
                                        {(() => {
                                          try {
                                            const url = new URL(linkToUse);
                                            return url.hostname.replace('www.', '');
                                          } catch {
                                            return linkToUse;
                                          }
                                        })()}
                                      </div>
                                      
                                      {/* Description right below name */}
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {(() => {
                                          try {
                                            const url = new URL(linkToUse);
                                            const domain = url.hostname.replace('www.', '');
                                            return getSourceDescription(domain, type);
                                          } catch {
                                            return getSourceDescription('', type);
                                          }
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Link */}
                              <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                                  {labelToUse}
                                </h3>
                                <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                  <a 
                                    href={linkToUse} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                                  >
                                    {linkToUse}
                                  </a>
                                </div>
                              </div>

                              {/* Alter Link - Show URL if different from source_link */}
                              {citation.metadata?.url && citation.metadata.url !== linkToUse && (
                                <div>
                                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                                    {safeT('citationModal.alterLink')}
                                  </h3>
                                  <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                    <a 
                                      href={citation.metadata.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                                    >
                                      {citation.metadata.url}
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null;
                        })()}
                        
                        {/* Show explanation */}
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {safeT('citationModal.aiExplanation')}
                            </h3>
                            {isLoadingExplanation && !explanation ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="relative">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20"></div>
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent absolute inset-0"></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground animate-pulse">{safeT('citationModal.analyzingConnection')}</span>
                                </div>
                              </div>
                            ) : (
                              <Markdown>
                                {explanation}
                              </Markdown>
                            )}
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Original Text Tab */}
                    {activeTab === 'original' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.fullText')}</h3>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed border border-border">
                          {citation.text || safeT('citationModal.noTextAvailable')}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Non-classical sources - existing content */}
                    {/* YouTube sources - show only iframe and AI explanation */}
                    {isYouTube ? (
                      <>
                        {/* YouTube Video/Thumbnail */}
                        {(videoId || thumbnailUrl) && (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                            {videoId ? (
                              <iframe
                                key={`youtube-${timestamp}`}
                                src={embedUrl}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="w-full h-full"
                              />
                            ) : thumbnailUrl ? (
                              <img 
                                src={thumbnailUrl} 
                                alt="YouTube video thumbnail"
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                        )}
                        
                        {/* Show explanation */}
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {safeT('citationModal.aiExplanation')}
                            </h3>
                            {isLoadingExplanation && !explanation ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="relative">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20"></div>
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent absolute inset-0"></div>
                                  </div>
                                  <span className="text-sm text-muted-foreground animate-pulse">{safeT('citationModal.analyzingConnection')}</span>
                                </div>
                              </div>
                            ) : (
                              <Markdown>
                                {explanation}
                              </Markdown>
                            )}
                          </motion.div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Non-YouTube sources */}
                        {/* Source Type */}
                        {!isRisale && (
                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.sourceType')}</h3>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                {typeLabels[type] || type}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Full Text */}
                        {!isRisale && (
                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.fullText')}</h3>
                            <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed border border-border">
                              {citation.text || safeT('citationModal.noTextAvailable')}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div>
                          {!isRisale && (
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.metadata')}</h3>
                          )}
                          <div className="space-y-2">
                            {/* Non-YouTube, non-Risale citations show all fields as before */}
                            <>
                              {citation.score !== undefined && (
                                <div className="flex justify-between py-2 border-b border-border">
                                  <span className="text-sm text-muted-foreground">{safeT('citationModal.relevanceScore')}</span>
                                  <span className="text-sm font-mono text-foreground">{citation.score.toFixed(4)}</span>
                                </div>
                              )}
                              
                              {citation.metadata?.source && (
                                <div className="flex justify-between py-2 border-b border-border">
                                  <span className="text-sm text-muted-foreground">{safeT('citationModal.source')}</span>
                                  <span className="text-sm font-mono text-foreground">{citation.metadata.source}</span>
                                </div>
                              )}
                              
                              {citation.namespace && (
                                <div className="flex justify-between py-2 border-b border-border">
                                  <span className="text-sm text-muted-foreground">{safeT('citationModal.namespace')}</span>
                                  <span className="text-sm font-mono text-foreground">{citation.namespace}</span>
                                </div>
                              )}
                              
                              {citation.id && (
                                <div className="flex justify-between py-2 border-b border-border">
                                  <span className="text-sm text-muted-foreground">{safeT('citationModal.id')}</span>
                                  <span className="text-xs font-mono text-foreground">{citation.id}</span>
                                </div>
                              )}

                              {citation.query && (
                                <div className="py-2 border-b border-border">
                                  <span className="text-sm text-muted-foreground">{safeT('citationModal.searchQuery')}</span>
                                  <div className="mt-1 text-sm font-mono bg-muted/50 rounded p-2 border border-border">
                                    {citation.query}
                                  </div>
                                </div>
                              )}
                            </>
                          </div>
                        </div>

                        {/* Additional metadata fields */}
                        {citation.metadata && Object.keys(citation.metadata).length > 1 && (
                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{safeT('citationModal.additionalInformation')}</h3>
                            <div className="space-y-2">
                              {Object.entries(citation.metadata).map(([key, value]) => {
                                // Always exclude these fields from additional info
                                if (key === 'source' || key === 'type' || key === 'thumbnail_url' || key === 'video_id' || key === 'timestamp') return null;
                                
                                return (
                                  <div key={key} className="flex justify-between py-2 border-b border-border">
                                    <span className="text-sm text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                                    <span className="text-sm text-foreground">{String(value)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}


                  </>
                )}
              </div>

              {/* Fixed Bottom Button - Mobile Only */}
              <div className="block sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
                <Button
                  onClick={onClose}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3"
                >
                  {safeT('citationModal.backToResponse')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Render using portal to escape stacking context
  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
} 