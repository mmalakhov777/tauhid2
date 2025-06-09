'use client';

import { useState, useCallback } from 'react';
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

const sources = [
  {
    id: 'classic' as keyof SourceSelection,
    label: 'Classical Books',
    description: 'Traditional Islamic texts and scholarly works',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: 'risale' as keyof SourceSelection,
    label: 'Tafsirs',
    description: 'Quranic commentary and interpretation',
    icon: <ScrollText className="h-4 w-4" />,
  },
  {
    id: 'fatwa' as keyof SourceSelection,
    label: 'Fatwa Websites',
    description: 'Islamic legal rulings and opinions',
    icon: <Scale className="h-4 w-4" />,
  },
  {
    id: 'youtube' as keyof SourceSelection,
    label: 'YouTube Videos',
    description: 'Islamic educational video content',
    icon: <Youtube className="h-4 w-4" />,
  },
];

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

  const handleSourceToggle = useCallback((sourceId: keyof SourceSelection) => {
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

  const selectedCount = Object.values(selectedSources).filter(Boolean).length;
  const allSelected = selectedCount === sources.length;
  const noneSelected = selectedCount === 0;

  const getButtonText = () => {
    if (allSelected) return 'All Sources';
    if (noneSelected) return 'No Sources';
    if (selectedCount === 1) {
      const selectedSource = sources.find(s => selectedSources[s.id]);
      return selectedSource?.label || 'Sources';
    }
    return `${selectedCount} Sources`;
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
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px] bg-white/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl p-2">
        <DropdownMenuLabel>Search Sources</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {sources.map((source) => (
          <DropdownMenuItem
            key={source.id}
            onSelect={() => handleSourceToggle(source.id)}
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