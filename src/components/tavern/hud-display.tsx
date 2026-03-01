'use client';

/**
 * HUDDisplay Component
 * 
 * Displays a HUD (Heads-Up Display) overlay in the chat interface.
 * Shows field values from the active HUD template.
 * 
 * Features:
 * - Multiple display styles (default, progress, badge, icon, chip, status, gauge, etc.)
 * - Positionable (top-left, top-right, bottom-left, bottom-right)
 * - Real-time updates from trigger detection
 * - Progress bars for gauges for numeric fields
 * - Color-coded badges for enum fields
 */

import { useTavernStore } from '@/store';
import type { HUDTemplate, HUDField, HUDPosition, HUDStyle, HUDFieldStyle } from '@/types';
import { cn } from '@/lib/utils';

interface HUDDisplayProps {
  position?: HUDPosition;
  className?: string;
}

// Position classes
const positionClasses: Record<HUDPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

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

export function HUDDisplay({ position = 'top-right', className }: HUDDisplayProps) {
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const hudSessionState = useTavernStore((state) => state.hudSessionState);
  
  // Get active template
  const activeTemplate = hudTemplates.find(
    (t) => t.id === hudSessionState.activeTemplateId
  );
  
  // No active HUD
  if (!activeTemplate || activeTemplate.fields.length === 0) {
    return null;
  }
  
  return (
    <div
      className={cn(
        'absolute z-30 pointer-events-none',
        positionClasses[position],
        className
      )}
      style={{ opacity: activeTemplate.opacity }}
    >
      <HUDContainer template={activeTemplate} values={hudSessionState.fieldValues} />
    </div>
  );
}

// ============================================
// HUD Container
// ============================================

interface HUDContainerProps {
  template: HUDTemplate;
  values: Record<string, string | number | boolean>;
}

function HUDContainer({ template, values }: HUDContainerProps) {
  const style = template.style;
  const compact = template.compact;
  
  const containerClass = cn(
    'pointer-events-auto backdrop-blur-sm rounded-lg border transition-all',
    style === 'minimal' && 'bg-black/30 border-white/10 p-2',
    style === 'card' && 'bg-black/50 border-white/20 p-3 shadow-lg',
    style === 'panel' && 'bg-black/60 border-white/25 p-4 shadow-xl',
    compact && 'p-1.5 gap-1',
    !compact && 'gap-2'
  );
  
  return (
    <div className={containerClass}>
      {/* Header */}
      {style !== 'minimal' && !compact && (
        <div className="text-xs font-medium text-white/60 mb-2 pb-1 border-b border-white/10">
          {template.name}
        </div>
      )}
      
      {/* Fields */}
      <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-2')}>
        {template.fields.map((field) => (
          <HUDFieldDisplay
            key={field.id}
            field={field}
            value={values[field.id] ?? field.defaultValue}
            compact={compact}
            style={style}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Individual Field Display
// ============================================

interface HUDFieldDisplayProps {
  field: HUDField;
  value: string | number | boolean;
  compact?: boolean;
  style: HUDStyle;
}

function HUDFieldDisplay({ field, value, compact, style }: HUDFieldDisplayProps) {
  const fieldStyle = field.style || 'default';
  const color = field.color || 'default';
  
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
  switch (fieldStyle) {
    case 'progress':
      return (
        <ProgressField field={field} value={Number(value)} color={color} compact={compact} />
      );
    
    case 'badge':
      return (
        <BadgeField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'icon':
      return (
        <IconField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'chip':
      return (
        <ChipField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'status':
      return (
        <StatusField field={field} value={value} color={color} compact={compact} />
      );
    
    case 'gauge':
      return (
        <GaugeField field={field} value={Number(value)} color={color} compact={compact} />
      );
    
    case 'separator':
      return (
        <SeparatorField field={field} compact={compact} />
      );
    
    case 'label-only':
      return (
        <LabelOnlyField field={field} color={color} compact={compact} />
      );
    
    case 'pill':
      return (
        <PillField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'meter':
      return (
        <MeterField field={field} value={Number(value)} color={color} compact={compact} />
      );
    
    case 'dots':
      return (
        <DotsField field={field} value={value} color={color} compact={compact} />
      );
    
    default:
      return (
        <DefaultField field={field} value={value} color={color} compact={compact} style={style} />
      );
  }
}

// ============================================
// Field Style Components
// ============================================

interface FieldProps {
  field: HUDField;
  value: string | number | boolean;
  color: string;
  compact?: boolean;
}

function DefaultField({ field, value, color, compact, style }: FieldProps & { style: HUDStyle }) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  const displayValue = typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value);
  
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      {field.icon && (
        <span className="text-sm" title={field.name}>
          {field.icon}
        </span>
      )}
      {field.showLabel !== false && !compact && (
        <span className="text-xs text-white/50 min-w-[60px]">
          {field.name}:
        </span>
      )}
      <span
        className={cn(
          'text-sm font-medium px-2 py-0.5 rounded border',
          bgColor,
          textColor,
          compact && 'text-xs px-1.5'
        )}
      >
        {displayValue}
        {field.unit && <span className="text-white/40 ml-0.5">{field.unit}</span>}
      </span>
    </div>
  );
}

function ProgressField({ field, value, color, compact }: FieldProps) {
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
  
  return (
    <div className={cn('flex flex-col gap-1', compact && 'gap-0.5')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {field.icon && <span className="text-sm">{field.icon}</span>}
          {field.showLabel !== false && (
            <span className="text-xs text-white/50">{field.name}</span>
          )}
        </div>
        {field.showValue !== false && (
          <span className="text-xs font-medium text-white/80">
            {value}
            {field.unit && <span className="text-white/40 ml-0.5">{field.unit}</span>}
          </span>
        )}
      </div>
      <div
        className={cn(
          'w-full bg-white/10 rounded-full overflow-hidden',
          compact ? 'h-1.5' : 'h-2'
        )}
        style={{ minWidth: compact ? 60 : 100 }}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            progressColor
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function BadgeField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      {field.icon && (
        <span className="text-sm" title={field.name}>
          {field.icon}
        </span>
      )}
      {field.showLabel !== false && !compact && (
        <span className="text-xs text-white/50">{field.name}:</span>
      )}
      <span
        className={cn(
          'inline-flex items-center rounded-full border font-medium',
          compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
          bgColor,
          textColor
        )}
      >
        {value}
      </span>
    </div>
  );
}

function IconField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border',
        compact ? 'p-1' : 'p-2',
        bgColor
      )}
      title={`${field.name}: ${value}`}
    >
      {field.icon && (
        <span className={cn(compact ? 'text-base' : 'text-lg')}>
          {field.icon}
        </span>
      )}
      {!compact && (
        <span className={cn('text-sm font-medium', textColor)}>
          {value}
        </span>
      )}
    </div>
  );
}

function ChipField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div className="flex items-center gap-1.5">
      {field.icon && <span className={cn('text-xs', compact && 'text-[10px]')}>{field.icon}</span>}
      <span
        className={cn(
          'inline-flex items-center rounded border font-medium',
          compact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          bgColor,
          textColor
        )}
      >
        {field.showLabel !== false && <span className="mr-1 opacity-60">{field.name}:</span>}
        {value}
      </span>
    </div>
  );
}

function StatusField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  const statusColor = typeof value === 'boolean' 
    ? (value ? 'bg-green-500' : 'bg-red-500')
    : progressColor;
  
  const displayValue = typeof value === 'boolean' ? (value ? 'Activo' : 'Inactivo') : String(value);
  
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      <div className={cn('w-2 h-2 rounded-full', statusColor, 'animate-pulse')} />
      {field.showLabel !== false && (
        <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>{field.name}:</span>
      )}
      <span className={cn('text-sm font-medium', textColor, compact && 'text-xs')}>
        {displayValue}
      </span>
    </div>
  );
}

function GaugeField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      <div className={cn('relative', compact ? 'w-10 h-10' : 'w-12 h-12')}>
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="rgba(255,255,255,0.1)" strokeWidth="10%" fill="none" />
          <circle 
            cx="50%" 
            cy="50%" 
            r="40%" 
            stroke="currentColor" 
            strokeWidth="10%" 
            fill="none"
            strokeDasharray={circumference} 
            strokeDashoffset={offset}
            className={textColor} 
            style={{ transition: 'stroke-dashoffset 0.5s' }} 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold text-white', compact ? 'text-[10px]' : 'text-xs')}>
            {value}
          </span>
        </div>
      </div>
      {field.showLabel !== false && (
        <div className="flex flex-col">
          <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>{field.name}</span>
          {field.unit && <span className="text-[10px] text-white/30">{field.unit}</span>}
        </div>
      )}
    </div>
  );
}

function SeparatorField({ field, compact }: Omit<FieldProps, 'value' | 'color'>) {
  return (
    <div className="flex items-center gap-2 w-full">
      {field.icon && <span className="text-sm">{field.icon}</span>}
      {field.name && <span className="text-xs text-white/40">{field.name}</span>}
      <div className="flex-1 h-px bg-white/20" />
    </div>
  );
}

function LabelOnlyField({ field, color, compact }: Omit<FieldProps, 'value'>) {
  const textColor = colorClasses[color] || colorClasses.default;
  
  return (
    <div className="flex items-center gap-2">
      {field.icon && <span className="text-sm">{field.icon}</span>}
      <span className={cn('text-sm font-medium', textColor, compact && 'text-xs')}>
        {field.name}
      </span>
    </div>
  );
}

function PillField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div className={cn('flex items-center gap-2 rounded-full', compact ? 'px-3 py-1' : 'px-4 py-2', bgColor)}>
      {field.icon && <span className="text-sm">{field.icon}</span>}
      {field.showLabel !== false && (
        <span className={cn('text-xs text-white/60', compact && 'text-[10px]')}>{field.name}:</span>
      )}
      <span className={cn('text-sm font-medium', textColor, compact && 'text-xs')}>
        {value}
      </span>
    </div>
  );
}

function MeterField({ field, value, color, compact }: FieldProps) {
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
  
  return (
    <div className={cn('flex items-end gap-2', compact ? 'h-8' : 'h-12')}>
      <div className={cn('relative bg-white/10 rounded-sm overflow-hidden', compact ? 'w-4 h-full' : 'w-6 h-full')}>
        <div 
          className={cn('absolute bottom-0 w-full transition-all', progressColor)}
          style={{ height: `${percentage}%` }} 
        />
      </div>
      <div className="flex flex-col justify-end">
        {field.showLabel !== false && (
          <span className={cn('text-white/50', compact ? 'text-[8px]' : 'text-[10px]')}>{field.name}</span>
        )}
        <span className={cn('font-bold', compact ? 'text-[10px]' : 'text-xs', progressColorClasses[color] || 'text-white/80')}>
          {value}
        </span>
      </div>
    </div>
  );
}

function DotsField({ field, value, color, compact }: FieldProps) {
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  const numDots = typeof value === 'boolean' 
    ? (value ? 5 : 0) 
    : Math.min(5, Math.max(0, Number(value)));
  
  return (
    <div className="flex items-center gap-2">
      {field.icon && <span className="text-sm">{field.icon}</span>}
      {field.showLabel !== false && (
        <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>{field.name}:</span>
      )}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className={cn(
              'rounded-full',
              compact ? 'w-1.5 h-1.5' : 'w-2 h-2',
              i <= numDots ? progressColor : 'bg-white/20'
            )} 
          />
        ))}
      </div>
    </div>
  );
}

export default HUDDisplay;
