import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');

// Supported image and video formats
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv|ogv)$/i;
const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|mov|avi|mkv|ogv)$/i;

export interface BackgroundFile {
  name: string;
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
}

export interface BackgroundCollection {
  name: string;
  path: string;
  files: BackgroundFile[];
}

async function scanBackgroundsDirectory(): Promise<BackgroundCollection[]> {
  try {
    const collections: BackgroundCollection[] = [];
    
    // Check if backgrounds directory exists
    try {
      await fs.access(BACKGROUNDS_DIR);
    } catch {
      return collections;
    }

    const entries = await fs.readdir(BACKGROUNDS_DIR, { withFileTypes: true });
    
    // Process root level background files
    const rootFiles: BackgroundFile[] = [];
    for (const entry of entries) {
      if (entry.isFile() && MEDIA_EXTENSIONS.test(entry.name)) {
        const isVideo = VIDEO_EXTENSIONS.test(entry.name);
        rootFiles.push({
          name: entry.name,
          url: `/backgrounds/${entry.name}`,
          type: isVideo ? 'video' : 'image'
        });
      }
    }
    
    if (rootFiles.length > 0) {
      collections.push({
        name: 'Root',
        path: '/backgrounds',
        files: rootFiles.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    // Process subdirectories (collections)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const collectionPath = path.join(BACKGROUNDS_DIR, entry.name);
        const collectionFiles = await fs.readdir(collectionPath);
        
        const backgroundFiles: BackgroundFile[] = collectionFiles
          .filter(file => MEDIA_EXTENSIONS.test(file))
          .map(file => {
            const isVideo = VIDEO_EXTENSIONS.test(file);
            return {
              name: file,
              url: `/backgrounds/${entry.name}/${file}`,
              type: isVideo ? 'video' : 'image'
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        
        if (backgroundFiles.length > 0) {
          collections.push({
            name: entry.name,
            path: `/backgrounds/${entry.name}`,
            files: backgroundFiles
          });
        }
      }
    }

    return collections.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error scanning backgrounds directory:', error);
    return [];
  }
}

export async function GET() {
  const collections = await scanBackgroundsDirectory();
  return NextResponse.json({ collections });
}
