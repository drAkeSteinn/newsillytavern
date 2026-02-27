'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Maximize2, 
  RotateCcw,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface SpriteSettings {
  x: number;        // percentage (0-100) - horizontal position
  y: number;        // percentage (0-100) - vertical position from bottom (0 = bottom)
  width: number;    // percentage (10-80)
  height: number;   // percentage (10-90)
  opacity: number;  // 0-1
}

interface CharacterSpriteProps {
  characterId: string;
  characterName: string;
  avatarUrl: string;
  onSettingsChange?: (settings: SpriteSettings) => void;
}

const DEFAULT_SPRITE_SETTINGS: SpriteSettings = {
  x: 50,           // center horizontally
  y: 0,            // at bottom (0 = bottom, higher values = higher up)
  width: 35,       // 35% of screen width
  height: 70,      // 70% of screen height
  opacity: 0.9
};

export function CharacterSprite({ 
  characterId, 
  characterName, 
  avatarUrl,
  onSettingsChange 
}: CharacterSpriteProps) {
  const [settings, setSettings] = useState<SpriteSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`sprite-${characterId}`);
      if (saved) {
        try {
          return { ...DEFAULT_SPRITE_SETTINGS, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_SPRITE_SETTINGS;
        }
      }
    }
    return DEFAULT_SPRITE_SETTINGS;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const spriteRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, settingsX: 0, settingsY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(`sprite-${characterId}`, JSON.stringify(settings));
    onSettingsChange?.(settings);
  }, [settings, characterId, onSettingsChange]);

  // Drag handlers - click anywhere on sprite to drag
  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag if clicking on controls
    if ((e.target as HTMLElement).closest('.sprite-controls')) return;
    if (isResizing) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      settingsX: settings.x,
      settingsY: settings.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      const container = spriteRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      // Calculate new position
      let newX = dragStartRef.current.settingsX + deltaX;
      // Invert deltaY because we use 'bottom' positioning
      // Dragging up (negative deltaY) should increase Y (move sprite up)
      let newY = dragStartRef.current.settingsY - deltaY;

      // Constrain X: sprite center must stay within screen
      const halfWidth = settings.width / 2;
      newX = Math.max(halfWidth, Math.min(100 - halfWidth, newX));

      // Constrain Y: sprite bottom must stay within screen
      // y = 0 means at bottom, higher values move it up
      // Maximum Y should not exceed (100 - height) to keep sprite visible
      const maxY = 100 - settings.height;
      newY = Math.max(0, Math.min(maxY, newY));

      setSettings(prev => ({ ...prev, x: newX, y: newY }));
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, settings.width, settings.height]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: settings.width,
      height: settings.height
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e: MouseEvent) => {
      const container = spriteRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;

      let newWidth = Math.max(10, Math.min(80, resizeStartRef.current.width + deltaX * 2));
      let newHeight = Math.max(10, Math.min(90, resizeStartRef.current.height + deltaY * 2));

      setSettings(prev => ({ 
        ...prev, 
        width: newWidth, 
        height: newHeight 
      }));
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing]);

  const updateSetting = (key: keyof SpriteSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SPRITE_SETTINGS);
  };

  // Calculate max Y based on height
  const maxY = Math.max(0, 100 - settings.height);

  return (
    <div
      ref={spriteRef}
      className={cn(
        "absolute select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: `${settings.x}%`,
        bottom: `${settings.y}%`,  // y=0 at bottom
        transform: 'translate(-50%, 0)',
        width: `${settings.width}%`,
        height: `${settings.height}%`,
        opacity: settings.opacity,
        zIndex: 5
      }}
      onMouseDown={handleDragStart}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isDragging && setShowControls(false)}
    >
      {/* The actual sprite image */}
      <img
        src={avatarUrl}
        alt={characterName}
        className="w-full h-full object-contain object-bottom drop-shadow-2xl select-none pointer-events-none"
        draggable={false}
      />

      {/* Controls overlay - only show on hover */}
      {showControls && !isDragging && (
        <div className="sprite-controls absolute top-2 right-2 z-50 flex flex-col gap-1"
          onMouseEnter={(e) => e.stopPropagation()}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Sprite Settings</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={resetSettings}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>

                {/* Size sliders */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Width</span>
                      <span className="text-muted-foreground">{Math.round(settings.width)}%</span>
                    </div>
                    <Slider
                      value={[settings.width]}
                      min={10}
                      max={80}
                      step={1}
                      onValueChange={([v]) => updateSetting('width', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Height</span>
                      <span className="text-muted-foreground">{Math.round(settings.height)}%</span>
                    </div>
                    <Slider
                      value={[settings.height]}
                      min={10}
                      max={90}
                      step={1}
                      onValueChange={([v]) => updateSetting('height', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Opacity</span>
                      <span className="text-muted-foreground">{Math.round(settings.opacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[settings.opacity * 100]}
                      min={20}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updateSetting('opacity', v / 100)}
                    />
                  </div>
                </div>

                {/* Position controls */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>X Position (Horizontal)</span>
                      <span className="text-muted-foreground">{Math.round(settings.x)}%</span>
                    </div>
                    <Slider
                      value={[settings.x]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updateSetting('x', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Y Position (Vertical from bottom)</span>
                      <span className="text-muted-foreground">{Math.round(settings.y)}%</span>
                    </div>
                    <Slider
                      value={[settings.y]}
                      min={0}
                      max={maxY}
                      step={1}
                      onValueChange={([v]) => updateSetting('y', v)}
                    />
                  </div>
                </div>

                {/* Quick position buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSettings(prev => ({ ...prev, x: 20 }))}
                  >
                    Left
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSettings(prev => ({ ...prev, x: 50 }))}
                  >
                    Center
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSettings(prev => ({ ...prev, x: 80 }))}
                  >
                    Right
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  💡 Click and drag the sprite to move it anywhere.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Resize handle - top left corner */}
      {showControls && !isDragging && (
        <div
          className="sprite-controls absolute top-2 left-2 w-6 h-6 cursor-nwse-resize bg-background/80 backdrop-blur-sm rounded flex items-center justify-center hover:bg-background/90"
          onMouseDown={handleResizeStart}
          onMouseEnter={(e) => e.stopPropagation()}
        >
          <div className="w-3 h-3 border-l-2 border-t-2 border-muted-foreground" />
        </div>
      )}

      {/* Drag indicator border when hovering */}
      {showControls && !isDragging && (
        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-lg pointer-events-none" />
      )}
    </div>
  );
}
