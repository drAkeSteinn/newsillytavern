import { NextRequest, NextResponse } from 'next/server';
import {
  readAllPersistentData,
  writePersistentData,
  initializeDataFiles,
  VALID_DATA_TYPES,
  type DataType,
} from '@/lib/persistence';

// Initialize data files on server start
initializeDataFiles();

// GET - Read all persistent data or specific data type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type') as DataType | null;

    if (dataType) {
      if (!VALID_DATA_TYPES.includes(dataType)) {
        return NextResponse.json(
          { error: `Invalid data type. Valid types: ${VALID_DATA_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const allData = readAllPersistentData();
      return NextResponse.json({ data: allData[dataType] });
    }

    // Return all data
    const allData = readAllPersistentData();
    return NextResponse.json({ data: allData });
  } catch (error) {
    console.error('Error reading persistent data:', error);
    return NextResponse.json(
      { error: 'Failed to read persistent data' },
      { status: 500 }
    );
  }
}

// POST - Write data to file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body as { type: DataType; data: unknown };

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data' },
        { status: 400 }
      );
    }

    if (!VALID_DATA_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid data type. Valid types: ${VALID_DATA_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const success = writePersistentData(type, data);

    if (success) {
      return NextResponse.json({ success: true, message: `${type} saved successfully` });
    } else {
      return NextResponse.json(
        { error: `Failed to save ${type}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error writing persistent data:', error);
    return NextResponse.json(
      { error: 'Failed to write persistent data' },
      { status: 500 }
    );
  }
}

// PUT - Sync all data at once
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      // Core data
      characters, sessions, groups, personas, settings, lorebooks,
      // Sound system
      soundTriggers, soundCollections,
      // Visual systems
      backgroundPacks, spritePacks, hudTemplates,
    } = body;

    const results: Record<string, boolean> = {};

    // Core data
    if (characters !== undefined) {
      results.characters = writePersistentData('characters', characters);
    }
    if (sessions !== undefined) {
      results.sessions = writePersistentData('sessions', sessions);
    }
    if (groups !== undefined) {
      results.groups = writePersistentData('groups', groups);
    }
    if (personas !== undefined) {
      results.personas = writePersistentData('personas', personas);
    }
    if (settings !== undefined) {
      results.settings = writePersistentData('settings', settings);
    }
    if (lorebooks !== undefined) {
      results.lorebooks = writePersistentData('lorebooks', lorebooks);
    }

    // Sound system
    if (soundTriggers !== undefined) {
      results.soundTriggers = writePersistentData('soundTriggers', soundTriggers);
    }
    if (soundCollections !== undefined) {
      results.soundCollections = writePersistentData('soundCollections', soundCollections);
    }

    // Visual systems
    if (backgroundPacks !== undefined) {
      results.backgroundPacks = writePersistentData('backgroundPacks', backgroundPacks);
    }
    if (spritePacks !== undefined) {
      results.spritePacks = writePersistentData('spritePacks', spritePacks);
    }
    if (hudTemplates !== undefined) {
      results.hudTemplates = writePersistentData('hudTemplates', hudTemplates);
    }

    const allSuccess = Object.values(results).every(v => v);

    if (allSuccess) {
      return NextResponse.json({ success: true, results });
    } else {
      return NextResponse.json(
        { error: 'Some data failed to save', results },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error syncing persistent data:', error);
    return NextResponse.json(
      { error: 'Failed to sync persistent data' },
      { status: 500 }
    );
  }
}
