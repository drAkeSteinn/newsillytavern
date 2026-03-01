'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Target,
  Settings2,
  RotateCcw,
  ChevronDown,
  Save,
  Bell,
  Sparkles,
  Info,
  List,
  Cog
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import { QuestLogPanel } from './quest-log-panel';

export function QuestSettingsPanel() {
  const { questSettings, setQuestSettings, activeSessionId } = useTavernStore();
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(questSettings.promptTemplate);

  const handlePromptSave = useCallback(() => {
    setQuestSettings({ promptTemplate: localPrompt });
    setPromptEditorOpen(false);
  }, [localPrompt, setQuestSettings]);

  const handleResetPrompt = useCallback(() => {
    setLocalPrompt(DEFAULT_QUEST_SETTINGS.promptTemplate);
    setQuestSettings({ promptTemplate: DEFAULT_QUEST_SETTINGS.promptTemplate });
  }, [setQuestSettings]);

  return (
    <Tabs defaultValue="quests" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="quests" className="gap-2">
          <List className="w-4 h-4" />
          Misiones
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-2">
          <Cog className="w-4 h-4" />
          Configuración
        </TabsTrigger>
      </TabsList>

      {/* Quest Management Tab */}
      <TabsContent value="quests" className="flex-1 overflow-hidden m-0">
        {activeSessionId ? (
          <QuestLogPanel 
            sessionId={activeSessionId} 
            className="h-full"
          />
        ) : (
          <Card className="border-dashed h-full">
            <CardContent className="flex flex-col items-center justify-center h-full py-12">
              <Target className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin sesión activa</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Selecciona o crea una sesión de chat para gestionar las misiones.
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="flex-1 overflow-y-auto m-0">
        <div className="space-y-6 pr-2">
          {/* Main Enable/Disable */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-amber-500" />
                Sistema de Misiones
              </CardTitle>
              <CardDescription>
                Sistema de seguimiento de objetivos que se activan automáticamente o manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Activar Sistema</Label>
                  <p className="text-sm text-muted-foreground">
                    Habilita el seguimiento de misiones en la sesión actual.
                  </p>
                </div>
                <Switch
                  checked={questSettings.enabled}
                  onCheckedChange={(enabled) => setQuestSettings({ enabled })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Detection Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Detección Automática
              </CardTitle>
              <CardDescription>
                Configura cómo el sistema detecta y actualiza misiones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-sm">Auto-detectar</Label>
                  <p className="text-xs text-muted-foreground">
                    Detectar automáticamente misiones en los mensajes.
                  </p>
                </div>
                <Switch
                  checked={questSettings.autoDetect}
                  onCheckedChange={(autoDetect) => setQuestSettings({ autoDetect })}
                  disabled={!questSettings.enabled}
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-sm">Detección en tiempo real</Label>
                  <p className="text-xs text-muted-foreground">
                    Detectar durante el streaming de mensajes.
                  </p>
                </div>
                <Switch
                  checked={questSettings.realtimeEnabled}
                  onCheckedChange={(realtimeEnabled) => setQuestSettings({ realtimeEnabled })}
                  disabled={!questSettings.enabled}
                />
              </label>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-4 h-4 text-blue-500" />
                Visualización
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-sm">Mostrar notificaciones</Label>
                  <p className="text-xs text-muted-foreground">
                    Mostrar alertas cuando se actualice una misión.
                  </p>
                </div>
                <Switch
                  checked={questSettings.showNotifications}
                  onCheckedChange={(showNotifications) => setQuestSettings({ showNotifications })}
                  disabled={!questSettings.enabled}
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-sm">Mostrar completadas</Label>
                  <p className="text-xs text-muted-foreground">
                    Mantener misiones completadas en el registro.
                  </p>
                </div>
                <Switch
                  checked={questSettings.showCompletedInLog}
                  onCheckedChange={(showCompletedInLog) => setQuestSettings({ showCompletedInLog })}
                  disabled={!questSettings.enabled}
                />
              </label>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Máximo de misiones activas</Label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                    {questSettings.maxActiveQuests}
                  </span>
                </div>
                <Slider
                  value={[questSettings.maxActiveQuests]}
                  min={1}
                  max={20}
                  step={1}
                  disabled={!questSettings.enabled}
                  onValueChange={([maxActiveQuests]) => 
                    setQuestSettings({ maxActiveQuests })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Prompt Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="w-4 h-4 text-green-500" />
                Integración con Prompt
              </CardTitle>
              <CardDescription>
                Configura cómo las misiones se incluyen en el prompt del LLM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-sm">Incluir en prompt</Label>
                  <p className="text-xs text-muted-foreground">
                    Añadir misiones activas al prompt del LLM.
                  </p>
                </div>
                <Switch
                  checked={questSettings.promptInclude}
                  onCheckedChange={(promptInclude) => setQuestSettings({ promptInclude })}
                  disabled={!questSettings.enabled}
                />
              </label>

              <Collapsible open={promptEditorOpen} onOpenChange={setPromptEditorOpen}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    disabled={!questSettings.enabled}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Editar Template de Prompt
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      promptEditorOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <p><strong>Variables disponibles:</strong></p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li><code className="bg-blue-500/20 px-1 rounded">{'{{activeQuests}}'}</code> - Lista de misiones activas</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <Textarea
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    disabled={!questSettings.enabled}
                    placeholder="Template para incluir misiones en el prompt..."
                    className="min-h-[150px] font-mono text-sm"
                  />
                  
                  <div className="flex items-center justify-between">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={!questSettings.enabled}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Restaurar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Restaurar template por defecto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esto reemplazará tu template personalizado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleResetPrompt}>
                            Restaurar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button 
                      size="sm"
                      onClick={handlePromptSave}
                      disabled={!questSettings.enabled || localPrompt === questSettings.promptTemplate}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Guardar
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {!promptEditorOpen && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">Vista previa:</Label>
                  <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono max-h-[80px] overflow-y-auto text-muted-foreground">
                    {questSettings.promptTemplate.length > 200 
                      ? `${questSettings.promptTemplate.slice(0, 200)}...`
                      : questSettings.promptTemplate
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default QuestSettingsPanel;
