'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, BookOpen, ScrollText, Youtube, Scale } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export interface SourceSelection {
  classic: boolean;
  risale: boolean;
  youtube: boolean;
  fatwa: boolean;
}

const DEFAULT_SOURCES: SourceSelection = {
  classic: true,
  risale: true,
  youtube: true,
  fatwa: true,
};

export function SourceSelector({
  selectedSources = DEFAULT_SOURCES,
  onSourcesChange,
  className,
}: {
  selectedSources?: SourceSelection;
  onSourcesChange?: (sources: SourceSelection) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslations();

  const sources = [
    {
      id: 'classic' as keyof SourceSelection,
      label: t('sources.classicalBooks'),
      description: t('sources.classicalBooksDescription'),
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: 'risale' as keyof SourceSelection,
      label: t('sources.tafsirs'),
      description: t('sources.tafsirsDescription'),
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      id: 'fatwa' as keyof SourceSelection,
      label: t('sources.fatwaWebsites'),
      description: t('sources.fatwaWebsitesDescription'),
      icon: <Scale className="h-4 w-4" />,
    },
    {
      id: 'youtube' as keyof SourceSelection,
      label: t('sources.youtubeVideos'),
      description: t('sources.youtubeVideosDescription'),
      icon: <Youtube className="h-4 w-4" />,
    },
  ];

  const handleSourceToggle = useCallback((sourceId: keyof SourceSelection, event?: Event) => {
    // Prevent dropdown from closing
    event?.preventDefault();
    
    // Prevent unselecting if this is the only selected source
    const selectedCount = Object.values(selectedSources).filter(Boolean).length;
    if (selectedSources[sourceId] && selectedCount === 1) {
      return; // Don't allow unselecting the last source
    }

    const newSources = {
      ...selectedSources,
      [sourceId]: !selectedSources[sourceId],
    };
    console.log('[source-selector] Source toggled:', {
      sourceId,
      oldValue: selectedSources[sourceId],
      newValue: newSources[sourceId],
      newSources,
      timestamp: new Date().toISOString()
    });
    onSourcesChange?.(newSources);
  }, [selectedSources, onSourcesChange]);

  const handleSelectAll = useCallback((event?: Event) => {
    // Prevent dropdown from closing
    event?.preventDefault();
    
    const allSelected: SourceSelection = {
      classic: true,
      risale: true,
      youtube: true,
      fatwa: true,
    };
    console.log('[source-selector] Select all triggered:', {
      newSources: allSelected,
      timestamp: new Date().toISOString()
    });
    onSourcesChange?.(allSelected);
  }, [onSourcesChange]);

  const selectedCount = Object.values(selectedSources).filter(Boolean).length;
  const allSelected = selectedCount === sources.length;
  const noneSelected = selectedCount === 0;

  const getButtonText = () => {
    if (allSelected) return t('sources.allSources');
    if (noneSelected) return t('sources.noSources');
    if (selectedCount === 1) {
      const selectedSource = sources.find(s => selectedSources[s.id]);
      return selectedSource?.label || t('sources.sources');
    }
    return `${selectedCount} ${t('sources.sources')}`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="source-selector"
          variant="outline"
          className="flex px-2 h-[34px] text-xs md:text-sm"
        >
          <BookOpen className="h-4 w-4" />
          {getButtonText()}
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDownIcon className="h-4 w-4" />
          </motion.div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px] !bg-white/10 !backdrop-blur-md !border !border-white/15 !shadow-lg !rounded-xl p-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <DropdownMenuLabel>{t('sources.searchSources')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {!allSelected && (
          <>
            <DropdownMenuItem
              onSelect={handleSelectAll}
              className="gap-4 group/item flex flex-row justify-between items-center font-medium text-primary"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="text-sm">{t('sources.selectAllSources')}</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {sources.map((source) => (
          <DropdownMenuItem
            key={source.id}
            onSelect={(event) => handleSourceToggle(source.id, event)}
            className="gap-4 group/item flex flex-row justify-between items-center"
            data-active={selectedSources[source.id]}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 text-muted-foreground">
                {source.icon}
              </div>
              <div className="flex flex-col gap-1 items-start">
                <div className="font-medium text-sm">{source.label}</div>
                <div className="text-xs text-muted-foreground">
                  {source.description}
                </div>
              </div>
            </div>
            <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
              {selectedSources[source.id] && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        

      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DEFAULT_SOURCES }; 