import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SPRITES_DIR = path.join(process.cwd(), 'public', 'sprites');

interface SpriteFile {
  name: string;
  url: string;
  type: 'image' | 'animation';
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

        // Read directory contents, handle empty directories
        let collectionFiles: string[] = [];
        try {
          collectionFiles = await fs.readdir(collectionPath);
        } catch {
          // Directory might not be readable, skip it
          continue;
        }

        const spriteFiles: SpriteFile[] = collectionFiles
          .filter(file => ALL_SPRITE_EXTENSIONS.test(file))
          .map(file => {
            const isAnimation = ANIMATION_EXTENSIONS.test(file);
            return {
              name: file,
              url: `/sprites/${entry.name}/${file}`,
              type: isAnimation ? 'animation' : 'image' as const
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
