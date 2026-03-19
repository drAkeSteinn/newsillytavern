// ============================================
// Use Timeline Sprite Sounds Hook
// ============================================
//
// This hook connects sprite activation with timeline sound playback.
// When a sprite is activated (via trigger or state change), it checks
// if the sprite has timeline sounds configured and plays them.
//
// Sources for timeline sounds:
// 1. Timeline Editor collections (state.collections)
// 2. Sprite Pack entries with embedded timeline data
//
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useTavernStore } from '@/store';
import type {
  TimelineSprite,
  TimelineTrack,
  SpriteTimelineData,
  SoundKeyframeValue,
  SoundTrigger,
  SoundCollection,
  SpriteTimelineCollection,
  SpritePackV2,
  SpritePackEntryV2,
} from '@/types';

// ============================================
// Audio Cache
// ============================================

const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(url: string): HTMLAudioElement {
  if (!audioCache.has(url)) {
    const audio = new Audio(url);
    audio.load();
    audioCache.set(url, audio);
  }
  return audioCache.get(url)!;
}

// ============================================
// Active Timeline Sounds State
// ============================================

interface ActiveTimelineSound {
  spriteUrl: string;
  startTime: number;
  duration: number;
  loop: boolean;
  activeAudios: Map<string, HTMLAudioElement[]>;
  triggeredKeyframes: Set<string>;
  timelineData: SpriteTimelineData;
}

const activeTimelines = new Map<string, ActiveTimelineSound>();
let animationFrameId: number | null = null;

// ============================================
// Sound Playback Functions
// ============================================

async function playSoundFromTrigger(
  trigger: SoundTrigger,
  collections: SoundCollection[],
  volume: number = 1
): Promise<HTMLAudioElement | null> {
  const collection = collections.find(c => c.name === trigger.collection);
  if (!collection || !collection.files || collection.files.length === 0) {
    console.warn('[TimelineSounds] Collection not found or empty:', trigger.collection);
    return null;
  }

  let soundFile: string;
  if (trigger.playMode === 'random') {
    soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
  } else {
    const index = trigger.currentIndex || 0;
    soundFile = collection.files[index % collection.files.length];
  }

  try {
    const baseAudio = getAudio(soundFile);
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume * (trigger.volume || 1);
    audioClone.currentTime = 0;

    await audioClone.play().catch(e => {
      console.warn('[TimelineSounds] Audio play failed:', e);
    });

    return audioClone;
  } catch (error) {
    console.error('[TimelineSounds] Failed to play sound:', error);
    return null;
  }
}

async function playSoundFromUrl(
  url: string,
  volume: number = 1
): Promise<HTMLAudioElement | null> {
  try {
    const baseAudio = getAudio(url);
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume;
    audioClone.currentTime = 0;

    await audioClone.play().catch(e => {
      console.warn('[TimelineSounds] Audio play failed:', e);
    });

    return audioClone;
  } catch (error) {
    console.error('[TimelineSounds] Failed to play sound from URL:', error);
    return null;
  }
}

// ============================================
// Find Sprite Timeline
// ============================================

interface SpriteWithTimeline {
  url: string;
  label: string;
  timeline: SpriteTimelineData;
  source: 'timeline_editor' | 'sprite_pack';
}

function findSpriteTimelineByUrl(
  spriteUrl: string,
  timelineCollections: SpriteTimelineCollection[],
  spritePacks: SpritePackV2[]
): SpriteWithTimeline | undefined {
  // First, search in Timeline Editor collections
  for (const collection of timelineCollections) {
    const sprite = collection.sprites.find(s => s.url === spriteUrl);
    if (sprite) {
      return {
        url: sprite.url,
        label: sprite.label,
        timeline: sprite.timeline,
        source: 'timeline_editor',
      };
    }
  }

  // Then, search in Sprite Packs (sprites with embedded timeline)
  for (const pack of spritePacks) {
    const sprite = pack.sprites.find(s => s.url === spriteUrl);
    if (sprite?.timeline) {
      return {
        url: sprite.url,
        label: sprite.label,
        timeline: sprite.timeline,
        source: 'sprite_pack',
      };
    }
  }

  return undefined;
}

// ============================================
// Timeline Sound Player
// ============================================

function playSoundsAtTime(
  characterId: string,
  timeline: SpriteTimelineData,
  currentTime: number,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[],
  activeSound: ActiveTimelineSound,
  toleranceMs: number = 100
): void {
  const globalVolume = timeline.globalVolume ?? 1;

  for (const track of timeline.tracks) {
    if (track.muted || !track.enabled) continue;
    if (track.type !== 'sound') continue;

    const trackId = track.id;

    for (const keyframe of track.keyframes) {
      const keyframeId = keyframe.id;
      const keyframeTime = keyframe.time;

      // Check if playhead is crossing this keyframe
      const isCrossing = currentTime >= keyframeTime && currentTime < keyframeTime + toleranceMs;

      if (isCrossing && !activeSound.triggeredKeyframes.has(keyframeId)) {
        activeSound.triggeredKeyframes.add(keyframeId);

        const soundValue = keyframe.value as SoundKeyframeValue & {
          soundTriggerId?: string;
          soundTriggerName?: string;
        };

        if (soundValue.play) {
          (async () => {
            let audioEl: HTMLAudioElement | null = null;

            // Try sound trigger first
            if (soundValue.soundTriggerId) {
              const trigger = soundTriggers.find(t => t.id === soundValue.soundTriggerId);
              if (trigger) {
                audioEl = await playSoundFromTrigger(
                  trigger,
                  soundCollections,
                  (soundValue.volume || 1) * globalVolume
                );
              }
            }
            // Fall back to direct URL
            else if (soundValue.soundUrl) {
              audioEl = await playSoundFromUrl(
                soundValue.soundUrl,
                (soundValue.volume || 1) * globalVolume
              );
            }
            // Try collection + file reference
            else if (soundValue.soundCollection && soundValue.soundFile) {
              const collection = soundCollections.find(c => c.name === soundValue.soundCollection);
              if (collection) {
                const file = collection.files.find(f => f.includes(soundValue.soundFile!));
                if (file) {
                  audioEl = await playSoundFromUrl(file, (soundValue.volume || 1) * globalVolume);
                }
              }
            }

            if (audioEl) {
              const trackAudios = activeSound.activeAudios.get(trackId) || [];
              trackAudios.push(audioEl);
              activeSound.activeAudios.set(trackId, trackAudios);

              // Clean up after playback
              audioEl.onended = () => {
                const idx = trackAudios.indexOf(audioEl!);
                if (idx > -1) trackAudios.splice(idx, 1);
              };
            }
          })();
        }

        // Handle stop command
        if (soundValue.stop) {
          const trackAudios = activeSound.activeAudios.get(trackId) || [];
          for (const audio of trackAudios) {
            audio.pause();
            audio.remove();
          }
          trackAudios.length = 0;
        }
      }

      // Reset trigger for keyframes we've passed (for looping)
      if (currentTime < keyframeTime) {
        activeSound.triggeredKeyframes.delete(keyframeId);
      }
    }
  }
}

function stopTimelineSound(characterId: string) {
  const activeSound = activeTimelines.get(characterId);
  if (!activeSound) return;

  // Stop all audio elements
  for (const [, audios] of activeSound.activeAudios) {
    for (const audio of audios) {
      audio.pause();
      audio.remove();
    }
  }

  activeTimelines.delete(characterId);
  console.log('[TimelineSounds] Stopped timeline sounds for:', characterId);
}

function startTimelineSound(
  characterId: string,
  sprite: SpriteWithTimeline,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[]
): void {
  // Stop any existing timeline for this character
  stopTimelineSound(characterId);

  const soundTracks = sprite.timeline.tracks.filter(
    t => t.type === 'sound' && !t.muted && t.enabled
  );

  if (soundTracks.length === 0) {
    return;
  }

  const activeSound: ActiveTimelineSound = {
    spriteUrl: sprite.url,
    startTime: Date.now(),
    duration: sprite.timeline.duration,
    loop: sprite.timeline.loop,
    activeAudios: new Map(),
    triggeredKeyframes: new Set(),
    timelineData: sprite.timeline,
  };

  activeTimelines.set(characterId, activeSound);

  console.log('[TimelineSounds] Started timeline sounds:', {
    characterId,
    spriteUrl: sprite.url,
    label: sprite.label,
    source: sprite.source,
    duration: sprite.timeline.duration,
    loop: sprite.timeline.loop,
    soundTracks: soundTracks.length,
  });

  // Play initial sounds at time 0
  playSoundsAtTime(
    characterId,
    sprite.timeline,
    0,
    soundTriggers,
    soundCollections,
    activeSound
  );
}

// ============================================
// Main Hook
// ============================================

export function useTimelineSpriteSounds() {
  const characterSpriteStates = useTavernStore((state) => state.characterSpriteStates);
  // Timeline collections are at the root level from createTimelineEditorSlice
  const timelineCollections = useTavernStore((state) => state.collections ?? []);
  const soundTriggers = useTavernStore((state) => state.soundTriggers ?? []);
  const soundCollections = useTavernStore((state) => state.soundCollections ?? []);
  // Sprite packs with embedded timeline data
  const spritePacksV2 = useTavernStore((state) => state.spritePacksV2 ?? []);

  const prevSpriteUrlsRef = useRef<Record<string, string>>({});
  const checkLoopRef = useRef<boolean>(false);

  // Store refs for loop checker
  const timelineCollectionsRef = useRef(timelineCollections);
  const spritePacksRef = useRef(spritePacksV2);
  const soundTriggersRef = useRef(soundTriggers);
  const soundCollectionsRef = useRef(soundCollections);

  // Update refs
  useEffect(() => {
    timelineCollectionsRef.current = timelineCollections;
    spritePacksRef.current = spritePacksV2;
    soundTriggersRef.current = soundTriggers;
    soundCollectionsRef.current = soundCollections;
  }, [timelineCollections, spritePacksV2, soundTriggers, soundCollections]);

  // Start/stop timeline sounds when sprite changes
  useEffect(() => {
    const currentSpriteUrls: Record<string, string> = {};

    // Count sprites with timeline in packs
    const spritesWithTimelineInPacks = spritePacksV2.reduce((count, pack) => {
      return count + pack.sprites.filter(s => s.timeline).length;
    }, 0);

    console.log('[TimelineSounds] Checking sprite changes:', {
      timelineCollectionsCount: timelineCollections.length,
      totalSpritesInCollections: timelineCollections.reduce((sum, c) => sum + c.sprites.length, 0),
      spritePacksCount: spritePacksV2.length,
      spritesWithTimelineInPacks,
      soundTriggersCount: soundTriggers.length,
      soundCollectionsCount: soundCollections.length,
      characterSpriteStatesCount: Object.keys(characterSpriteStates).length,
    });

    for (const [characterId, charState] of Object.entries(characterSpriteStates)) {
      const currentUrl = charState.triggerSpriteUrl;
      currentSpriteUrls[characterId] = currentUrl || '';

      const prevUrl = prevSpriteUrlsRef.current[characterId];

      // If sprite changed
      if (currentUrl && currentUrl !== prevUrl) {
        console.log('[TimelineSounds] Sprite URL changed:', {
          characterId,
          currentUrl,
          prevUrl,
          useTimelineSounds: charState.useTimelineSounds,
        });

        // Check if timeline sounds are enabled for this character
        if (!charState.useTimelineSounds) {
          console.log('[TimelineSounds] Timeline sounds disabled for this character, skipping');
          continue;
        }

        // Find the sprite with timeline
        const spriteWithTimeline = findSpriteTimelineByUrl(
          currentUrl,
          timelineCollections,
          spritePacksV2
        );

        console.log('[TimelineSounds] Sprite lookup result:', {
          found: !!spriteWithTimeline,
          source: spriteWithTimeline?.source,
          spriteData: spriteWithTimeline ? {
            label: spriteWithTimeline.label,
            tracksCount: spriteWithTimeline.timeline.tracks.length,
            soundTracksCount: spriteWithTimeline.timeline.tracks.filter(t => t.type === 'sound').length,
          } : null,
        });

        if (spriteWithTimeline) {
          // Check if sprite has sound tracks
          const soundTracks = spriteWithTimeline.timeline.tracks.filter(
            t => t.type === 'sound' && !t.muted && t.enabled
          );

          if (soundTracks.length > 0) {
            console.log('[TimelineSounds] Sprite activated with timeline sounds:', {
              characterId,
              spriteUrl: currentUrl,
              label: spriteWithTimeline.label,
              source: spriteWithTimeline.source,
              soundTracks: soundTracks.length,
              keyframes: soundTracks.reduce((sum, t) => sum + t.keyframes.length, 0),
            });

            startTimelineSound(
              characterId,
              spriteWithTimeline,
              soundTriggers,
              soundCollections
            );
            checkLoopRef.current = true;
          } else {
            console.log('[TimelineSounds] Sprite found but no active sound tracks:', {
              totalTracks: spriteWithTimeline.timeline.tracks.length,
              tracks: spriteWithTimeline.timeline.tracks.map(t => ({
                type: t.type,
                muted: t.muted,
                enabled: t.enabled,
                keyframesCount: t.keyframes.length,
              })),
            });
          }
        } else {
          console.warn('[TimelineSounds] Sprite URL not found with timeline data:', currentUrl);
          console.log('[TimelineSounds] Tip: Configure timeline sounds in the sprite pack or add to Timeline Editor.');
        }
      }

      // If sprite was cleared but we had an active timeline
      if (!currentUrl && prevUrl) {
        stopTimelineSound(characterId);
      }
    }

    prevSpriteUrlsRef.current = currentSpriteUrls;
  }, [characterSpriteStates, timelineCollections, spritePacksV2, soundTriggers, soundCollections]);

  // Loop checker - updates timeline sounds for looping sprites
  useEffect(() => {
    if (!checkLoopRef.current) return;

    const check = () => {
      const now = Date.now();
      let hasActive = false;

      for (const [characterId, activeSound] of activeTimelines) {
        hasActive = true;
        const elapsed = now - activeSound.startTime;
        const currentTime = elapsed % activeSound.duration;

        // Play sounds at current time using stored timeline data
        playSoundsAtTime(
          characterId,
          activeSound.timelineData,
          currentTime,
          soundTriggersRef.current,
          soundCollectionsRef.current,
          activeSound
        );
      }

      if (hasActive) {
        animationFrameId = requestAnimationFrame(check);
      } else {
        checkLoopRef.current = false;
        animationFrameId = null;
      }
    };

    animationFrameId = requestAnimationFrame(check);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
  }, []); // No dependencies - uses refs for data

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const characterId of activeTimelines.keys()) {
        stopTimelineSound(characterId);
      }
    };
  }, []);

  return {
    hasActiveTimeline: (characterId: string) => activeTimelines.has(characterId),
    stopTimeline: stopTimelineSound,
  };
}

// ============================================
// Standalone Functions (for direct use)
// ============================================

export function playTimelineSoundsForSprite(
  spriteUrl: string,
  characterId: string,
  timelineCollections: SpriteTimelineCollection[],
  spritePacks: SpritePackV2[],
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[]
): boolean {
  const sprite = findSpriteTimelineByUrl(spriteUrl, timelineCollections, spritePacks);

  if (!sprite) {
    return false;
  }

  const soundTracks = sprite.timeline.tracks.filter(
    t => t.type === 'sound' && !t.muted && t.enabled
  );

  if (soundTracks.length === 0) {
    return false;
  }

  startTimelineSound(characterId, sprite, soundTriggers, soundCollections);
  return true;
}

export function stopAllTimelineSounds(): void {
  for (const characterId of activeTimelines.keys()) {
    stopTimelineSound(characterId);
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}
