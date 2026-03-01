'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Settings, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { CharacterCard, SpriteConfig, SpriteState } from '@/types';
import { SpritePreview } from './sprite-preview';
import { getSpriteFromCollection } from '@/hooks/use-sprite-triggers';
import { useTavernStore } from '@/store';

// Format milliseconds to readable time
function formatTime(ms: number): string {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

interface GroupSpritesProps {
  characters: CharacterCard[];
  activeCharacterId: string | null;
  isStreaming: boolean;
  maxVisible?: number;
}

interface SpritePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GroupSpriteSettings {
  activeOpacity: number;
  inactiveOpacity: number;
  showAllEqually: boolean;
  globalOpacity: number;
  grayscaleInactive: boolean;
}

interface SavedPositions {
  [characterId: string]: SpritePosition;
}

const DEFAULT_SPRITE: SpritePosition = {
  x: 50,
  y: 0,
  width: 30,
  height: 60,
};

const DEFAULT_SETTINGS: GroupSpriteSettings = {
  activeOpacity: 1,
  inactiveOpacity: 0.4,
  showAllEqually: true,
  globalOpacity: 0.9,
  grayscaleInactive: true,
};

const STORAGE_KEY = 'group-sprite-settings';
const POSITIONS_KEY = 'group-sprite-positions';

// Get the appropriate sprite URL based on state and config
// Uses new state collections system with fallback to legacy sprites and avatar
function getSpriteUrl(
  state: SpriteState,
  spriteConfig?: SpriteConfig,
  avatarUrl?: string
): { url: string; label: string | null } {
  // First, try state collections (new system)
  const stateCollection = spriteConfig?.stateCollections?.[state];
  if (stateCollection && stateCollection.entries.length > 0) {
    const result = getSpriteFromCollection(stateCollection, false);
    if (result.url) {
      return { url: result.url, label: result.label };
    }
  }

  // Fall back to legacy sprites
  if (spriteConfig?.sprites?.[state]) {
    return { url: spriteConfig.sprites[state]!, label: null };
  }

  // Additional fallbacks for talk and thinking states
  if (state === 'talk' || state === 'thinking') {
    // Try idle as fallback
    const idleCollection = spriteConfig?.stateCollections?.['idle'];
    if (idleCollection && idleCollection.entries.length > 0) {
      const result = getSpriteFromCollection(idleCollection, false);
      if (result.url) {
        return { url: result.url, label: result.label };
      }
    }
    if (spriteConfig?.sprites?.['idle']) {
      return { url: spriteConfig.sprites['idle']!, label: null };
    }
  }

  // Final fallback to avatar
  if (avatarUrl) {
    return { url: avatarUrl, label: 'avatar' };
  }

  return { url: '', label: null };
}

export function GroupSprites({
  characters,
  activeCharacterId,
  isStreaming,
  maxVisible = 3,
}: GroupSpritesProps) {
  const [settings, setSettings] = useState<GroupSpriteSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [positions, setPositions] = useState<SavedPositions>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(POSITIONS_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  // Track which sprite is being interacted with
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // Countdowns per character (read from store periodically)
  const [countdowns, setCountdowns] = useState<Map<string, number>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // ============================================
  // UNIFIED SYSTEM: Use store for per-character sprite state
  // ============================================
  const store = useTavernStore();

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  }, [positions]);

  // Update countdowns every 100ms for all characters
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns = new Map<string, number>();
      
      characters.forEach(character => {
        const remaining = store.getReturnToIdleCountdownForCharacter(character.id);
        if (remaining > 0) {
          newCountdowns.set(character.id, remaining);
        }
      });

      setCountdowns(newCountdowns);
    }, 100);

    return () => clearInterval(interval);
  }, [characters, store]);

  // Get position for a character
  const getCharacterPosition = useCallback((character: CharacterCard, index: number, total: number): SpritePosition => {
    if (positions[character.id]) {
      return positions[character.id];
    }
    if (total === 1) {
      return { ...DEFAULT_SPRITE, x: 50 };
    } else if (total === 2) {
      return { ...DEFAULT_SPRITE, x: index === 0 ? 25 : 75 };
    } else {
      const spacing = 70 / (total - 1);
      return { ...DEFAULT_SPRITE, x: 15 + (spacing * index) };
    }
  }, [positions]);

  // Update position
  const updatePosition = useCallback((characterId: string, updates: Partial<SpritePosition>) => {
    setPositions(prev => {
      const current = prev[characterId] || DEFAULT_SPRITE;
      return {
        ...prev,
        [characterId]: { ...current, ...updates }
      };
    });
  }, []);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, characterId: string) => {
    if (resizingId) return;
    const target = e.target as HTMLElement;
    if (target.closest('.sprite-controls')) return;
    
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[characterId] || DEFAULT_SPRITE;
    setDraggingId(characterId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y
    };
  };

  useEffect(() => {
    if (!draggingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      const currentPos = positions[draggingId] || DEFAULT_SPRITE;
      let newX = dragStartRef.current.posX + deltaX;
      let newY = dragStartRef.current.posY - deltaY;

      const halfWidth = currentPos.width / 2;
      newX = Math.max(halfWidth, Math.min(100 - halfWidth, newX));
      newY = Math.max(0, Math.min(100 - currentPos.height, newY));

      updatePosition(draggingId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setDraggingId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, positions, updatePosition]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, characterId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[characterId] || DEFAULT_SPRITE;
    setResizingId(characterId);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: pos.width,
      height: pos.height
    };
  };

  useEffect(() => {
    if (!resizingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;

      let newWidth = Math.max(15, Math.min(50, resizeStartRef.current.width - deltaX * 2));
      let newHeight = Math.max(20, Math.min(80, resizeStartRef.current.height - deltaY * 2));

      updatePosition(resizingId, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setResizingId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingId, updatePosition]);

  const resetPositions = () => setPositions({});
  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  // Determine display mode
  const displayMode = characters.length <= maxVisible ? 'multi' : 'single';
  const visibleCharacters = displayMode === 'multi'
    ? characters
    : (characters.find(c => c.id === activeCharacterId) ? [characters.find(c => c.id === activeCharacterId)!] : characters.slice(0, 1));

  return (
    <div ref={containerRef} className="absolute inset-0 z-5">
      {/* Sprites */}
      {visibleCharacters.map((character, index) => {
        const position = getCharacterPosition(character, index, visibleCharacters.length);
        const isActive = character.id === activeCharacterId;
        const isHovered = hoveredId === character.id;
        const isBeingDragged = draggingId === character.id;
        const isBeingResized = resizingId === character.id;
        const showControls = isHovered && !isBeingDragged;

        // Calculate opacity
        let opacity = settings.globalOpacity;
        if (displayMode === 'single') {
          opacity *= settings.activeOpacity;
        } else {
          if (isStreaming) {
            opacity *= isActive ? settings.activeOpacity : settings.inactiveOpacity;
          } else if (settings.showAllEqually) {
            opacity *= settings.activeOpacity;
          } else {
            opacity *= settings.inactiveOpacity;
          }
        }

        // ============================================
        // UNIFIED SYSTEM: Get sprite state from store
        // ============================================
        const charSpriteState = store.getCharacterSpriteState(character.id);
        
        // Determine sprite URL based on state and config
        // PRIORITY: Trigger sprite > Talk (if streaming) > Idle
        const hasTriggerSprite = charSpriteState.triggerSpriteUrl;
        const spriteState: SpriteState = isStreaming && isActive ? 'talk' : 'idle';
        const countdown = countdowns.get(character.id) || 0;
        
        let spriteUrl: string;
        let spriteLabel: string | null = null;
        
        if (hasTriggerSprite) {
          // Use trigger sprite (highest priority)
          spriteUrl = charSpriteState.triggerSpriteUrl!;
          spriteLabel = charSpriteState.triggerSpriteLabel;
        } else {
          // Use state collection or fallback
          const spriteResult = getSpriteUrl(
            spriteState,
            character.spriteConfig,
            character.avatar
          );
          spriteUrl = spriteResult.url;
          spriteLabel = spriteResult.label;
        }

        return (
          <div
            key={character.id}
            className={cn(
              "absolute select-none",
              isBeingDragged ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{
              left: `${position.x}%`,
              bottom: `${position.y}%`,
              transform: 'translate(-50%, 0)',
              width: `${position.width}%`,
              height: `${position.height}%`,
              opacity,
              zIndex: isActive && isStreaming ? 10 : 5,
              filter: (isActive || !isStreaming || !settings.grayscaleInactive) ? 'none' : 'grayscale(20%)',
            }}
            onMouseDown={(e) => handleDragStart(e, character.id)}
            onMouseEnter={() => setHoveredId(character.id)}
            onMouseLeave={() => !isBeingDragged && setHoveredId(null)}
          >
            {/* The actual sprite image/video */}
            {spriteUrl ? (
              <SpritePreview
                src={spriteUrl}
                alt={character.name}
                className="w-full h-full drop-shadow-2xl select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex items-end justify-center">
                <div
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg"
                      : "bg-gradient-to-br from-gray-400 to-gray-600"
                  )}
                >
                  <span className="text-white font-bold text-2xl">
                    {character.name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              </div>
            )}

            {/* Trigger countdown badge - per character */}
            {hasTriggerSprite && countdown > 0 && (
              <div className="sprite-controls absolute top-2 left-1/2 -translate-x-1/2 z-50">
                <Badge 
                  variant="secondary" 
                  className="bg-blue-500/90 text-white border-blue-400 gap-1.5 px-3 py-1 shadow-lg"
                >
                  <Timer className="h-3 w-3" />
                  <span className="text-xs font-medium">→ Idle: {formatTime(countdown)}</span>
                </Badge>
              </div>
            )}

            {/* Glow effect for active character */}
            {isActive && isStreaming && (
              <div
                className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center bottom, rgba(251, 191, 36, 0.15) 0%, transparent 70%)',
                  animationDuration: '2s',
                }}
              />
            )}

            {/* Border highlight for active character */}
            {isActive && isStreaming && (
              <div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  boxShadow: '0 0 25px 3px rgba(251, 191, 36, 0.4)',
                }}
              />
            )}

            {/* Resize handle - top left corner */}
            {showControls && (
              <div
                className="sprite-controls absolute top-2 left-2 w-6 h-6 cursor-nwse-resize bg-background/80 backdrop-blur-sm rounded flex items-center justify-center hover:bg-background/90"
                onMouseDown={(e) => handleResizeStart(e, character.id)}
                onMouseEnter={(e) => e.stopPropagation()}
              >
                <div className="w-3 h-3 border-l-2 border-t-2 border-muted-foreground" />
              </div>
            )}

            {/* Drag indicator border when hovering */}
            {showControls && (
              <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-lg pointer-events-none" />
            )}

            {/* Character name indicator - only in single mode */}
            {displayMode === 'single' && (
              <div
                className={cn(
                  "absolute bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300",
                  isStreaming && isActive
                    ? "bg-amber-500/90 text-white shadow-lg"
                    : "bg-background/80 text-foreground"
                )}
              >
                {character.name}
              </div>
            )}
          </div>
        );
      })}

      {/* Settings button - discrete floating button top right */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 opacity-60 hover:opacity-100 transition-opacity z-20"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Group Sprites</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  resetSettings();
                  resetPositions();
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>

            {/* Opacity settings */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>Active Opacity</span>
                  <span className="text-muted-foreground">{Math.round(settings.activeOpacity * 100)}%</span>
                </div>
                <Slider
                  value={[settings.activeOpacity * 100]}
                  min={20}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, activeOpacity: v / 100 }))}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>Inactive Opacity</span>
                  <span className="text-muted-foreground">{Math.round(settings.inactiveOpacity * 100)}%</span>
                </div>
                <Slider
                  value={[settings.inactiveOpacity * 100]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, inactiveOpacity: v / 100 }))}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>Global Opacity</span>
                  <span className="text-muted-foreground">{Math.round(settings.globalOpacity * 100)}%</span>
                </div>
                <Slider
                  value={[settings.globalOpacity * 100]}
                  min={20}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, globalOpacity: v / 100 }))}
                />
              </div>
            </div>

            {/* Toggle for grayscale effect */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs">Grayscale inactive sprites</span>
              <Button
                variant={settings.grayscaleInactive ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSettings(prev => ({ ...prev, grayscaleInactive: !prev.grayscaleInactive }))}
              >
                {settings.grayscaleInactive ? 'On' : 'Off'}
              </Button>
            </div>

            {/* Toggle for showing all equally when not streaming */}
            <div className="flex items-center justify-between">
              <span className="text-xs">Show all equally when idle</span>
              <Button
                variant={settings.showAllEqually ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSettings(prev => ({ ...prev, showAllEqually: !prev.showAllEqually }))}
              >
                {settings.showAllEqually ? 'On' : 'Off'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              💡 Click and drag any sprite to move it. Use corner handle to resize.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
