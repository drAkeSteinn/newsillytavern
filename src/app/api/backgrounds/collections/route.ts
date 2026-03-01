import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { BackgroundCollection, BackgroundCollectionEntry, BackgroundFile } from '@/types';

const BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');

// Supported image and video formats
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv|ogv)$/i;
const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|mov|avi|mkv|ogv)$/i;

/**
 * Read collection.json metadata file if it exists
 */
async function readCollectionMetadata(collectionPath: string, collectionName: string): Promise<Partial<BackgroundCollection> | null> {
  const metadataPath = path.join(collectionPath, 'collection.json');
  
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);
    
    console.log(`[BgAPI] Found collection.json for "${collectionName}"`);
    return metadata;
  } catch {
    // No metadata file, return null
    return null;
  }
}

/**
 * Merge filesystem scan with JSON metadata
 */
function mergeWithMetadata(
  files: BackgroundFile[],
  metadata: Partial<BackgroundCollection> | null,
  collectionName: string,
  collectionPath: string
): BackgroundCollection {
  const entries: BackgroundCollectionEntry[] = [];
  
  // If metadata has entries, use them
  if (metadata?.entries && Array.isArray(metadata.entries)) {
    for (const entry of metadata.entries) {
      // Validate entry has required fields
      if (entry.id && entry.url && entry.triggerKeys) {
        entries.push({
          id: entry.id,
          name: entry.name || entry.id,
          url: entry.url,
          triggerKeys: entry.triggerKeys || [],
          contextKeys: entry.contextKeys || [],
          tags: entry.tags,
          transitionDuration: entry.transitionDuration,
        });
      }
    }
  }
  
  // If no entries from metadata, create entries from files
  if (entries.length === 0) {
    for (const file of files) {
      const entryId = `${collectionName}_${file.name.replace(MEDIA_EXTENSIONS, '')}`;
      entries.push({
        id: entryId,
        name: file.name.replace(MEDIA_EXTENSIONS, ''),
        url: file.url,
        triggerKeys: [],  // No default trigger keys
        contextKeys: [],  // No default context keys
      });
    }
  }
  
  return {
    name: metadata?.name || collectionName,
    path: `/backgrounds/${collectionName}`,
    description: metadata?.description,
    version: metadata?.version,
    transitionDuration: metadata?.transitionDuration,
    entries,
    files: files, // Return full file objects with name, url, type
  };
}

/**
 * Scan backgrounds directory and return collections with metadata
 */
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
    
    // Process subdirectories (collections)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const collectionName = entry.name;
        const collectionPath = path.join(BACKGROUNDS_DIR, collectionName);
        const collectionFiles = await fs.readdir(collectionPath);
        
        // Get all media files
        const mediaFiles = collectionFiles
          .filter(file => MEDIA_EXTENSIONS.test(file))
          .map(file => {
            const isVideo = VIDEO_EXTENSIONS.test(file);
            return {
              name: file,
              url: `/backgrounds/${collectionName}/${file}`,
              type: isVideo ? 'video' : 'image' as const
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        
        if (mediaFiles.length > 0) {
          // Read metadata if exists
          const metadata = await readCollectionMetadata(collectionPath, collectionName);
          
          // Merge files with metadata
          const collection = mergeWithMetadata(
            mediaFiles,
            metadata,
            collectionName,
            collectionPath
          );
          
          collections.push(collection);
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
