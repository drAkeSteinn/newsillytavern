import fs from 'fs';
import path from 'path';

// Data directory path
const DATA_DIR = path.join(process.cwd(), 'data');

// File paths for each data type
export const DATA_FILES = {
  characters: path.join(DATA_DIR, 'characters.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  groups: path.join(DATA_DIR, 'groups.json'),
  personas: path.join(DATA_DIR, 'personas.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  lorebooks: path.join(DATA_DIR, 'lorebooks.json'),
} as const;

// Default values for each data type
export const DEFAULT_DATA = {
  characters: [],
  sessions: [],
  groups: [],
  personas: [{
    id: 'default',
    name: 'User',
    description: '',
    avatar: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }],
  settings: {
    theme: 'dark',
    fontSize: 16,
    messageDisplay: 'bubble',
    showTimestamps: true,
    showTokens: true,
    autoScroll: true,
    autoSave: true,
    autoSaveInterval: 30000,
    confirmDelete: true,
    defaultBackground: '',
    backgroundFit: 'cover',
    swipeEnabled: true,
    quickReplies: ['Continue', '...', 'Yes', 'No'],
    hotkeys: {
      send: 'Enter',
      newLine: 'Shift+Enter',
      regenerate: 'Ctrl+R',
      swipeLeft: 'ArrowLeft',
      swipeRight: 'ArrowRight'
    },
    sound: {
      enabled: true,
      globalVolume: 0.85,
      maxSoundsPerMessage: 3,
      globalCooldown: 150,
      realtimeEnabled: true
    },
    backgroundTriggers: {
      enabled: true,
      globalCooldown: 250,
      realtimeEnabled: true,
      transitionDuration: 500
    },
    chatLayout: {
      novelMode: true,
      chatWidth: 60,
      chatHeight: 70,
      chatX: 50,
      chatY: 50,
      chatOpacity: 0.95,
      blurBackground: true,
      showCharacterSprite: true
    }
  },
  lorebooks: [],
};

// Ensure data directory exists
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Read JSON file with fallback to default
export function readDataFile<T>(filePath: string, defaultValue: T): T {
  try {
    ensureDataDir();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

// Write JSON file
export function writeDataFile<T>(filePath: string, data: T): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Read all persistent data
export function readAllPersistentData() {
  return {
    characters: readDataFile(DATA_FILES.characters, DEFAULT_DATA.characters),
    sessions: readDataFile(DATA_FILES.sessions, DEFAULT_DATA.sessions),
    groups: readDataFile(DATA_FILES.groups, DEFAULT_DATA.groups),
    personas: readDataFile(DATA_FILES.personas, DEFAULT_DATA.personas),
    settings: readDataFile(DATA_FILES.settings, DEFAULT_DATA.settings),
    lorebooks: readDataFile(DATA_FILES.lorebooks, DEFAULT_DATA.lorebooks),
  };
}

// Write specific data type
export function writePersistentData(dataType: keyof typeof DATA_FILES, data: unknown): boolean {
  const filePath = DATA_FILES[dataType];
  if (!filePath) return false;
  return writeDataFile(filePath, data);
}

// Initialize all data files with defaults if they don't exist
export function initializeDataFiles(): void {
  ensureDataDir();

  Object.entries(DATA_FILES).forEach(([key, filePath]) => {
    const dataType = key as keyof typeof DEFAULT_DATA;
    if (!fs.existsSync(filePath)) {
      writeDataFile(filePath, DEFAULT_DATA[dataType]);
      console.log(`Initialized ${filePath}`);
    }
  });
}
