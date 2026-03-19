import { NextResponse, NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SPRITES_DIR = path.join(process.cwd(), 'public', 'sprites');

interface SpriteFile {
  name: string;
  url: string;
  type: 'image' | 'animation';
  // Timeline data from metadata
  label?: string;
  duration?: number;
  timeline?: {
    duration: number;
    loop: boolean;
    tracks: Array<{
      id: string;
      type: string;
      name: string;
      keyframes: Array<{
        id: string;
        time: number;
        value: Record<string, unknown>;
        interpolation: string;
      }>;
      enabled: boolean;
      locked: boolean;
      muted: boolean;
      volume: number;
    }>;
  };
}

interface SpriteCollection {
  id: string;
  name: string;
  path: string;
  files: SpriteFile[];
}

// Supported sprite formats
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp)$/i;
const ANIMATION_EXTENSIONS = /\.(gif|webm|apng)$/i;
const ALL_SPRITE_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif|webm|apng)$/i;

interface SpriteMetadata {
  label?: string;
  filename?: string;
  duration?: number;
  timeline?: {
    duration: number;
    loop: boolean;
    tracks: Array<{
      id: string;
      type: string;
      name: string;
      keyframes: Array<{
        id: string;
        time: number;
        value: Record<string, unknown>;
        interpolation: string;
      }>;
      enabled: boolean;
      locked: boolean;
      muted: boolean;
      volume: number;
    }>;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface CollectionMetadata {
  version?: number;
  collectionName?: string;
  sprites?: Record<string, SpriteMetadata>;
  createdAt?: string;
  updatedAt?: string;
}

async function scanSpritesDirectory(): Promise<SpriteCollection[]> {
  try {
    const collections: SpriteCollection[] = [];
    
    // Check if sprites directory exists
    try {
      await fs.access(SPRITES_DIR);
    } catch {
      return collections;
    }

    const entries = await fs.readdir(SPRITES_DIR, { withFileTypes: true });
    
    // Process subdirectories (collections)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const collectionPath = path.join(SPRITES_DIR, entry.name);
        const metadataPath = path.join(collectionPath, 'metadata.json');

        // Read directory contents, handle empty directories
        let collectionFiles: string[] = [];
        try {
          collectionFiles = await fs.readdir(collectionPath);
        } catch {
          continue;
        }

        // Load metadata.json if exists
        let metadata: CollectionMetadata = {};
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch {
          // Metadata doesn't exist, use empty object
        }

        const spriteFiles: SpriteFile[] = collectionFiles
          .filter(file => ALL_SPRITE_EXTENSIONS.test(file))
          .map(file => {
            const isAnimation = ANIMATION_EXTENSIONS.test(file);
            // Get sprite metadata from the metadata file
            const spriteMeta = metadata.sprites?.[file] || {};
            
            return {
              name: file,
              url: `/sprites/${entry.name}/${file}`,
              type: isAnimation ? 'animation' : 'image' as const,
              // Include metadata fields if available
              label: spriteMeta.label || file.replace(/\.[^/.]+$/, ''),
              duration: spriteMeta.duration,
              timeline: spriteMeta.timeline,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        // Include empty collections too (newly created)
        collections.push({
          id: entry.name.toLowerCase().replace(/\s+/g, '-'),
          name: entry.name,
          path: `/sprites/${entry.name}`,
          files: spriteFiles
        });
      }
    }

    return collections.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error scanning sprites directory:', error);
    return [];
  }
}

export async function GET() {
  const collections = await scanSpritesDirectory();
  return NextResponse.json({ collections });
}

// Save sprite timeline configuration to metadata.json
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionName, spriteData } = body;

    if (!collectionName || !spriteData) {
      return NextResponse.json(
        { error: 'Collection name and sprite data are required' },
        { status: 400 }
      );
    }

    const collectionPath = path.join(SPRITES_DIR, collectionName);
    const metadataPath = path.join(collectionPath, 'metadata.json');

    // Check if collection exists
    try {
      await fs.access(collectionPath);
    } catch {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Read existing metadata or create new one
    let metadata: CollectionMetadata = {
      version: 1,
      collectionName,
      sprites: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingMetadata = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(existingMetadata);
    } catch {
      // Metadata doesn't exist, use defaults
    }

    // Ensure sprites object exists
    if (!metadata.sprites) {
      metadata.sprites = {};
    }
    
    // Get the filename
    const spriteId = spriteData.filename || spriteData.id;
    
    // Preserve existing data and merge with new data
    const existingSprite = metadata.sprites[spriteId] || {};
    metadata.sprites[spriteId] = {
      ...existingSprite,
      label: spriteData.label || existingSprite.label,
      filename: spriteId,
      duration: spriteData.duration,
      timeline: spriteData.timeline,
      updatedAt: new Date().toISOString(),
    };

    metadata.updatedAt = new Date().toISOString();

    // Write updated metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return NextResponse.json({ 
      success: true, 
      message: 'Sprite configuration saved',
      data: metadata.sprites[spriteId]
    });
  } catch (error) {
    console.error('Error saving sprite configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save sprite configuration' },
      { status: 500 }
    );
  }
}
