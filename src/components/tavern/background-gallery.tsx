'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Image as ImageIcon, 
  Video, 
  RefreshCw, 
  X,
  FolderOpen,
  Search,
  Check,
  Loader2,
  Maximize,
  Shrink,
  Move
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTavernStore } from '@/store/tavern-store';
import type { BackgroundFit } from '@/types';

interface BackgroundFile {
  name: string;
  url: string;
  type: 'image' | 'video';
}

interface BackgroundCollection {
  name: string;
  path: string;
  files: BackgroundFile[];
}

interface BackgroundGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fitModes: { value: BackgroundFit; label: string; icon: typeof Maximize; description: string }[] = [
  { value: 'cover', label: 'Cover', icon: Maximize, description: 'Fill area, may crop' },
  { value: 'contain', label: 'Fit', icon: Shrink, description: 'Show entire image' },
  { value: 'stretch', label: 'Stretch', icon: Move, description: 'Stretch to fill' },
];

export function BackgroundGallery({ open, onOpenChange }: BackgroundGalleryProps) {
  const [collections, setCollections] = useState<BackgroundCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const activeBackground = useTavernStore((state) => state.activeBackground);
  const setActiveBackground = useTavernStore((state) => state.setActiveBackground);
  const backgroundFit = useTavernStore((state) => state.settings.backgroundFit);
  const updateSettings = useTavernStore((state) => state.updateSettings);

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backgrounds/collections');
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching backgrounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCollections();
    }
  }, [open, fetchCollections]);

  const handleSelectBackground = (url: string) => {
    setActiveBackground(url);
    onOpenChange(false);
  };

  const handleRefresh = () => {
    fetchCollections();
  };

  // Filter files based on search
  const filteredCollections = collections.map(collection => ({
    ...collection,
    files: collection.files.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(collection => collection.files.length > 0);

  // Get all files for "All" view
  const allFiles = collections.flatMap(c => c.files);
  const filteredAllFiles = searchTerm 
    ? allFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : allFiles;

  // Get current files to display
  const currentFiles = selectedCollection 
    ? filteredCollections.find(c => c.name === selectedCollection)?.files || []
    : filteredAllFiles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        fullscreen
        className="p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Background Gallery
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Fit Mode Selector */}
              <TooltipProvider>
                <div className="flex items-center gap-1 border rounded-md p-1">
                  {fitModes.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <Tooltip key={mode.value}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={backgroundFit === mode.value ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSettings({ backgroundFit: mode.value })}
                          >
                            <Icon className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{mode.label}</p>
                          <p className="text-xs text-muted-foreground">{mode.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Refresh</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Collections Sidebar */}
          <div className="w-48 border-r flex-shrink-0 bg-muted/30">
            <div className="p-2">
              <Button
                variant={selectedCollection === null ? 'default' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setSelectedCollection(null)}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                All ({allFiles.length})
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {collections.map(collection => (
                  <Button
                    key={collection.name}
                    variant={selectedCollection === collection.name ? 'default' : 'ghost'}
                    size="sm"
                    className="w-full justify-start truncate"
                    onClick={() => setSelectedCollection(collection.name)}
                  >
                    <FolderOpen className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{collection.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {collection.files.length}
                    </span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search backgrounds..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Gallery Grid */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : currentFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p>No backgrounds found</p>
                  <p className="text-xs mt-1">Add images or videos to /public/backgrounds/</p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {currentFiles.map((file, index) => (
                    <BackgroundCard
                      key={`${file.url}-${index}`}
                      file={file}
                      isActive={activeBackground === file.url}
                      onSelect={() => handleSelectBackground(file.url)}
                      onPreview={() => setPreviewUrl(file.url)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Preview Modal */}
        {previewUrl && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            {previewUrl.match(/\.(mp4|webm|mov|avi|mkv|ogv)$/i) ? (
              <video 
                src={previewUrl} 
                className="max-w-full max-h-full object-contain"
                autoPlay
                loop
                muted
              />
            ) : (
              <img 
                src={previewUrl} 
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Individual background card
function BackgroundCard({ 
  file, 
  isActive, 
  onSelect,
  onPreview 
}: { 
  file: BackgroundFile;
  isActive: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const isVideo = file.type === 'video';

  return (
    <div 
      className={cn(
        "group relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
        isActive 
          ? "border-primary ring-2 ring-primary/30" 
          : "border-transparent hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      {/* Loading State */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center">
          <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground truncate px-1">Error</span>
        </div>
      )}

      {/* Thumbnail */}
      {!hasError && (
        isVideo ? (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <video 
              src={file.url}
              className="w-full h-full object-cover"
              muted
              onMouseEnter={(e) => {
                (e.target as HTMLVideoElement).play();
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLVideoElement).pause();
                (e.target as HTMLVideoElement).currentTime = 0;
              }}
              onError={() => setHasError(true)}
              onLoadedData={() => setIsLoading(false)}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Video className="w-8 h-8 text-white drop-shadow-lg opacity-70" />
            </div>
          </div>
        ) : (
          <img
            src={file.url}
            alt={file.name}
            className={cn(
              "w-full h-full object-cover transition-opacity",
              isLoading && "opacity-0"
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )
      )}

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Video Badge */}
      {isVideo && !hasError && (
        <div className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5">
          <Video className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Hover Actions */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          Preview
        </Button>
      </div>

      {/* Filename */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
        <p className="text-xs text-white truncate">{file.name}</p>
      </div>
    </div>
  );
}

export default BackgroundGallery;
