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
import { ChevronDownIcon, GraduationCap } from 'lucide-react';
import { SourceSelector, type SourceSelection, DEFAULT_SOURCES } from './source-selector';

export interface SchoolSelection {
  hanafi: boolean;
  shafii: boolean;
  maliki: boolean;
  hanbali: boolean;
}

const DEFAULT_SCHOOLS: SchoolSelection = {
  hanafi: true,
  shafii: false,
  maliki: false,
  hanbali: false,
};

const schools = [
  {
    id: 'hanafi' as keyof SchoolSelection,
    label: 'Hanafi',
    description: 'Hanafi school of Islamic jurisprudence',
    icon: <GraduationCap className="h-4 w-4" />,
    available: true,
  },
  {
    id: 'shafii' as keyof SchoolSelection,
    label: 'Shafi\'i',
    description: 'Shafi\'i school of Islamic jurisprudence',
    icon: <GraduationCap className="h-4 w-4" />,
    available: false,
  },
  {
    id: 'maliki' as keyof SchoolSelection,
    label: 'Maliki',
    description: 'Maliki school of Islamic jurisprudence',
    icon: <GraduationCap className="h-4 w-4" />,
    available: false,
  },
  {
    id: 'hanbali' as keyof SchoolSelection,
    label: 'Hanbali',
    description: 'Hanbali school of Islamic jurisprudence',
    icon: <GraduationCap className="h-4 w-4" />,
    available: false,
  },
];

export function SchoolSelector({
  selectedSchools = DEFAULT_SCHOOLS,
  onSchoolsChange,
  selectedSources = DEFAULT_SOURCES,
  onSourcesChange,
  className,
}: {
  selectedSchools?: SchoolSelection;
  onSchoolsChange?: (schools: SchoolSelection) => void;
  selectedSources?: SourceSelection;
  onSourcesChange?: (sources: SourceSelection) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleSchoolToggle = useCallback((schoolId: keyof SchoolSelection, event?: Event) => {
    // Prevent dropdown from closing
    event?.preventDefault();
    
    // Find the school to check if it's available
    const school = schools.find(s => s.id === schoolId);
    if (!school?.available) {
      return; // Don't allow selecting unavailable schools
    }
    
    // Prevent unselecting if this is the only selected source
    const selectedCount = Object.values(selectedSchools).filter(Boolean).length;
    if (selectedSchools[schoolId] && selectedCount === 1) {
      return; // Don't allow unselecting the last school
    }

    const newSchools = {
      ...selectedSchools,
      [schoolId]: !selectedSchools[schoolId],
    };
    console.log('[school-selector] School toggled:', {
      schoolId,
      oldValue: selectedSchools[schoolId],
      newValue: newSchools[schoolId],
      newSchools,
      timestamp: new Date().toISOString()
    });
    onSchoolsChange?.(newSchools);
  }, [selectedSchools, onSchoolsChange]);

  const selectedCount = Object.values(selectedSchools).filter(Boolean).length;
  const allSelected = selectedCount === schools.length;

  const getButtonText = () => {
    const availableSelectedCount = Object.entries(selectedSchools)
      .filter(([schoolId, isSelected]) => {
        const school = schools.find(s => s.id === schoolId);
        return isSelected && school?.available;
      }).length;
    
    if (availableSelectedCount === 1) {
      const selectedSchool = schools.find(s => selectedSchools[s.id] && s.available);
      return selectedSchool?.label || 'School';
    }
    if (availableSelectedCount > 1) {
      return `${availableSelectedCount} Schools`;
    }
    return 'School';
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
          data-testid="school-selector"
          variant="outline"
          className="flex px-2 h-[34px] text-xs md:text-sm"
        >
          <GraduationCap className="h-4 w-4" />
          {getButtonText()}
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px] bg-white/10 dark:bg-gray-900/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl p-2">
        <DropdownMenuLabel>Islamic School</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {schools.map((school) => (
          <DropdownMenuItem
            key={school.id}
            onSelect={(event) => handleSchoolToggle(school.id, event)}
            className={`gap-4 group/item flex flex-row justify-between items-center ${
              !school.available ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            data-active={selectedSchools[school.id]}
            disabled={!school.available}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 text-muted-foreground">
                {school.icon}
              </div>
              <div className="flex flex-col gap-1 items-start">
                <div className="font-medium text-sm flex items-center gap-2">
                  {school.label}
                  {!school.available && (
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {school.description}
                </div>
              </div>
            </div>
            <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
              {selectedSchools[school.id] && school.available && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Source Selector as second level */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="px-0 py-1 text-xs">Search Sources</DropdownMenuLabel>
          <SourceSelector
            selectedSources={selectedSources}
            onSourcesChange={onSourcesChange}
            className="w-full !h-8 !text-xs !px-2 !bg-transparent !border !border-white/20 hover:!bg-white/10 !transition-all !duration-200"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DEFAULT_SCHOOLS }; 