'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Upload,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Brain,
  X,
  Crown,
  Star,
  Package,
  Edit,
  Video,
  Film,
  FolderOpen,
  Check,
} from 'lucide-react';
import type { 
  SpriteConfig, 
  SpriteState, 
  SpriteCollection, 
  CharacterCard,
  SpriteIndexEntry,
  StateSpriteCollection,
  CollectionBehavior
} from '@/types';
import { StateCollectionEditor } from './state-collection-editor';
import { SpritePreview } from './sprite-preview';
import { getLogger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

const spriteLogger = getLogger('sprite');

interface SpriteManagerProps {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

// Standard sprite state definitions (only base states)
const STANDARD_STATES: { key: SpriteState; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'idle', label: 'Idle (Reposo)', icon: <Sparkles className="w-4 h-4" />, description: 'Sprite por defecto cuando no hace nada' },
  { key: 'talk', label: 'Talk (Hablando)', icon: <MessageSquare className="w-4 h-4" />, description: 'Sprite cuando está hablando' },
  { key: 'thinking', label: 'Thinking (Pensando)', icon: <Brain className="w-4 h-4" />, description: 'Sprite cuando está pensando' },
];

// Check if URL is a video file
function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?.*)?$/i.test(url);
}

// Check if URL is an animated image
function isAnimatedImage(url: string): boolean {
  return /\.(gif|apng)(\?.*)?$/i.test(url);
}

export function SpriteManager({ character, onChange }: SpriteManagerProps) {
  const [collections, setCollections] = useState<SpriteCollection[]>([]);
  const [customSprites, setCustomSprites] = useState<SpriteIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Selected collection for uploading - initialize from character's saved config
  const [selectedCollectionName, setSelectedCollectionName] = useState<string>(() => {
    return character.spriteConfig?.collection || 'custom';
  });
  
  // Dialogs
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [editingSpriteLabel, setEditingSpriteLabel] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current sprite config - memoized to prevent infinite loops
  const spriteConfig: SpriteConfig = useMemo(() => {
    return character.spriteConfig || {
      enabled: true,
      collection: '',
      sprites: {},
      stateCollections: {},
    };
  }, [character.spriteConfig]);

  // Fetch sprite collections and custom sprites
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [collectionsRes, spritesRes] = await Promise.all([
        fetch('/api/sprites/collections'),
        fetch('/api/sprites/index'),
      ]);
      
      const collectionsData = await collectionsRes.json();
      const spritesData = await spritesRes.json();
      
      setCollections(collectionsData.collections || []);
      setCustomSprites(spritesData.sprites || []);
      
      // Set default collection: first try character's saved collection, then 'custom', then first available
      if (collectionsData.collections?.length > 0) {
        const collectionNames = collectionsData.collections.map((c: SpriteCollection) => c.name);
        const savedCollection = character.spriteConfig?.collection;
        
        if (savedCollection && collectionNames.includes(savedCollection)) {
          // Use the saved collection from character config
          setSelectedCollectionName(savedCollection);
        } else {
          // Fallback: try 'custom', then first available
          const hasCustom = collectionNames.includes('custom');
          if (hasCustom) {
            setSelectedCollectionName('custom');
          } else {
            setSelectedCollectionName(collectionsData.collections[0].name);
          }
        }
      }
    } catch (error) {
      spriteLogger.error('Error fetching sprite data', { error });
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  // Handle collection selection change - saves to character's spriteConfig
  const handleCollectionChange = (collectionName: string) => {
    setSelectedCollectionName(collectionName);
    // Save to character's spriteConfig
    onChange({
      spriteConfig: {
        ...spriteConfig,
        collection: collectionName,
      },
    });
  };

  // Handle state collection change
  const handleStateCollectionChange = (state: SpriteState, collection: StateSpriteCollection) => {
    onChange({
      spriteConfig: {
        ...spriteConfig,
        stateCollections: {
          ...spriteConfig.stateCollections,
          [state]: collection,
        },
      },
    });
  };

  // Create new collection (folder)
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
        await fetchData();
        // Save the new collection as the character's selected collection
        handleCollectionChange(newCollectionName.trim());
        setShowNewCollectionDialog(false);
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

  // Upload sprite to selected collection
  const handleUploadSprite = async (file: File, label: string) => {
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'sprite');
      formData.append('collection', selectedCollectionName);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Add to sprite index
        const addResponse = await fetch('/api/sprites/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: label || file.name.replace(/\.[^/.]+$/, ''),
            filename: file.name,
            url: data.url,
            pack: selectedCollectionName,
          }),
        });
        
        if (addResponse.ok) {
          await fetchData();
        }
        
        setShowUploadDialog(false);
        setUploadLabel('');
      } else {
        alert(data.error || 'Error al subir el sprite');
      }
    } catch (error) {
      spriteLogger.error('Upload error', { error });
      alert('Error al subir el sprite');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const defaultLabel = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/\s+/g, '_');
      setUploadLabel(defaultLabel);
      handleUploadSprite(file, uploadLabel || defaultLabel);
    }
  };

  // Delete custom sprite
  const handleDeleteSprite = async (sprite: SpriteIndexEntry) => {
    if (!confirm(`¿Eliminar el sprite "${sprite.label}"?`)) return;
    
    try {
      const params = new URLSearchParams({
        label: sprite.label,
        pack: sprite.pack || selectedCollectionName,
      });
      const response = await fetch(`/api/sprites/index?${params}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setCustomSprites(prev => prev.filter(s => s.label !== sprite.label));
      }
    } catch (error) {
      spriteLogger.error('Delete sprite error', { error });
    }
  };

  // Rename sprite
  const handleRenameSprite = async (sprite: SpriteIndexEntry, newLabel: string) => {
    if (!newLabel.trim() || sprite.label === newLabel.trim()) {
      setEditingSpriteLabel(null);
      return;
    }
    
    try {
      const response = await fetch('/api/sprites/index', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          oldLabel: sprite.label, 
          newLabel: newLabel.trim(),
          pack: sprite.pack || selectedCollectionName,
        }),
      });
      
      if (response.ok) {
        setCustomSprites(prev => prev.map(s => 
          s.label === sprite.label ? { ...s, label: newLabel.trim() } : s
        ));
      }
    } catch (error) {
      spriteLogger.error('Rename sprite error', { error });
    } finally {
      setEditingSpriteLabel(null);
    }
  };

  // Filter sprites by selected collection
  const spritesInSelectedCollection = useMemo(() => {
    if (!selectedCollectionName) return customSprites;
    return customSprites.filter(s => s.pack === selectedCollectionName);
  }, [customSprites, selectedCollectionName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/webm"
        onChange={handleFileChange}
      />

      {/* Tabs for State Collections and Custom Sprites */}
      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="collections" className="text-xs gap-1">
            <Package className="w-3.5 h-3.5" />
            Colecciones de Estado
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs gap-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Sprites Personalizados
          </TabsTrigger>
        </TabsList>

        {/* State Collections Tab */}
        <TabsContent value="collections" className="space-y-4 mt-3">
          {/* Info Banner */}
          <div className="text-xs bg-muted/50 border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Package className="w-4 h-4 text-purple-500" />
              Colecciones de Estado
            </div>
            <p className="text-muted-foreground">
              Cada estado (Idle, Talk, Thinking) ahora es una <strong>colección de sprites</strong>. 
              Agrega sprites desde tus Sprites Personalizados y define cuál es el principal y cuáles son alternativos.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20">
                <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                  <Crown className="w-3 h-3" />
                  Principal
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Sprite que se usará por defecto
                </p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                <div className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                  <Star className="w-3 h-3" />
                  Alternativos
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Variantes adicionales
                </p>
              </div>
              <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <RefreshCw className="w-3 h-3" />
                  Comportamiento
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Principal/Aleatorio/Lista
                </p>
              </div>
            </div>
          </div>

          {/* State Collections Grid */}
          <div className="grid grid-cols-1 gap-4">
            {STANDARD_STATES.map(state => (
              <StateCollectionEditor
                key={state.key}
                stateKey={state.key}
                stateLabel={state.label}
                stateIcon={state.icon}
                stateDescription={state.description}
                collection={spriteConfig.stateCollections?.[state.key]}
                customSprites={spritesInSelectedCollection}
                selectedCollectionName={selectedCollectionName}
                onChange={(collection) => handleStateCollectionChange(state.key, collection)}
              />
            ))}
          </div>

          {/* Collection selector for state collections - shows character's configured collection */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-xs">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Sprites disponibles desde la colección:
            </span>
            <span className="font-medium text-foreground">
              {spriteConfig.collection || selectedCollectionName}
            </span>
            <span className="text-muted-foreground">
              ({spritesInSelectedCollection.length} sprites)
            </span>
          </div>

          {spritesInSelectedCollection.length === 0 && (
            <div className="text-center py-4 text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <ImageIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No hay sprites en "{selectedCollectionName}"</p>
              <p className="text-xs mt-1">
                Ve a la pestaña "Sprites Personalizados" para subir sprites a esta colección.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Custom Sprites Tab */}
        <TabsContent value="custom" className="space-y-4 mt-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Sprites Personalizados</h4>
              <p className="text-xs text-muted-foreground">
                Sube y gestiona los sprites que usarás en las colecciones de estado.
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Sincronizar colecciones"
              >
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Collection Selector */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Colección de Sprites</Label>
              <Select
                value={selectedCollectionName}
                onValueChange={handleCollectionChange}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="Seleccionar colección..." />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.name}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-3 h-3" />
                        {collection.name} ({collection.files.length})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowNewCollectionDialog(true)}
            >
              <FolderPlus className="w-4 h-4 mr-1" />
              Nueva
            </Button>
          </div>

          {/* Upload Section */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 flex-1"
              onClick={() => setShowUploadDialog(true)}
              disabled={!selectedCollectionName}
            >
              <Upload className="w-4 h-4 mr-1" />
              Subir Sprite a "{selectedCollectionName}"
            </Button>
          </div>

          {/* Sprites Grid */}
          {spritesInSelectedCollection.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-3 gap-2 pr-2">
                {spritesInSelectedCollection.map(sprite => (
                  <div
                    key={sprite.label}
                    className="relative group border rounded-lg overflow-hidden"
                  >
                    <div className="aspect-square relative bg-muted/50">
                      <SpritePreview
                        src={sprite.url}
                        alt={sprite.label}
                        className="w-full h-full"
                        objectFit="contain"
                      />
                      {/* Type indicator */}
                      {isVideoUrl(sprite.url) && (
                        <div className="absolute top-1 right-1">
                          <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-blue-500/80 text-white">
                            <Video className="w-2.5 h-2.5 mr-0.5" />
                            WEBM
                          </Badge>
                        </div>
                      )}
                      {isAnimatedImage(sprite.url) && (
                        <div className="absolute top-1 right-1">
                          <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-purple-500/80 text-white">
                            <Film className="w-2.5 h-2.5 mr-0.5" />
                            GIF
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    {/* Label */}
                    <div className="p-1.5 bg-background border-t">
                      {editingSpriteLabel === sprite.label ? (
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          onBlur={() => handleRenameSprite(sprite, newLabel)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSprite(sprite, newLabel);
                            if (e.key === 'Escape') setEditingSpriteLabel(null);
                          }}
                          className="w-full h-6 text-xs px-1 border rounded"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs truncate flex-1">{sprite.label}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => {
                                setEditingSpriteLabel(sprite.label);
                                setNewLabel(sprite.label);
                              }}
                            >
                              <Edit className="w-2.5 h-2.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteSprite(sprite)}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay sprites en "{selectedCollectionName}"</p>
              <p className="text-xs mt-1">Sube sprites a esta colección</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowUploadDialog(true)}
              >
                <Upload className="w-4 h-4 mr-1" />
                Subir Sprite
              </Button>
            </div>
          )}

          {/* Collections Info */}
          {collections.length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-xs mb-2 block">
                Todas las colecciones ({collections.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {collections.map(collection => (
                  <Badge 
                    key={collection.id} 
                    variant={collection.name === selectedCollectionName ? "default" : "outline"} 
                    className="text-xs cursor-pointer"
                    onClick={() => handleCollectionChange(collection.name)}
                  >
                    {collection.name === selectedCollectionName && (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    <FolderOpen className="w-3 h-3 mr-1" />
                    {collection.name} ({collection.files.length})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Collection Dialog */}
      <Dialog open={showNewCollectionDialog} onOpenChange={setShowNewCollectionDialog}>
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
              <p className="text-xs text-muted-foreground mt-1">
                Se creará una nueva carpeta para organizar tus sprites.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCollectionDialog(false)}>
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

      {/* Upload Sprite Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Sprite a "{selectedCollectionName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="spriteLabel">Etiqueta del sprite</Label>
              <Input
                id="spriteLabel"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="Ej: happy, sad, excited..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Identificador único para este sprite (sin espacios, usar guiones bajos)
              </p>
            </div>
            
            <div>
              <Label className="text-xs mb-2 block">Seleccionar archivo</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, WebP, WebM (máx. 10MB)
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SpriteManager;
