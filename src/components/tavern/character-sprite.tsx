'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { SpriteEntry, SpriteAnimation } from '@/types/triggers';

interface CharacterSpriteProps {
  sprite?: SpriteEntry;
  expression?: string;
  isAnimating?: boolean;
  isTalking?: boolean;
  className?: string;
  onExpressionChange?: (expression: string) => void;
}

export function CharacterSprite({
  sprite,
  expression = 'neutral',
  isAnimating = false,
  isTalking = false,
  className,
  onExpressionChange,
}: CharacterSpriteProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentExpression, setCurrentExpression] = useState(expression);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Update expression when prop changes
  useEffect(() => {
    setCurrentExpression(expression);
  }, [expression]);

  // Animation loop for sprite frames
  useEffect(() => {
    if (!isAnimating || !sprite?.expressions?.length) {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const frameInterval = 150; // ms between frames
    animationRef.current = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % (sprite.expressions?.length || 1));
    }, frameInterval);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isAnimating, sprite]);

  // Talking animation (subtle bounce)
  const talkingClass = isTalking ? 'animate-bounce' : '';

  // Get the current image to display
  const getImageSrc = () => {
    if (!sprite) return null;

    // If we have multiple images for expressions
    if (sprite.expressions && sprite.expressions.length > 0) {
      const expressionIndex = sprite.expressions.indexOf(currentExpression);
      if (expressionIndex >= 0) {
        // Build path to expression image
        return sprite.path.replace(/\.png$/i, `_${currentExpression}.png`);
      }
    }

    // Default to main sprite image
    return sprite.path;
  };

  const imageSrc = getImageSrc();

  if (!sprite) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center',
          'w-64 h-96 rounded-lg bg-gradient-to-b from-transparent to-black/20',
          className
        )}
      >
        <div className="text-muted-foreground text-sm">
          No sprite configured
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex items-end justify-center',
        'w-64 h-96 overflow-hidden',
        talkingClass,
        className
      )}
    >
      {/* Sprite Image */}
      <img
        src={imageSrc || sprite.path}
        alt={sprite.label}
        className={cn(
          'max-w-full max-h-full object-contain',
          'transition-transform duration-150',
          isAnimating && 'scale-105'
        )}
        onError={(e) => {
          // Fallback to main sprite if expression image not found
          const target = e.target as HTMLImageElement;
          if (target.src !== sprite.path) {
            target.src = sprite.path;
          }
        }}
      />

      {/* Expression indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <div className="px-2 py-1 rounded-full bg-black/50 text-white text-xs">
          {currentExpression}
        </div>
      </div>

      {/* Animation glow effect */}
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ============ Sprite Display with Background ============

interface SpriteSceneProps {
  sprite?: SpriteEntry;
  background?: string;
  expression?: string;
  isTalking?: boolean;
  overlay?: string;
  overlayPlacement?: 'none' | 'back' | 'front';
}

export function SpriteScene({
  sprite,
  background,
  expression,
  isTalking,
  overlay,
  overlayPlacement = 'none',
}: SpriteSceneProps) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {/* Background Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: background ? `url(${background})` : undefined,
          backgroundColor: !background ? '#1a1a2e' : undefined,
        }}
      />

      {/* Back Overlay */}
      {overlay && overlayPlacement === 'back' && (
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat pointer-events-none opacity-80"
          style={{ backgroundImage: `url(${overlay})` }}
        />
      )}

      {/* Character Sprite */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10">
        <CharacterSprite
          sprite={sprite}
          expression={expression}
          isTalking={isTalking}
          isAnimating={isTalking}
          className="drop-shadow-2xl"
        />
      </div>

      {/* Front Overlay */}
      {overlay && overlayPlacement === 'front' && (
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat pointer-events-none opacity-80 z-20"
          style={{ backgroundImage: `url(${overlay})` }}
        />
      )}

      {/* Vignette effect */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-black/20 z-30" />
    </div>
  );
}
