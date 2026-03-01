'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Brain,
  MessageSquare,
  Users,
  Settings2,
  RotateCcw,
  ChevronDown,
  FileText,
  Save,
  Sparkles,
  Clock,
  Info
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_SUMMARY_SETTINGS } from '@/types';

export function MemorySettingsPanel() {
  const { summarySettings, setSummarySettings } = useTavernStore();
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(summarySettings.promptTemplate);

  // Update local prompt when settings change
  const handlePromptSave = useCallback(() => {
    setSummarySettings({ promptTemplate: localPrompt });
    setPromptEditorOpen(false);
  }, [localPrompt, setSummarySettings]);

  // Reset prompt to default
  const handleResetPrompt = useCallback(() => {
    setLocalPrompt(DEFAULT_SUMMARY_SETTINGS.promptTemplate);
    setSummarySettings({ promptTemplate: DEFAULT_SUMMARY_SETTINGS.promptTemplate });
  }, [setSummarySettings]);

  return (
    <div className="space-y-6">
      {/* Main Enable/Disable */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-purple-500" />
            Sistema de Memoria y Resúmenes
          </CardTitle>
          <CardDescription>
            Genera resúmenes automáticos de la conversación para mantener contexto en chats largos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Activar Memoria</Label>
              <p className="text-sm text-muted-foreground">
                Genera resúmenes automáticos cuando la conversación alcance el límite configurado.
              </p>
            </div>
            <Switch
              checked={summarySettings.enabled}
              onCheckedChange={(enabled) => setSummarySettings({ enabled })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Interval Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-blue-500" />
            Intervalo de Resúmenes
          </CardTitle>
          <CardDescription>
            Define cada cuántos mensajes se generarán resúmenes automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Normal Chat Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Chat Normal</Label>
              </div>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {summarySettings.normalChatInterval} mensajes
              </span>
            </div>
            <Slider
              value={[summarySettings.normalChatInterval]}
              min={5}
              max={50}
              step={5}
              disabled={!summarySettings.enabled}
              onValueChange={([normalChatInterval]) => 
                setSummarySettings({ normalChatInterval })
              }
            />
            <p className="text-xs text-muted-foreground">
              Se generará un resumen cada {summarySettings.normalChatInterval} mensajes en chats individuales.
            </p>
          </div>

          {/* Group Chat Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Chat Grupal</Label>
              </div>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {summarySettings.groupChatInterval} mensajes
              </span>
            </div>
            <Slider
              value={[summarySettings.groupChatInterval]}
              min={5}
              max={40}
              step={5}
              disabled={!summarySettings.enabled}
              onValueChange={([groupChatInterval]) => 
                setSummarySettings({ groupChatInterval })
              }
            />
            <p className="text-xs text-muted-foreground">
              Se generará un resumen cada {summarySettings.groupChatInterval} mensajes en chats grupales.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-green-500" />
            Configuración de Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages to keep */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Mensajes recientes a conservar</Label>
              <Input
                type="number"
                value={summarySettings.keepRecentMessages}
                onChange={(e) => 
                  setSummarySettings({ keepRecentMessages: parseInt(e.target.value) || 10 })
                }
                disabled={!summarySettings.enabled}
                min={5}
                max={50}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Estos mensajes no se incluirán en el resumen.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tokens máx. del resumen</Label>
              <Input
                type="number"
                value={summarySettings.maxSummaryTokens}
                onChange={(e) => 
                  setSummarySettings({ maxSummaryTokens: parseInt(e.target.value) || 500 })
                }
                disabled={!summarySettings.enabled}
                min={100}
                max={2000}
                step={100}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Límite de tokens para el resumen generado.
              </p>
            </div>
          </div>

          {/* Behavior toggles */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Resumir al fin de turno</Label>
                <p className="text-xs text-muted-foreground">
                  Generar resumen después de que todos los personajes respondan (grupos).
                </p>
              </div>
              <Switch
                checked={summarySettings.summarizeOnTurnEnd}
                onCheckedChange={(summarizeOnTurnEnd) => 
                  setSummarySettings({ summarizeOnTurnEnd })
                }
                disabled={!summarySettings.enabled}
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Incluir pensamientos internos</Label>
                <p className="text-xs text-muted-foreground">
                  Incluir pensamientos y reflexiones de los personajes en el resumen.
                </p>
              </div>
              <Switch
                checked={summarySettings.includeCharacterThoughts}
                onCheckedChange={(includeCharacterThoughts) => 
                  setSummarySettings({ includeCharacterThoughts })
                }
                disabled={!summarySettings.enabled}
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Preservar momentos emocionales</Label>
                <p className="text-xs text-muted-foreground">
                  Destacar momentos emocionales importantes en el resumen.
                </p>
              </div>
              <Switch
                checked={summarySettings.preserveEmotionalMoments}
                onCheckedChange={(preserveEmotionalMoments) => 
                  setSummarySettings({ preserveEmotionalMoments })
                }
                disabled={!summarySettings.enabled}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Template Editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-orange-500" />
            Prompt de Resumen
          </CardTitle>
          <CardDescription>
            Personaliza el prompt que se envía al LLM para generar resúmenes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Collapsible open={promptEditorOpen} onOpenChange={setPromptEditorOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between"
                disabled={!summarySettings.enabled}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Editar Prompt Personalizado
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
                      <li><code className="bg-blue-500/20 px-1 rounded">{'{{conversation}}'}</code> - Se reemplaza con la conversación a resumir</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <Textarea
                value={localPrompt}
                onChange={(e) => setLocalPrompt(e.target.value)}
                disabled={!summarySettings.enabled}
                placeholder="Escribe tu prompt personalizado..."
                className="min-h-[200px] font-mono text-sm"
              />
              
              <div className="flex items-center justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={!summarySettings.enabled}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restaurar Default
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Restaurar prompt por defecto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esto reemplazará tu prompt personalizado con el prompt por defecto. Esta acción no se puede deshacer.
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
                  disabled={!summarySettings.enabled || localPrompt === summarySettings.promptTemplate}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Prompt Preview */}
          {!promptEditorOpen && (
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Vista previa del prompt:</Label>
              <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono max-h-[100px] overflow-y-auto text-muted-foreground">
                {summarySettings.promptTemplate.length > 300 
                  ? `${summarySettings.promptTemplate.slice(0, 300)}...`
                  : summarySettings.promptTemplate
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
