'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  MessageSquare,
  Type,
  Palette,
  Sparkles,
  ChevronDown,
  Info,
  RotateCcw,
  Settings2
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_DIALOGUE_SETTINGS } from '@/types';

// ============================================
// Dialogue Settings Panel
// ============================================

export function DialogueSettingsPanel() {
  const { dialogueSettings, setDialogueSettings, setTypewriterSettings } = useTavernStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  return (
    <div className="space-y-4">
      {/* Main Toggle */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4 text-purple-500" />
            Sistema de Diálogos
          </CardTitle>
          <CardDescription className="text-xs">
            Mejora la presentación visual de mensajes con speech bubbles, typewriter y formateo automático.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Activar Formateo de Diálogos</Label>
              <p className="text-xs text-muted-foreground">
                Detecta automáticamente diálogos, acciones y pensamientos.
              </p>
            </div>
            <Switch
              checked={dialogueSettings.enabled}
              onCheckedChange={(enabled) => setDialogueSettings({ enabled })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bubble Style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Palette className="w-4 h-4 text-pink-500" />
            Estilo de Burbujas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Estilo Visual</Label>
            <Select 
              value={dialogueSettings.bubbleStyle} 
              onValueChange={(v) => setDialogueSettings({ bubbleStyle: v as typeof dialogueSettings.bubbleStyle })}
              disabled={!dialogueSettings.enabled}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern - Limpio y redondeado</SelectItem>
                <SelectItem value="classic">Classic - Estilo cómic</SelectItem>
                <SelectItem value="minimal">Minimal - Borde simple</SelectItem>
                <SelectItem value="neon">Neon - Efecto brillante</SelectItem>
                <SelectItem value="elegant">Elegant - Decorativo</SelectItem>
                <SelectItem value="dark">Dark - Modo oscuro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
              <span className="text-xs mb-1">Avatar</span>
              <Switch
                checked={dialogueSettings.showCharacterAvatar}
                onCheckedChange={(showCharacterAvatar) => setDialogueSettings({ showCharacterAvatar })}
                disabled={!dialogueSettings.enabled}
                className="scale-75"
              />
            </label>
            <div className="space-y-1">
              <Label className="text-xs">Posición</Label>
              <Select 
                value={dialogueSettings.avatarPosition} 
                onValueChange={(v) => setDialogueSettings({ avatarPosition: v as typeof dialogueSettings.avatarPosition })}
                disabled={!dialogueSettings.enabled || !dialogueSettings.showCharacterAvatar}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Izquierda</SelectItem>
                  <SelectItem value="right">Derecha</SelectItem>
                  <SelectItem value="hidden">Oculto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tamaño</Label>
              <Select 
                value={dialogueSettings.avatarSize} 
                onValueChange={(v) => setDialogueSettings({ avatarSize: v as typeof dialogueSettings.avatarSize })}
                disabled={!dialogueSettings.enabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Pequeño</SelectItem>
                  <SelectItem value="md">Mediano</SelectItem>
                  <SelectItem value="lg">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Ancho máximo</span>
              <span className="text-muted-foreground">{dialogueSettings.bubbleMaxWidth}%</span>
            </div>
            <Slider
              value={[dialogueSettings.bubbleMaxWidth]}
              min={50}
              max={100}
              step={5}
              disabled={!dialogueSettings.enabled}
              onValueChange={([bubbleMaxWidth]) => setDialogueSettings({ bubbleMaxWidth })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Typewriter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Type className="w-4 h-4 text-blue-500" />
            Efecto Typewriter
          </CardTitle>
          <CardDescription className="text-xs">
            Efecto de escritura progresiva del texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-xs">Activar efecto</Label>
            </div>
            <Switch
              checked={dialogueSettings.typewriter.enabled}
              onCheckedChange={(enabled) => setTypewriterSettings({ enabled })}
              disabled={!dialogueSettings.enabled}
              className="scale-75"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Velocidad</span>
                <span className="text-muted-foreground">{dialogueSettings.typewriter.speed} c/s</span>
              </div>
              <Slider
                value={[dialogueSettings.typewriter.speed]}
                min={10}
                max={200}
                step={10}
                disabled={!dialogueSettings.enabled || !dialogueSettings.typewriter.enabled}
                onValueChange={([speed]) => setTypewriterSettings({ speed })}
              />
            </div>
            
            <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-xs">Pausa en puntuación</Label>
              </div>
              <Switch
                checked={dialogueSettings.typewriter.pauseOnPunctuation}
                onCheckedChange={(pauseOnPunctuation) => setTypewriterSettings({ pauseOnPunctuation })}
                disabled={!dialogueSettings.enabled || !dialogueSettings.typewriter.enabled}
                className="scale-75"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-xs">Mostrar cursor</Label>
              </div>
              <Switch
                checked={dialogueSettings.typewriter.showCursor}
                onCheckedChange={(showCursor) => setTypewriterSettings({ showCursor })}
                disabled={!dialogueSettings.enabled || !dialogueSettings.typewriter.enabled}
                className="scale-75"
              />
            </label>
            
            <div className="space-y-1">
              <Label className="text-xs">Cursor</Label>
              <Input
                value={dialogueSettings.typewriter.cursorChar}
                onChange={(e) => setTypewriterSettings({ cursorChar: e.target.value })}
                disabled={!dialogueSettings.enabled || !dialogueSettings.typewriter.enabled}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Format Detection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Detección de Formato
          </CardTitle>
          <CardDescription className="text-xs">
            El sistema detecta automáticamente diferentes tipos de contenido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-xs">Emociones</Label>
              </div>
              <Switch
                checked={dialogueSettings.parseEmotions}
                onCheckedChange={(parseEmotions) => setDialogueSettings({ parseEmotions })}
                disabled={!dialogueSettings.enabled}
                className="scale-75"
              />
            </label>
            
            <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-xs">Acciones</Label>
              </div>
              <Switch
                checked={dialogueSettings.highlightActions}
                onCheckedChange={(highlightActions) => setDialogueSettings({ highlightActions })}
                disabled={!dialogueSettings.enabled}
                className="scale-75"
              />
            </label>
          </div>

          {/* Format Legend */}
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <Label className="text-xs font-medium">Formatos detectados:</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Diálogo:</span>
                <code className="bg-muted px-1 rounded">"texto"</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Acción:</span>
                <code className="bg-muted px-1 rounded">*texto*</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Pensamiento:</span>
                <code className="bg-muted px-1 rounded">(texto)</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Susurro:</span>
                <code className="bg-muted px-1 rounded">~texto~</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between h-9"
            disabled={!dialogueSettings.enabled}
          >
            <span className="flex items-center gap-2 text-xs">
              <Settings2 className="w-3.5 h-3.5" />
              Configuración Avanzada
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              advancedOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {/* Animation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Animaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-xs">Animar entrada</Label>
                </div>
                <Switch
                  checked={dialogueSettings.animateEntry}
                  onCheckedChange={(animateEntry) => setDialogueSettings({ animateEntry })}
                  disabled={!dialogueSettings.enabled}
                  className="scale-75"
                />
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select 
                    value={dialogueSettings.entryAnimation} 
                    onValueChange={(v) => setDialogueSettings({ entryAnimation: v as typeof dialogueSettings.entryAnimation })}
                    disabled={!dialogueSettings.enabled || !dialogueSettings.animateEntry}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="slide">Slide</SelectItem>
                      <SelectItem value="scale">Scale</SelectItem>
                      <SelectItem value="none">Ninguno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Duración</span>
                    <span className="text-muted-foreground">{dialogueSettings.animationDurationMs}ms</span>
                  </div>
                  <Slider
                    value={[dialogueSettings.animationDurationMs]}
                    min={50}
                    max={500}
                    step={50}
                    disabled={!dialogueSettings.enabled || !dialogueSettings.animateEntry}
                    onValueChange={([animationDurationMs]) => setDialogueSettings({ animationDurationMs })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spacing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Espaciado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Label className="text-xs">Espaciado de mensajes</Label>
                <Select 
                  value={dialogueSettings.messageSpacing} 
                  onValueChange={(v) => setDialogueSettings({ messageSpacing: v as typeof dialogueSettings.messageSpacing })}
                  disabled={!dialogueSettings.enabled}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compacto</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="spacious">Espacioso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Reset */}
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => setDialogueSettings(DEFAULT_DIALOGUE_SETTINGS)}
            disabled={!dialogueSettings.enabled}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Restaurar valores por defecto
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default DialogueSettingsPanel;
