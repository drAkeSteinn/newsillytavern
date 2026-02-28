'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Upload,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Check,
  Sparkles,
  MessageSquare,
  Brain,
  Smile,
  Frown,
  Angry,
  RefreshCw,
  X,
  GripVertical
} from 'lucide-react';
import type { SpriteConfig, SpriteState, SpriteCollection, CharacterCard } from '@/types';
import { SpritePreview, SpriteThumbnail, SpriteTypeBadge } from './sprite-preview';
import { getLogger } from '@/lib/logger';

const spriteLogger = getLogger('sprite');

interface SpriteManagerProps {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

// Standard sprite state definitions
const STANDARD_STATES: { key: SpriteState; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'idle', label: 'Idle', icon: <Sparkles className="w-4 h-4" />, description: 'Sprite por defecto cuando no hace nada' },
  { key: 'talk', label: 'Talk', icon: <MessageSquare className="w-4 h-4" />, description: 'Sprite cuando está hablando' },
  { key: 'thinking', label: 'Thinking', icon: <Brain className="w-4 h-4" />, description: 'Sprite cuando está pensando' },
  { key: 'happy', label: 'Happy', icon: <Smile className="w-4 h-4" />, description: 'Sprite cuando está feliz' },
  { key: 'sad', label: 'Sad', icon: <Frown className="w-4 h-4" />, description: 'Sprite cuando está triste' },
  { key: 'angry', label: 'Angry', icon: <Angry className="w-4 h-4" />, description: 'Sprite cuando está enojado' },
];

// Extended sprite state type for custom states
type ExtendedSpriteState = SpriteState | string;

export function SpriteManager({ character, onChange }: SpriteManagerProps) {
  const [collections, setCollections] = useState<SpriteCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [customStates, setCustomStates] = useState<string[]>([]);
  const [showAddState, setShowAddState] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  
  // Sprite selection dialog state
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [selectingForState, setSelectingForState] = useState<ExtendedSpriteState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStateRef = useRef<ExtendedSpriteState | null>(null);
  const initialCustomStatesLoaded = useRef(false);

  // Get current sprite config - memoized to prevent infinite loops
  const spriteConfig: SpriteConfig = useMemo(() => {
    return character.spriteConfig || {
      enabled: true,
      collection: '',
      sprites: {}
    };
  }, [character.spriteConfig]);

  // Load custom states from spriteConfig - only once on mount
  useEffect(() => {
    if (initialCustomStatesLoaded.current) return;
    initialCustomStatesLoaded.current = true;

    const sprites = character.spriteConfig?.sprites;
    if (sprites) {
      const standardKeys = STANDARD_STATES.map(s => s.key);
      const custom = Object.keys(sprites).filter(key => !standardKeys.includes(key as SpriteState));
      if (custom.length > 0) {
        setCustomStates(custom);
      }
    }
  }, [character.spriteConfig?.sprites]);

  // Fetch sprite collections
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch('/api/sprites/collections');
        const data = await response.json();
        setCollections(data.collections || []);
      } catch (error) {
        spriteLogger.error('Error fetching sprite collections', { error });
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  // Refresh collections manually
  const handleRefreshCollections = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/sprites/collections');
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      spriteLogger.error('Error refreshing sprite collections', { error });
    } finally {
      setRefreshing(false);
    }
  };

  // Handle collection selection
  const handleCollectionChange = (collectionName: string) => {
    const newConfig: SpriteConfig = {
      enabled: true,
      collection: collectionName || undefined,
      sprites: spriteConfig.sprites || {}
    };
    onChange({
      spriteConfig: newConfig
    });
  };

  // Open sprite selection dialog for a state
  const openSpriteSelection = (state: ExtendedSpriteState) => {
    setSelectingForState(state);
    setSelectionDialogOpen(true);
  };

  // Handle sprite upload
  const handleSpriteUpload = async (state: ExtendedSpriteState, file: File) => {
    setUploading(state);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'sprite');
      formData.append('collection', spriteConfig.collection || 'custom');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        onChange({
          spriteConfig: {
            ...spriteConfig,
            sprites: {
              ...spriteConfig.sprites,
              [state]: data.url
            }
          }
        });

        // Refresh collections if we uploaded to a new one
        if (!collections.find(c => c.name === spriteConfig.collection)) {
          const collectionsResponse = await fetch('/api/sprites/collections');
          const collectionsData = await collectionsResponse.json();
          setCollections(collectionsData.collections || []);
        }
      } else {
        alert(data.error || 'Error al subir el sprite');
      }
    } catch (error) {
      spriteLogger.error('Upload error', { error });
      alert('Error al subir el sprite');
    } finally {
      setUploading(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectionDialogOpen(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadStateRef.current) {
      handleSpriteUpload(uploadStateRef.current, file);
      uploadStateRef.current = null;
    }
  };

  // Trigger file upload for a state
  const triggerUpload = (state: ExtendedSpriteState) => {
    uploadStateRef.current = state;
    fileInputRef.current?.click();
  };

  // Handle sprite removal
  const handleRemoveSprite = (state: ExtendedSpriteState) => {
    const newSprites = { ...spriteConfig.sprites };
    delete newSprites[state];
    onChange({
      spriteConfig: {
        ...spriteConfig,
        sprites: newSprites
      }
    });
  };

  // Create new collection
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    setCreatingCollection(true);
    try {
      const response = await fetch('/api/sprites/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName.trim() })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh collections
        const collectionsResponse = await fetch('/api/sprites/collections');
        const collectionsData = await collectionsResponse.json();
        setCollections(collectionsData.collections || []);
        
        // Select the new collection - ensure we pass the full spriteConfig
        const newConfig: SpriteConfig = {
          enabled: true,
          collection: data.collection.name,
          sprites: spriteConfig.sprites || {}
        };
        onChange({
          spriteConfig: newConfig
        });
        
        setShowNewCollection(false);
        setNewCollectionName('');
      } else {
        alert(data.error || 'Error al crear la colección');
      }
    } catch (error) {
      spriteLogger.error('Create collection error', { error });
      alert('Error al crear la colección');
    } finally {
      setCreatingCollection(false);
    }
  };

  // Select sprite from collection
  const handleSelectFromCollection = (url: string) => {
    if (!selectingForState) return;
    
    onChange({
      spriteConfig: {
        ...spriteConfig,
        sprites: {
          ...spriteConfig.sprites,
          [selectingForState]: url
        }
      }
    });
    setSelectionDialogOpen(false);
  };

  // Add custom state
  const handleAddCustomState = () => {
    if (!newStateName.trim()) return;
    
    const stateKey = newStateName.trim().toLowerCase().replace(/\s+/g, '_');
    
    // Check if state already exists
    const allStates = [...STANDARD_STATES.map(s => s.key), ...customStates];
    if (allStates.includes(stateKey)) {
      alert('Este estado ya existe');
      return;
    }
    
    setCustomStates(prev => [...prev, stateKey]);
    setShowAddState(false);
    setNewStateName('');
  };

  // Remove custom state
  const handleRemoveCustomState = (state: string) => {
    setCustomStates(prev => prev.filter(s => s !== state));
    handleRemoveSprite(state);
  };

  // Get available sprites from selected collection
  const selectedCollection = collections.find(c => c.name === spriteConfig.collection);

  // Combine standard and custom states
  const allStates = [
    ...STANDARD_STATES,
    ...customStates.map(state => ({
      key: state as SpriteState,
      label: state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, ' '),
      icon: <ImageIcon className="w-4 h-4" />,
      description: 'Estado personalizado'
    }))
  ];

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/webm"
        onChange={handleFileChange}
      />

      {/* Collection Selection */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">Colección de Sprites</Label>
          <Select
            value={spriteConfig.collection || ''}
            onValueChange={handleCollectionChange}
          >
            <SelectTrigger className="h-8 mt-1">
              <SelectValue placeholder="Seleccionar colección..." />
            </SelectTrigger>
            <SelectContent>
              {collections.map((collection) => (
                <SelectItem key={collection.id} value={collection.name}>
                  {collection.name} ({collection.files.length} sprites)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleRefreshCollections}
          disabled={refreshing}
          title="Actualizar colecciones"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setShowNewCollection(true)}
        >
          <FolderPlus className="w-4 h-4 mr-1" />
          Nueva
        </Button>
      </div>

      {/* Avatar fallback notice */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        💡 <strong>Idle</strong> usará el avatar del personaje si no se configura.
        <strong> Talk</strong> usará idle/avatar si no se configura.
      </div>

      {/* Sprite States Grid */}
      <div className="space-y-3">
        {/* Standard States */}
        <div className="grid grid-cols-2 gap-3">
          {STANDARD_STATES.map((state) => {
            const spriteUrl = spriteConfig.sprites[state.key as SpriteState];
            const isUploading = uploading === state.key;

            return (
              <SpriteStateCard
                key={state.key}
                state={state}
                spriteUrl={spriteUrl}
                isUploading={isUploading}
                onSelect={() => openSpriteSelection(state.key)}
                onRemove={() => handleRemoveSprite(state.key)}
              />
            );
          })}
        </div>

        {/* Custom States */}
        {customStates.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Estados Personalizados</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {customStates.map((state) => {
                const spriteUrl = spriteConfig.sprites[state];
                const isUploading = uploading === state;
                const stateInfo = {
                  key: state as SpriteState,
                  label: state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, ' '),
                  icon: <ImageIcon className="w-4 h-4" />,
                  description: 'Estado personalizado'
                };

                return (
                  <SpriteStateCard
                    key={state}
                    state={stateInfo}
                    spriteUrl={spriteUrl}
                    isUploading={isUploading}
                    onSelect={() => openSpriteSelection(state)}
                    onRemove={() => handleRemoveCustomState(state)}
                    isCustom
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Add Custom State Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAddState(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar Estado Personalizado
        </Button>
      </div>

      {/* Sprites from Collection Preview */}
      {selectedCollection && selectedCollection.files.length > 0 && (
        <div className="border-t pt-4">
          <Label className="text-xs mb-2 block">
            Sprites en "{selectedCollection.name}" ({selectedCollection.files.length})
          </Label>
          <ScrollArea className="h-28">
            <div className="flex gap-2 flex-wrap">
              {selectedCollection.files.map((file, index) => (
                <div
                  key={index}
                  className="relative group/collection w-14 h-14 rounded border overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  title={file.name}
                  onClick={() => {
                    // Quick assign - opens dialog to select which state
                    if (allStates.length > 0) {
                      openSpriteSelection(allStates[0].key);
                    }
                  }}
                >
                  <SpriteThumbnail
                    src={file.url}
                    alt={file.name}
                    size="md"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground mt-1">
            Haz clic en un estado arriba para seleccionar un sprite de la colección
          </p>
        </div>
      )}

      {/* New Collection Dialog */}
      <Dialog open={showNewCollection} onOpenChange={setShowNewCollection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Colección de Sprites</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="collectionName">Nombre de la colección</Label>
              <Input
                id="collectionName"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Ej: expressions, outfits, emotions..."
                className="mt-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCollection(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCollection} disabled={creatingCollection || !newCollectionName.trim()}>
              {creatingCollection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4 mr-1" />
                  Crear
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom State Dialog */}
      <Dialog open={showAddState} onOpenChange={setShowAddState}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Estado de Sprite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="stateName">Nombre del estado</Label>
              <Input
                id="stateName"
                value={newStateName}
                onChange={(e) => setNewStateName(e.target.value)}
                placeholder="Ej: blushing, excited, sleepy..."
                className="mt-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomState()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El estado se guardará en minúsculas y con guiones bajos en lugar de espacios.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddState(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCustomState} disabled={!newStateName.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sprite Selection Dialog */}
      <Dialog open={selectionDialogOpen} onOpenChange={setSelectionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Seleccionar Sprite para "{selectingForState}"
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Upload Section */}
            <div>
              <Label className="text-xs mb-2 block">Subir nueva imagen</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => selectingForState && triggerUpload(selectingForState)}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Haz clic para subir una imagen
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, WebP, WebM (máx. 10MB)
                </p>
              </div>
            </div>

            {/* Collection Selection */}
            {selectedCollection && selectedCollection.files.length > 0 ? (
              <div>
                <Label className="text-xs mb-2 block">
                  O seleccionar de "{selectedCollection.name}"
                </Label>
                <ScrollArea className="h-48">
                  <div className="grid grid-cols-4 gap-2">
                    {selectedCollection.files.map((file, index) => {
                      const isSelected = spriteConfig.sprites[selectingForState as keyof typeof spriteConfig.sprites] === file.url;
                      
                      return (
                        <div
                          key={index}
                          className={cn(
                            "relative group aspect-square rounded border overflow-hidden cursor-pointer transition-all",
                            isSelected 
                              ? "border-primary ring-2 ring-primary/30" 
                              : "hover:border-primary"
                          )}
                          onClick={() => handleSelectFromCollection(file.url)}
                          title={file.name}
                        >
                          <SpriteThumbnail
                            src={file.url}
                            alt={file.name}
                            size="lg"
                            className="w-full h-full"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {collections.length === 0 ? (
                  <>
                    <p>No hay colecciones de sprites.</p>
                    <p>Crea una colección y sube sprites para seleccionarlos aquí.</p>
                  </>
                ) : (
                  <>
                    <p>Selecciona una colección arriba para ver los sprites disponibles.</p>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectionDialogOpen(false)}>
              Cancelar
            </Button>
            {selectingForState && spriteConfig.sprites[selectingForState as keyof typeof spriteConfig.sprites] && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleRemoveSprite(selectingForState);
                  setSelectionDialogOpen(false);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sprite State Card Component
interface SpriteStateCardProps {
  state: {
    key: SpriteState | string;
    label: string;
    icon: React.ReactNode;
    description: string;
  };
  spriteUrl?: string;
  isUploading: boolean;
  onSelect: () => void;
  onRemove: () => void;
  isCustom?: boolean;
}

function SpriteStateCard({ state, spriteUrl, isUploading, onSelect, onRemove, isCustom }: SpriteStateCardProps) {
  const isIdle = state.key === 'idle';
  const isTalk = state.key === 'talk';

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-muted rounded">
          {state.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{state.label}</div>
          <div className="text-xs text-muted-foreground truncate">{state.description}</div>
        </div>
      </div>

      {/* Sprite Preview */}
      <div className="relative group">
        <div
          className={cn(
            "w-full h-20 rounded border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors",
            spriteUrl ? "border-primary/30 bg-muted/30" : "border-muted-foreground/25",
            !isUploading && "hover:border-primary/50 cursor-pointer"
          )}
          onClick={() => !isUploading && onSelect()}
        >
          {isUploading ? (
            <div className="text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              <span className="text-xs mt-1">Subiendo...</span>
            </div>
          ) : spriteUrl ? (
            <SpritePreview
              src={spriteUrl}
              alt={state.label}
              className="w-full h-full"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">
                {isIdle ? 'Usa avatar' : isTalk ? 'Usa idle' : 'Seleccionar'}
              </span>
            </div>
          )}
        </div>

        {/* Hover overlay */}
        {spriteUrl && !isUploading && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Cambiar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-6"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
