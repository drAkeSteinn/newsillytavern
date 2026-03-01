'use client';

/**
 * HUDManager Component
 * 
 * Settings tab for managing HUD templates.
 * Allows creating, editing, duplicating, and deleting HUD templates.
 */

import { useState, useEffect } from 'react';
import { useTavernStore } from '@/store';
import type { HUDTemplate, HUDField, HUDFieldType, HUDPosition, HUDStyle, HUDFieldStyle } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  Layers,
} from 'lucide-react';

// ============================================
// Main Component
// ============================================

export function HUDManager() {
  const [editingTemplate, setEditingTemplate] = useState<HUDTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const createHUDTemplate = useTavernStore((state) => state.createHUDTemplate);
  const updateHUDTemplate = useTavernStore((state) => state.updateHUDTemplate);
  const deleteHUDTemplate = useTavernStore((state) => state.deleteHUDTemplate);
  const duplicateHUDTemplate = useTavernStore((state) => state.duplicateHUDTemplate);
  
  const handleCreate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
  };
  
  const handleEdit = (template: HUDTemplate) => {
    setIsCreating(false);
    setEditingTemplate(template);
  };
  
  const handleDuplicate = (template: HUDTemplate) => {
    duplicateHUDTemplate(template.id);
  };
  
  const handleDelete = (template: HUDTemplate) => {
    if (confirm(`¿Eliminar el template "${template.name}"?`)) {
      deleteHUDTemplate(template.id);
    }
  };
  
  const handleSave = (template: Partial<HUDTemplate>) => {
    if (isCreating) {
      createHUDTemplate({
        name: template.name || 'Nuevo HUD',
        description: template.description || '',
        fields: template.fields || [],
        position: template.position || 'top-right',
        style: template.style || 'card',
        opacity: template.opacity ?? 0.9,
        compact: template.compact ?? false,
      });
    } else if (editingTemplate) {
      updateHUDTemplate(editingTemplate.id, template);
    }
    setEditingTemplate(null);
    setIsCreating(false);
  };
  
  const handleClose = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" />
            HUD Templates
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Crea plantillas de HUD para mostrar información durante el chat
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Crear Template
        </Button>
      </div>
      
      {/* Template List */}
      {hudTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              No hay templates de HUD creados.
              <br />
              Crea uno para comenzar.
            </p>
            <Button variant="outline" className="mt-4" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Crear primer template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hudTemplates.map((template) => (
            <Card key={template.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {template.fields.length} campos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Preview of fields */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {template.fields.slice(0, 4).map((field) => (
                    <Badge key={field.id} variant="outline" className="text-xs">
                      {field.icon && <span className="mr-1">{field.icon}</span>}
                      {field.name}
                    </Badge>
                  ))}
                  {template.fields.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.fields.length - 4} más
                    </Badge>
                  )}
                </div>
                
                {/* Template info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <Badge variant="secondary" className="text-xs">
                    {template.position}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {template.style}
                  </Badge>
                  {template.compact && (
                    <Badge variant="secondary" className="text-xs">
                      compacto
                    </Badge>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(template)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Duplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Editor Dialog */}
      {(editingTemplate || isCreating) && (
        <HUDEditorDialog
          template={editingTemplate}
          isNew={isCreating}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

// ============================================
// HUD Editor Dialog
// ============================================

interface HUDEditorDialogProps {
  template: HUDTemplate | null;
  isNew: boolean;
  onSave: (template: Partial<HUDTemplate>) => void;
  onClose: () => void;
}

function HUDEditorDialog({ template, isNew, onSave, onClose }: HUDEditorDialogProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [fields, setFields] = useState<HUDField[]>(template?.fields || []);
  const [position, setPosition] = useState<HUDPosition>(template?.position || 'top-right');
  const [style, setStyle] = useState<HUDStyle>(template?.style || 'card');
  const [opacity, setOpacity] = useState(template?.opacity ?? 0.9);
  const [compact, setCompact] = useState(template?.compact ?? false);
  const [editingField, setEditingField] = useState<HUDField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  
  const handleAddField = () => {
    setEditingField(null);
    setShowFieldEditor(true);
  };
  
  const handleEditField = (field: HUDField) => {
    setEditingField(field);
    setShowFieldEditor(true);
  };
  
  const handleSaveField = (field: HUDField) => {
    if (editingField) {
      setFields(fields.map((f) => (f.id === field.id ? field : f)));
    } else {
      setFields([...fields, field]);
    }
    setShowFieldEditor(false);
    setEditingField(null);
  };
  
  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };
  
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };
  
  const handleSave = () => {
    onSave({
      name,
      description,
      fields,
      position,
      style,
      opacity,
      compact,
    });
  };
  
  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Crear Nuevo Template' : 'Editar Template'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sistema Combate RPG"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="HUD para sistema de combate..."
                />
              </div>
            </div>
            
            {/* Display Settings */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Posición</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as HUDPosition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Superior Izq.</SelectItem>
                    <SelectItem value="top-right">Superior Der.</SelectItem>
                    <SelectItem value="bottom-left">Inferior Izq.</SelectItem>
                    <SelectItem value="bottom-right">Inferior Der.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estilo</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as HUDStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="panel">Panel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Opacidad: {Math.round(opacity * 100)}%</Label>
                <Slider
                  value={[opacity]}
                  onValueChange={([v]) => setOpacity(v)}
                  min={0.3}
                  max={1}
                  step={0.05}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="compact"
                  checked={compact}
                  onCheckedChange={setCompact}
                />
                <Label htmlFor="compact">Compacto</Label>
              </div>
            </div>
            
            {/* Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Campos ({fields.length})</Label>
                <Button variant="outline" size="sm" onClick={handleAddField}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar Campo
                </Button>
              </div>
              
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  No hay campos. Agrega uno para comenzar.
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 group"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      
                      <div className="flex-1 flex items-center gap-2">
                        {field.icon && <span className="text-lg">{field.icon}</span>}
                        <span className="font-medium">{field.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {field.type}
                        </Badge>
                        {field.color && (
                          <Badge variant="outline" className="text-xs">
                            {field.color}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveField(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveField(index, 'down')}
                          disabled={index === fields.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditField(field)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {isNew ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Field Editor */}
      {showFieldEditor && (
        <HUDFieldEditorDialog
          field={editingField}
          onSave={handleSaveField}
          onClose={() => {
            setShowFieldEditor(false);
            setEditingField(null);
          }}
        />
      )}
    </>
  );
}

// ============================================
// HUD Field Editor Dialog
// ============================================

interface HUDFieldEditorDialogProps {
  field: HUDField | null;
  onSave: (field: HUDField) => void;
  onClose: () => void;
}

// Style options with descriptions
const STYLE_OPTIONS: { value: HUDFieldStyle; label: string; description: string; icon: string; bestFor: HUDFieldType[] }[] = [
  { value: 'default', label: 'Por defecto', description: 'Etiqueta y valor en línea', icon: '📝', bestFor: ['string', 'number', 'enum', 'boolean'] },
  { value: 'progress', label: 'Barra de progreso', description: 'Barra horizontal para números', icon: '📊', bestFor: ['number'] },
  { value: 'badge', label: 'Badge', description: 'Etiqueta con fondo colorido', icon: '🏷️', bestFor: ['string', 'enum', 'number'] },
  { value: 'icon', label: 'Icono', description: 'Icono grande con valor', icon: '🎯', bestFor: ['string', 'number', 'boolean'] },
  { value: 'chip', label: 'Chip', description: 'Pequeño chip compacto', icon: '🔸', bestFor: ['string', 'enum'] },
  { value: 'status', label: 'Estado', description: 'Indicador con punto de color', icon: '🟢', bestFor: ['boolean', 'enum', 'string'] },
  { value: 'gauge', label: 'Gauge circular', description: 'Medidor circular para números', icon: '⭕', bestFor: ['number'] },
  { value: 'separator', label: 'Separador', description: 'Línea divisoria', icon: '➖', bestFor: ['string'] },
  { value: 'label-only', label: 'Solo etiqueta', description: 'Muestra solo el nombre', icon: '📋', bestFor: ['string', 'enum'] },
  { value: 'pill', label: 'Píldora', description: 'Fondo redondeado completo', icon: '💊', bestFor: ['string', 'enum', 'number'] },
  { value: 'meter', label: 'Medidor vertical', description: 'Barra vertical', icon: '📈', bestFor: ['number'] },
  { value: 'dots', label: 'Puntos', description: 'Indicador de puntos (1-5)', icon: '•••', bestFor: ['number', 'boolean'] },
];

function HUDFieldEditorDialog({ field, onSave, onClose }: HUDFieldEditorDialogProps) {
  const [name, setName] = useState(field?.name || '');
  const [key, setKey] = useState(field?.key || '');
  const [type, setType] = useState<HUDFieldType>(field?.type || 'string');
  const [style, setStyle] = useState<HUDFieldStyle>(field?.style || 'default');
  const [color, setColor] = useState(field?.color || 'default');
  const [icon, setIcon] = useState(field?.icon || '');
  const [min, setMin] = useState(field?.min ?? 0);
  const [max, setMax] = useState(field?.max ?? 100);
  const [defaultValue, setDefaultValue] = useState<string | number | boolean>(
    field?.defaultValue ?? ''
  );
  const [options, setOptions] = useState(field?.options?.join(', ') || '');
  const [unit, setUnit] = useState(field?.unit || '');
  const [showLabel, setShowLabel] = useState(field?.showLabel ?? true);
  const [showValue, setShowValue] = useState(field?.showValue ?? true);
  
  // Filter styles by type
  const availableStyles = STYLE_OPTIONS.filter(s => s.bestFor.includes(type));
  
  // Get current style (reset to default if not available for current type)
  const currentStyle = availableStyles.find(s => s.value === style) ? style : 'default';
  
  const handleSave = () => {
    const newField: HUDField = {
      id: field?.id || crypto.randomUUID(),
      name: name.trim() || 'Campo',
      key: key.trim() || name.trim().toLowerCase().replace(/\s+/g, '_'),
      type,
      style,
      color: color === 'default' ? undefined : color,
      icon: icon.trim() || undefined,
      min: type === 'number' ? min : undefined,
      max: type === 'number' ? max : undefined,
      defaultValue,
      options: type === 'enum' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      unit: unit.trim() || undefined,
      showLabel,
      showValue,
    };
    
    onSave(newField);
  };
  
  // Preview field
  const previewField: HUDField = {
    id: 'preview',
    name: name || 'Campo',
    key: key || 'campo',
    type,
    style,
    color: color === 'default' ? undefined : color,
    icon: icon || undefined,
    min,
    max,
    defaultValue,
    options: type === 'enum' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
    unit,
    showLabel,
    showValue,
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {field ? 'Editar Campo' : 'Nuevo Campo'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-[1fr_200px] gap-6">
          {/* Editor */}
          <div className="space-y-4">
            {/* Name and Key */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="HP, Turno, Intensidad..."
                />
              </div>
              <div className="space-y-2">
                <Label>Key (para detectar)</Label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="hp, turno, intensidad..."
                />
                <p className="text-xs text-muted-foreground">
                  Se usa en [key=valor]
                </p>
              </div>
            </div>
            
            {/* Type */}
            <div className="space-y-2">
              <Label>Tipo de dato</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'string', label: 'Texto', icon: '📝' },
                  { value: 'number', label: 'Número', icon: '🔢' },
                  { value: 'enum', label: 'Opciones', icon: '📋' },
                  { value: 'boolean', label: 'Booleano', icon: '✓✗' },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as HUDFieldType)}
                    className={cn(
                      'p-2 rounded-lg border text-center transition-colors',
                      type === t.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <span className="block text-lg mb-1">{t.icon}</span>
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Style */}
            <div className="space-y-2">
              <Label>Estilo de visualización</Label>
              <div className="grid grid-cols-3 gap-2">
                {availableStyles.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyle(s.value)}
                    className={cn(
                      'p-2 rounded-lg border text-left transition-colors',
                      style === s.value
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{s.icon}</span>
                      <span className="text-xs font-medium">{s.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Color and Icon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { value: 'default', color: 'bg-gray-400' },
                    { value: 'red', color: 'bg-red-500' },
                    { value: 'green', color: 'bg-green-500' },
                    { value: 'blue', color: 'bg-blue-500' },
                    { value: 'yellow', color: 'bg-yellow-500' },
                    { value: 'purple', color: 'bg-purple-500' },
                    { value: 'orange', color: 'bg-orange-500' },
                    { value: 'pink', color: 'bg-pink-500' },
                    { value: 'cyan', color: 'bg-cyan-500' },
                  ].map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={cn(
                        'w-8 h-8 rounded-lg border-2 transition-transform',
                        c.color,
                        color === c.value ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      )}
                      title={c.value}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icono (emoji)</Label>
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="❤️, ⚔️, 🎲..."
                  className="h-10 text-xl text-center"
                />
              </div>
            </div>
            
            {/* Type-specific options */}
            {type === 'number' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Mínimo</Label>
                  <Input
                    type="number"
                    value={min}
                    onChange={(e) => setMin(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo</Label>
                  <Input
                    type="number"
                    value={max}
                    onChange={(e) => setMax(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="%, pts..."
                  />
                </div>
              </div>
            )}
            
            {type === 'enum' && (
              <div className="space-y-2">
                <Label>Opciones (separadas por coma)</Label>
                <Input
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="baja, media, alta, extrema"
                />
              </div>
            )}
            
            {/* Default Value */}
            <div className="space-y-2">
              <Label>Valor por defecto</Label>
              {type === 'boolean' ? (
                <Select
                  value={String(defaultValue)}
                  onValueChange={(v) => setDefaultValue(v === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">✓ Verdadero</SelectItem>
                    <SelectItem value="false">✗ Falso</SelectItem>
                  </SelectContent>
                </Select>
              ) : type === 'number' ? (
                <Input
                  type="number"
                  value={Number(defaultValue)}
                  onChange={(e) => setDefaultValue(Number(e.target.value))}
                />
              ) : type === 'enum' && options ? (
                <Select
                  value={String(defaultValue)}
                  onValueChange={setDefaultValue}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.split(',').map((o) => (
                      <SelectItem key={o.trim()} value={o.trim()}>
                        {o.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={String(defaultValue)}
                  onChange={(e) => setDefaultValue(e.target.value)}
                />
              )}
            </div>
            
            {/* Display options */}
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="showLabel"
                  checked={showLabel}
                  onCheckedChange={setShowLabel}
                />
                <Label htmlFor="showLabel">Mostrar etiqueta</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="showValue"
                  checked={showValue}
                  onCheckedChange={setShowValue}
                />
                <Label htmlFor="showValue">Mostrar valor</Label>
              </div>
            </div>
          </div>
          
          {/* Preview Panel */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Vista previa</Label>
            <div className="bg-black/80 rounded-lg p-4 min-h-[200px] backdrop-blur-sm border border-white/10">
              <HUDFieldPreview field={previewField} value={defaultValue} />
            </div>
            <p className="text-xs text-muted-foreground">
              Así se verá el campo en el HUD durante el chat.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {field ? 'Guardar' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// HUD Field Preview Component
// ============================================

interface HUDFieldPreviewProps {
  field: HUDField;
  value: string | number | boolean;
}

function HUDFieldPreview({ field, value }: HUDFieldPreviewProps) {
  const color = field.color || 'default';
  
  // Color classes
  const colorClasses: Record<string, string> = {
    red: 'text-red-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
    cyan: 'text-cyan-400',
    default: 'text-white/80',
  };
  
  const bgColorClasses: Record<string, string> = {
    red: 'bg-red-500/20 border-red-500/30',
    green: 'bg-green-500/20 border-green-500/30',
    blue: 'bg-blue-500/20 border-blue-500/30',
    yellow: 'bg-yellow-500/20 border-yellow-500/30',
    purple: 'bg-purple-500/20 border-purple-500/30',
    orange: 'bg-orange-500/20 border-orange-500/30',
    pink: 'bg-pink-500/20 border-pink-500/30',
    cyan: 'bg-cyan-500/20 border-cyan-500/30',
    default: 'bg-white/10 border-white/20',
  };
  
  const progressColorClasses: Record<string, string> = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    cyan: 'bg-cyan-500',
    default: 'bg-white/50',
  };
  
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  // Format value
  const formatValue = (): string => {
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'number') return String(value);
    return String(value);
  };
  
  // Render based on style
  switch (field.style) {
    case 'progress': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {field.icon && <span className="text-sm">{field.icon}</span>}
              {field.showLabel !== false && (
                <span className="text-xs text-white/50">{field.name}</span>
              )}
            </div>
            {field.showValue !== false && (
              <span className="text-xs font-medium text-white/80">
                {formatValue()}{field.unit && <span className="text-white/40 ml-0.5">{field.unit}</span>}
              </span>
            )}
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      );
    }
    
    case 'badge':
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-xs text-white/50">{field.name}:</span>}
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${bgColor} ${textColor}`}>
            {formatValue()}
          </span>
        </div>
      );
    
    case 'icon':
      return (
        <div className={`flex items-center gap-2 p-2 rounded-lg border ${bgColor}`}>
          {field.icon && <span className="text-2xl">{field.icon}</span>}
          <span className={`text-lg font-medium ${textColor}`}>{formatValue()}</span>
        </div>
      );
    
    case 'chip':
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-xs">{field.icon}</span>}
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${bgColor} ${textColor}`}>
            {field.showLabel !== false && <span className="mr-1 opacity-60">{field.name}:</span>}
            {formatValue()}
          </span>
        </div>
      );
    
    case 'status': {
      const statusColor = typeof value === 'boolean' 
        ? (value ? 'bg-green-500' : 'bg-red-500')
        : progressColor;
      return (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          {field.showLabel !== false && <span className="text-xs text-white/50">{field.name}:</span>}
          <span className={`text-sm font-medium ${textColor}`}>{formatValue()}</span>
        </div>
      );
    }
    
    case 'gauge': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      const circumference = 2 * Math.PI * 35;
      const offset = circumference - (percentage / 100) * circumference;
      return (
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none"
                strokeDasharray={circumference} strokeDashoffset={offset}
                className={textColor} style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{formatValue()}</span>
            </div>
          </div>
          {field.showLabel !== false && (
            <div className="flex flex-col">
              <span className="text-xs text-white/50">{field.name}</span>
              {field.unit && <span className="text-[10px] text-white/30">{field.unit}</span>}
            </div>
          )}
        </div>
      );
    }
    
    case 'separator':
      return (
        <div className="flex items-center gap-2 w-full">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.name && <span className="text-xs text-white/40">{field.name}</span>}
          <div className="flex-1 h-px bg-white/20" />
        </div>
      );
    
    case 'label-only':
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          <span className={`text-sm font-medium ${textColor}`}>{field.name}</span>
        </div>
      );
    
    case 'pill':
      return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${bgColor}`}>
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-xs text-white/60">{field.name}:</span>}
          <span className={`text-sm font-medium ${textColor}`}>{formatValue()}</span>
        </div>
      );
    
    case 'meter': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      return (
        <div className="flex items-end gap-2 h-12">
          <div className="relative w-6 h-full bg-white/10 rounded-sm overflow-hidden">
            <div className={`absolute bottom-0 w-full transition-all ${progressColor}`}
              style={{ height: `${percentage}%` }} />
          </div>
          <div className="flex flex-col justify-end">
            {field.showLabel !== false && <span className="text-[10px] text-white/50">{field.name}</span>}
            <span className={`text-xs font-bold ${textColor}`}>{formatValue()}</span>
          </div>
        </div>
      );
    }
    
    case 'dots': {
      const numDots = typeof value === 'boolean' ? (value ? 5 : 0) : Math.min(5, Math.max(0, Number(value)));
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-xs text-white/50">{field.name}:</span>}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i <= numDots ? progressColor : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      );
    }
    
    default: // 'default' style
      return (
        <div className="flex items-center gap-2">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.showLabel !== false && <span className="text-xs text-white/50 min-w-[60px]">{field.name}:</span>}
          <span className={`text-sm font-medium px-2 py-0.5 rounded border ${bgColor} ${textColor}`}>
            {formatValue()}
            {field.unit && <span className="text-white/40 ml-0.5">{field.unit}</span>}
          </span>
        </div>
      );
  }
}

export default HUDManager;
