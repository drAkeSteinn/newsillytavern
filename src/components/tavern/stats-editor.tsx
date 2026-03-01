'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  GripVertical,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sword,
  Target,
  Mail,
  Settings2,
  AlertCircle,
  Info,
  Zap,
  CaseSensitive,
} from 'lucide-react';
import type {
  CharacterStatsConfig,
  AttributeDefinition,
  SkillDefinition,
  IntentionDefinition,
  InvitationDefinition,
  StatRequirement,
  AttributeType,
  RequirementOperator,
} from '@/types';
import { DEFAULT_STATS_BLOCK_HEADERS, DEFAULT_STATS_CONFIG } from '@/types';

interface StatsEditorProps {
  statsConfig: CharacterStatsConfig | undefined;
  onChange: (statsConfig: CharacterStatsConfig) => void;
}

// ============================================
// Attribute Editor Component (Accordion Style)
// ============================================

interface AttributeEditorProps {
  attribute: AttributeDefinition;
  index: number;
  onChange: (index: number, updates: Partial<AttributeDefinition>) => void;
  onDelete: (index: number) => void;
}

function AttributeEditor({ attribute, index, onChange, onDelete }: AttributeEditorProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Get display info
  const displayIcon = attribute.icon || (attribute.type === 'number' ? '🔢' : attribute.type === 'keyword' ? '🏷️' : '📝');
  const displayValue = attribute.defaultValue?.toString() || '0';
  
  return (
    <div className="border rounded-lg bg-muted/30">
      {/* Header - Clickable */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <span className="text-lg">{displayIcon}</span>
          <span className="font-medium text-sm">
            {attribute.name || `Atributo #${index + 1}`}
          </span>
          {attribute.key && (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {'{{' + attribute.key + '}}'}
            </code>
          )}
          <Badge variant="outline" className="text-xs capitalize">
            {attribute.type === 'number' ? 'Número' : attribute.type === 'keyword' ? 'Estado' : 'Texto'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">
            {attribute.type === 'number' ? `${displayValue}` : displayValue.slice(0, 15)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Basic Info */}
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Nombre *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Nombre visible del atributo. Ejemplo: "Vida", "Maná", "Resistencia"</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={attribute.name}
                onChange={(e) => onChange(index, { name: e.target.value })}
                placeholder="Vida, Maná, Resistencia..."
                className="h-8"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Key *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Identificador único para usar en templates. Se convierte automáticamente a minúsculas y guiones bajos.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Uso: {'{{vida}}'} en cualquier sección del personaje</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={attribute.key}
                onChange={(e) => onChange(index, { key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="vida, mana, resistencia..."
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
          
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Tipo de atributo</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium">Número:</p>
                    <p className="text-xs text-muted-foreground">Valores numéricos con min/max. Ej: Vida (0-100)</p>
                    <p className="font-medium mt-2">Estado:</p>
                    <p className="text-xs text-muted-foreground">Valores de texto que representan estados. Ej: "enojado", "feliz", "neutral"</p>
                    <p className="font-medium mt-2">Texto:</p>
                    <p className="text-xs text-muted-foreground">Texto libre sin restricciones. Ej: Notas, descripciones</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={attribute.type}
                onValueChange={(value: AttributeType) => onChange(index, { type: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">
                    <div className="flex items-center gap-2">
                      <span>🔢</span>
                      <span>Número</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="keyword">
                    <div className="flex items-center gap-2">
                      <span>🏷️</span>
                      <span>Estado</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <span>📝</span>
                      <span>Texto</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Valor por defecto</Label>
              <Input
                type={attribute.type === 'number' ? 'number' : 'text'}
                value={attribute.defaultValue}
                onChange={(e) => onChange(index, { 
                  defaultValue: attribute.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value 
                })}
                className="h-8"
              />
            </div>
          </div>
          
          {/* Number-specific: Min/Max */}
          {attribute.type === 'number' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Valor mínimo</Label>
                <Input
                  type="number"
                  value={attribute.min ?? ''}
                  onChange={(e) => onChange(index, { min: parseFloat(e.target.value) || undefined })}
                  placeholder="0"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Valor máximo</Label>
                <Input
                  type="number"
                  value={attribute.max ?? ''}
                  onChange={(e) => onChange(index, { max: parseFloat(e.target.value) || undefined })}
                  placeholder="100"
                  className="h-8"
                />
              </div>
            </div>
          )}
          
          {/* Detection Tags (Post-LLM) */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <Label className="text-xs font-medium">Detección automática (Post-LLM)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>Cuando el LLM escriba estos tags en su respuesta, el valor se actualizará automáticamente.</p>
                  <p className="mt-1 text-xs text-muted-foreground">El sistema busca el número/texto que viene DESPUÉS del tag.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Tags de detección</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Palabras o símbolos que preceden al valor. Separa múltiples con comas.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ejemplo: "Vida:, HP:, ❤️" detectará "Vida: 50", "HP: 30", "❤️ 100"</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={attribute.detectionTags || ''}
                onChange={(e) => onChange(index, { detectionTags: e.target.value || undefined })}
                placeholder="Vida:, HP:, ❤️"
                className="h-8"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={attribute.caseSensitive ?? false}
                onCheckedChange={(checked) => onChange(index, { caseSensitive: checked })}
              />
              <Label className="text-xs flex items-center gap-1">
                <CaseSensitive className="w-3 h-3" />
                Distinguir mayúsculas/minúsculas
              </Label>
            </div>
          </div>
          
          {/* Output Format */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Formato de salida</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Cómo se mostrará el valor cuando uses {'{{' + attribute.key + '}}'} en el prompt.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Usa {'{value}'} como placeholder para el valor actual.</p>
                  <p className="mt-1 text-xs">{`Ejemplo: "Vida: {value}" → "Vida: 50"`}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={attribute.outputFormat || ''}
              onChange={(e) => onChange(index, { outputFormat: e.target.value || undefined })}
              placeholder={attribute.type === 'number' ? "Vida: {value}" : "Estado: {value}"}
              className="h-8"
            />
            {attribute.outputFormat && (
              <p className="text-xs text-muted-foreground">
                Vista previa: <code className="bg-muted px-1 rounded">{attribute.outputFormat.replace('{value}', String(attribute.defaultValue || '0'))}</code>
              </p>
            )}
          </div>
          
          {/* UI Settings */}
          <div className="flex items-center gap-4 pt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Icono</Label>
              <Input
                value={attribute.icon || ''}
                onChange={(e) => onChange(index, { icon: e.target.value || undefined })}
                placeholder="❤️"
                className="h-8 w-16 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Color</Label>
              <Input
                value={attribute.color || ''}
                onChange={(e) => onChange(index, { color: e.target.value || undefined })}
                placeholder="red"
                className="h-8 w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={attribute.showInHUD ?? true}
                onCheckedChange={(checked) => onChange(index, { showInHUD: checked })}
              />
              <Label className="text-xs">Mostrar en HUD</Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Requirement Editor Component
// ============================================

interface RequirementEditorProps {
  requirement: StatRequirement;
  availableAttributes: AttributeDefinition[];
  onChange: (updates: Partial<StatRequirement>) => void;
  onDelete: () => void;
}

// Operator definitions with descriptions
const OPERATOR_OPTIONS: { value: RequirementOperator; label: string; description: string }[] = [
  { value: '>=', label: '≥', description: 'Mayor o igual que' },
  { value: '>', label: '>', description: 'Mayor que' },
  { value: '<=', label: '≤', description: 'Menor o igual que' },
  { value: '<', label: '<', description: 'Menor que' },
  { value: '==', label: '=', description: 'Exactamente igual' },
  { value: '!=', label: '≠', description: 'Diferente de' },
  { value: 'between', label: '∈', description: 'Entre (rango)' },
];

function RequirementEditor({ requirement, availableAttributes, onChange, onDelete }: RequirementEditorProps) {
  const selectedOperator = OPERATOR_OPTIONS.find(op => op.value === requirement.operator);
  
  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded p-2 flex-wrap">
      {/* Attribute selector */}
      <Select
        value={requirement.attributeKey}
        onValueChange={(value) => onChange({ attributeKey: value })}
      >
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue placeholder="Atributo" />
        </SelectTrigger>
        <SelectContent>
          {availableAttributes.map(attr => (
            <SelectItem key={attr.id} value={attr.key}>{attr.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Operator selector with descriptions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Select
            value={requirement.operator}
            onValueChange={(value: RequirementOperator) => onChange({ operator: value })}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono w-4">{op.label}</span>
                    <span className="text-muted-foreground text-xs">{op.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{selectedOperator?.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {requirement.operator === 'between' 
              ? `El valor debe estar entre ${requirement.value} y ${requirement.valueMax || '?'}`
              : `El valor debe ser ${selectedOperator?.description} ${requirement.value}`
            }
          </p>
        </TooltipContent>
      </Tooltip>
      
      {/* Value input */}
      <Input
        type="number"
        value={requirement.value}
        onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
        className="h-7 w-16 text-xs"
      />
      
      {/* Max value for between operator */}
      {requirement.operator === 'between' && (
        <>
          <span className="text-xs text-muted-foreground">y</span>
          <Input
            type="number"
            value={requirement.valueMax ?? ''}
            onChange={(e) => onChange({ valueMax: parseFloat(e.target.value) || undefined })}
            placeholder="max"
            className="h-7 w-16 text-xs"
          />
        </>
      )}
      
      {/* Delete button */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
        <Trash2 className="w-3 h-3 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ============================================
// Skill Editor Component
// ============================================

interface SkillEditorProps {
  skill: SkillDefinition;
  index: number;
  availableAttributes: AttributeDefinition[];
  onChange: (index: number, updates: Partial<SkillDefinition>) => void;
  onDelete: (index: number) => void;
}

function SkillEditor({ skill, index, availableAttributes, onChange, onDelete }: SkillEditorProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border rounded-lg bg-muted/30">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <Sword className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-sm">{skill.name || `Habilidad #${index + 1}`}</span>
          {skill.key && (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {'{{' + skill.key + '}}'}
            </code>
          )}
          {skill.requirements.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {skill.requirements.length} req
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                value={skill.name}
                onChange={(e) => onChange(index, { name: e.target.value })}
                placeholder="Golpe furioso"
                className="h-8"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Key *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Identificador para usar en templates.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Uso: {'{{' + (skill.key || 'habilidad') + '}}'} → Lista de habilidades</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={skill.key}
                onChange={(e) => onChange(index, { key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="golpe_furioso"
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs mb-1 block">Descripción</Label>
            <Textarea
              value={skill.description}
              onChange={(e) => onChange(index, { description: e.target.value })}
              placeholder="Descripción de la habilidad..."
              className="min-h-[60px] text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Categoría</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Agrupa habilidades relacionadas. Opcional.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={skill.category || ''}
              onChange={(e) => onChange(index, { category: e.target.value || undefined })}
              placeholder="combate, magia, social..."
              className="h-8"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Requisitos</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Condiciones que deben cumplirse para que la habilidad esté disponible.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ejemplo: Vida ≥ 20, Maná ≥ 10</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const newReq: StatRequirement = { attributeKey: '', operator: '>=', value: 0 };
                  onChange(index, { requirements: [...skill.requirements, newReq] });
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-1">
              {skill.requirements.map((req, reqIndex) => (
                <RequirementEditor
                  key={reqIndex}
                  requirement={req}
                  availableAttributes={availableAttributes}
                  onChange={(updates) => {
                    const newReqs = [...skill.requirements];
                    newReqs[reqIndex] = { ...newReqs[reqIndex], ...updates };
                    onChange(index, { requirements: newReqs });
                  }}
                  onDelete={() => {
                    onChange(index, { 
                      requirements: skill.requirements.filter((_, i) => i !== reqIndex) 
                    });
                  }}
                />
              ))}
              {skill.requirements.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin requisitos - siempre disponible</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Stats Editor Component
// ============================================

export function StatsEditor({ statsConfig, onChange }: StatsEditorProps) {
  const config: CharacterStatsConfig = statsConfig || DEFAULT_STATS_CONFIG;
  
  const updateConfig = (updates: Partial<CharacterStatsConfig>) => {
    onChange({ ...config, ...updates });
  };
  
  // Attributes
  const addAttribute = () => {
    const newAttr: AttributeDefinition = {
      id: `attr-${Date.now()}`,
      name: '',
      key: '',
      type: 'number',
      defaultValue: 0,
      showInHUD: true,
      caseSensitive: false,
    };
    updateConfig({ attributes: [...config.attributes, newAttr] });
  };
  
  const updateAttribute = (index: number, updates: Partial<AttributeDefinition>) => {
    const newAttrs = [...config.attributes];
    newAttrs[index] = { ...newAttrs[index], ...updates };
    updateConfig({ attributes: newAttrs });
  };
  
  const deleteAttribute = (index: number) => {
    updateConfig({ attributes: config.attributes.filter((_, i) => i !== index) });
  };
  
  // Skills
  const addSkill = () => {
    const newSkill: SkillDefinition = {
      id: `skill-${Date.now()}`,
      name: '',
      description: '',
      key: '',
      requirements: [],
    };
    updateConfig({ skills: [...config.skills, newSkill] });
  };
  
  const updateSkill = (index: number, updates: Partial<SkillDefinition>) => {
    const newSkills = [...config.skills];
    newSkills[index] = { ...newSkills[index], ...updates };
    updateConfig({ skills: newSkills });
  };
  
  const deleteSkill = (index: number) => {
    updateConfig({ skills: config.skills.filter((_, i) => i !== index) });
  };
  
  // Intentions
  const addIntention = () => {
    const newIntention: IntentionDefinition = {
      id: `int-${Date.now()}`,
      name: '',
      description: '',
      key: '',
      requirements: [],
    };
    updateConfig({ intentions: [...config.intentions, newIntention] });
  };
  
  const updateIntention = (index: number, updates: Partial<IntentionDefinition>) => {
    const newIntentions = [...config.intentions];
    newIntentions[index] = { ...newIntentions[index], ...updates };
    updateConfig({ intentions: newIntentions });
  };
  
  const deleteIntention = (index: number) => {
    updateConfig({ intentions: config.intentions.filter((_, i) => i !== index) });
  };
  
  // Invitations
  const addInvitation = () => {
    const newInvitation: InvitationDefinition = {
      id: `inv-${Date.now()}`,
      name: '',
      description: '',
      key: '',
      requirements: [],
    };
    updateConfig({ invitations: [...config.invitations, newInvitation] });
  };
  
  const updateInvitation = (index: number, updates: Partial<InvitationDefinition>) => {
    const newInvitations = [...config.invitations];
    newInvitations[index] = { ...newInvitations[index], ...updates };
    updateConfig({ invitations: newInvitations });
  };
  
  const deleteInvitation = (index: number) => {
    updateConfig({ invitations: config.invitations.filter((_, i) => i !== index) });
  };
  
  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span className="font-medium">Sistema de Stats</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Sistema de Stats</h4>
                  <p className="text-xs text-muted-foreground">
                    Define atributos, habilidades, intenciones e invitaciones que el personaje puede usar durante el roleplay.
                  </p>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>• <strong>Atributos:</strong> Valores que cambian (Vida, Maná, etc.)</p>
                    <p>• <strong>Habilidades:</strong> Acciones disponibles según atributos</p>
                    <p>• <strong>Intenciones:</strong> Comportamientos que puede adoptar</p>
                    <p>• <strong>Invitaciones:</strong> Formas de invitar al usuario</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
          />
        </div>
        
        {!config.enabled && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Activa el sistema de stats para configurar atributos, habilidades e intenciones.</p>
          </div>
        )}
        
        {config.enabled && (
          <Accordion type="multiple" defaultValue={['attributes']} className="space-y-2">
            {/* Attributes Section */}
            <AccordionItem value="attributes" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Atributos</span>
                    <Badge variant="secondary" className="ml-2">{config.attributes.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Atributos</h4>
                      <p className="text-xs text-muted-foreground">
                        Valores que representan el estado del personaje. Pueden cambiar durante el roleplay.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El LLM puede modificarlos automáticamente si configuras los "Tags de detección".
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {config.attributes.map((attr, index) => (
                    <AttributeEditor
                      key={attr.id}
                      attribute={attr}
                      index={index}
                      onChange={updateAttribute}
                      onDelete={deleteAttribute}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addAttribute} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Atributo
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* Skills Section */}
            <AccordionItem value="skills" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Sword className="w-4 h-4 text-amber-500" />
                    <span>Habilidades</span>
                    <Badge variant="secondary" className="ml-2">{config.skills.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Habilidades</h4>
                      <p className="text-xs text-muted-foreground">
                        Acciones especiales que el personaje puede realizar. Pueden tener requisitos basados en atributos.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solo las habilidades que cumplan los requisitos se mostrarán en el prompt.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Título que aparece antes de la lista de habilidades en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.skills}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, skills: e.target.value }
                    })}
                    placeholder="Habilidades disponibles:"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {config.skills.map((skill, index) => (
                    <SkillEditor
                      key={skill.id}
                      skill={skill}
                      index={index}
                      availableAttributes={config.attributes}
                      onChange={updateSkill}
                      onDelete={deleteSkill}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addSkill} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Habilidad
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* Intentions Section */}
            <AccordionItem value="intentions" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-500" />
                    <span>Intenciones</span>
                    <Badge variant="secondary" className="ml-2">{config.intentions.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Intenciones</h4>
                      <p className="text-xs text-muted-foreground">
                        Comportamientos o actitudes que el personaje puede adoptar según la situación.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ejemplos: "Atacar con furia", "Defender", "Seducción", "Huir"
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Título que aparece antes de la lista de intenciones en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.intentions}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, intentions: e.target.value }
                    })}
                    placeholder="Intenciones disponibles:"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {config.intentions.map((intention, index) => (
                    <SkillEditor
                      key={intention.id}
                      skill={intention as unknown as SkillDefinition}
                      index={index}
                      availableAttributes={config.attributes}
                      onChange={(i, updates) => updateIntention(i, updates as unknown as Partial<IntentionDefinition>)}
                      onDelete={deleteIntention}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addIntention} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Intención
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* Invitations Section */}
            <AccordionItem value="invitations" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <span>Invitaciones</span>
                    <Badge variant="secondary" className="ml-2">{config.invitations.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Invitaciones</h4>
                      <p className="text-xs text-muted-foreground">
                        Formas en que el personaje puede invitar al usuario a participar en la narrativa.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ejemplos: "Invitar a acercarse", "Pedir ayuda", "Ofrecer algo"
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Título que aparece antes de la lista de invitaciones en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.invitations}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, invitations: e.target.value }
                    })}
                    placeholder="Invitaciones disponibles:"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {config.invitations.map((invitation, index) => (
                    <SkillEditor
                      key={invitation.id}
                      skill={invitation as unknown as SkillDefinition}
                      index={index}
                      availableAttributes={config.attributes}
                      onChange={(i, updates) => updateInvitation(i, updates as unknown as Partial<InvitationDefinition>)}
                      onDelete={deleteInvitation}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addInvitation} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Invitación
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        
        {/* Usage Help */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-2">
          <p className="font-medium">Uso de keys en el personaje:</p>
          <div className="space-y-1 pl-2">
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{vida}}'}</code> → Muestra el valor del atributo</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{habilidades}}'}</code> → Lista de habilidades disponibles</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{intenciones}}'}</code> → Lista de intenciones disponibles</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{invitaciones}}'}</code> → Lista de invitaciones disponibles</p>
          </div>
          <p className="text-xs opacity-75 mt-2">
            Funcionan igual que <code className="bg-muted px-1 rounded">{'{{char}}'}</code> y <code className="bg-muted px-1 rounded">{'{{user}}'}</code> de SillyTavern.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default StatsEditor;
