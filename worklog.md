# Worklog - TavernFlow Quest System Refactor

---
Task ID: 1
Agent: Main
Task: FASE 1 - Actualizar tipos de QuestReward

Work Log:
- Modificado QuestRewardType de 6 tipos a 2 tipos: 'attribute' | 'trigger'
- Añadidos tipos de soporte: TriggerTargetMode, TriggerCategory, AttributeAction
- Creadas interfaces QuestRewardAttribute y QuestRewardTrigger
- Actualizada interfaz QuestReward con nueva estructura
- Mantenidos campos legacy para migración gradual (con @deprecated)
- Creado archivo /src/lib/quest/quest-reward-utils.ts con:
  - Factory functions: createAttributeReward, createTriggerReward
  - Migration functions: migrateRewardToNewFormat, migrateRewardsToNewFormat
  - Validation functions: validateReward, validateRewards
  - Utility functions: getActionSymbol, getCategoryIcon, describeReward
  - Normalization functions: normalizeReward, normalizeRewards

Stage Summary:
- Tipos actualizados correctamente en /src/types/index.ts
- Archivo de utilidades creado en /src/lib/quest/quest-reward-utils.ts
- Lint pasa sin errores
- Dev server funciona correctamente

---
Task ID: 2
Agent: Main
Task: FASE 2 - Crear UnifiedTriggerExecutor

Work Log:
- Creado archivo /src/lib/triggers/unified-trigger-executor.ts
- Implementadas funciones de ejecución de triggers:
  - executeSpriteTriggerForCharacter: Ejecuta triggers de sprite buscando en spritePacks y spriteTriggers
  - executeSoundTriggerForCharacter: Encola sonidos para reproducción
  - executeBackgroundTriggerForCharacter: Cambia fondos directamente
- Implementadas funciones principales:
  - executeTriggerForCharacter: Ejecuta trigger para un personaje específico
  - executeTriggerReward: Ejecuta trigger con soporte para targetMode (self/all/target)
  - executeTriggerRewards: Ejecuta múltiples triggers en lote
- Helper functions:
  - getTargetCharacters: Determina objetivos según targetMode
  - findSpriteMatch: Busca sprite que coincide con la key
- Actualizado /src/lib/quest/index.ts para exportar nuevas utilidades

Stage Summary:
- UnifiedTriggerExecutor creado y funcional
- Reutiliza handlers existentes (executeSpriteTrigger, executeSoundTrigger, executeBackgroundTrigger)
- Soporta targetMode para grupos
- Lint pasa sin errores

---
Task ID: planning
Agent: Main
Task: Plan de trabajo para el sistema unificado de recompensas

Work Log:
- Análisis del sistema actual de QuestReward (6 tipos: attribute, sprite, sound, background, item, custom)
- Revisión de quest-reward-executor.ts y su lógica de ejecución separada
- Revisión de UI existente en quest-template-manager.tsx
- Diseño del nuevo sistema simplificado (2 tipos: attribute, trigger)

Stage Summary:
- Se identificaron los archivos a modificar
- Se diseñó la arquitectura del nuevo sistema unificado
- Se creó el plan de trabajo con 8 fases

---

# PLAN DE TRABAJO - Sistema Unificado de Recompensas

## Resumen del Cambio

**Sistema Actual:**
- 6 tipos de recompensas: `attribute | sprite | sound | background | item | custom`
- Cada tipo tiene su propia lógica de ejecución
- Duplicación de código, no reutiliza la infraestructura de triggers

**Sistema Propuesto:**
- 2 tipos de recompensas: `attribute | trigger`
- `attribute`: Modifica stats del personaje
- `trigger`: Activa triggers existentes (sprite, sound, background)

---

## FASE 1: Actualizar Tipos

### Archivo: `/src/types/index.ts`

**Cambios:**

1. Modificar `QuestRewardType`:
```typescript
export type QuestRewardType = 'attribute' | 'trigger';
```

2. Modificar `QuestReward`:
```typescript
export interface QuestReward {
  id: string;
  type: QuestRewardType;
  
  // Para type: 'attribute'
  attribute?: {
    key: string;
    value: number | string;
    action: 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'percent';
  };
  
  // Para type: 'trigger'
  trigger?: {
    category: 'sprite' | 'sound' | 'background';
    key: string;
    targetMode: 'self' | 'all' | 'target';
  };
  
  // Condición opcional
  condition?: QuestRewardCondition;
}
```

3. Añadir tipos de soporte:
```typescript
export type TriggerTargetMode = 'self' | 'all' | 'target';

export interface QuestRewardAttribute {
  key: string;
  value: number | string;
  action: 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'percent';
}

export interface QuestRewardTrigger {
  category: 'sprite' | 'sound' | 'background';
  key: string;
  targetMode: TriggerTargetMode;
}
```

**Migración:**
- Mantener compatibilidad con el formato anterior temporalmente
- Añadir función de migración en el store

---

## FASE 2: Crear UnifiedTriggerExecutor

### Archivo: `/src/lib/triggers/unified-trigger-executor.ts` (NUEVO)

**Propósito:**
- Ejecuta triggers como recompensas
- Simula que el TokenDetector encontró un token
- Reutiliza toda la infraestructura existente

**Funciones principales:**
```typescript
export interface TriggerExecutionContext {
  sessionId: string;
  characterId: string;
  character: CharacterCard;
  allCharacters?: CharacterCard[];
  source: 'objective' | 'quest_completion';
}

export function executeTriggerReward(
  category: 'sprite' | 'sound' | 'background',
  key: string,
  context: TriggerExecutionContext,
  targetCharacterId?: string
): TriggerExecutionResult;

export function executeTriggerRewards(
  triggers: Array<{ category, key, targetMode }>,
  context: TriggerExecutionContext
): TriggerExecutionResult[];
```

**Implementación:**
1. Crear token sintético con el key del trigger
2. Crear contexto de trigger
3. Emitir evento al TriggerBus
4. Los handlers existentes procesan el trigger

---

## FASE 3: Refactorizar quest-reward-executor.ts

### Archivo: `/src/lib/quest/quest-reward-executor.ts`

**Cambios:**

1. Simplificar `executeReward`:
```typescript
export function executeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  if (reward.condition && !evaluateCondition(reward.condition, context)) {
    return { ...success: false, message: 'Condition not met' };
  }
  
  switch (reward.type) {
    case 'attribute':
      return executeAttributeReward(reward, context, storeActions);
    case 'trigger':
      return executeTriggerRewardFromQuest(reward, context);
    default:
      return { ...success: false, error: 'Unknown reward type' };
  }
}
```

2. Eliminar funciones específicas:
- ~~executeSpriteReward~~
- ~~executeSoundReward~~
- ~~executeBackgroundReward~~
- ~~executeItemReward~~
- ~~executeCustomReward~~

3. Crear nueva función:
```typescript
function executeTriggerRewardFromQuest(
  reward: QuestReward,
  context: RewardExecutionContext
): RewardExecutionResult {
  const trig = reward.trigger;
  if (!trig) return { ...success: false };
  
  // Determinar objetivos según targetMode
  const targets = getTargetCharacters(trig.targetMode, context);
  
  // Ejecutar trigger para cada objetivo
  for (const target of targets) {
    executeTriggerReward(trig.category, trig.key, {
      ...context,
      character: target,
    });
  }
}
```

---

## FASE 4: Actualizar quest-template-manager.tsx

### Archivo: `/src/components/settings/quest-template-manager.tsx`

**Cambios en la sección de Rewards:**

1. Modificar `addReward`:
```typescript
const addReward = () => {
  const newReward: QuestReward = {
    id: `reward-${Date.now().toString(36)}`,
    type: 'attribute',  // Default
    attribute: {
      key: '',
      value: 0,
      action: 'add',
    },
  };
  setRewards([...rewards, newReward]);
};
```

2. Modificar el formulario de recompensa:
```tsx
{/* Tipo selector */}
<Select value={reward.type} onValueChange={(v) => updateReward(index, { type: v })}>
  <SelectItem value="attribute">📊 Atributo</SelectItem>
  <SelectItem value="trigger">⚡ Trigger</SelectItem>
</Select>

{/* Atributo config */}
{reward.type === 'attribute' && (
  <div className="grid grid-cols-3 gap-2">
    <Input placeholder="Key" value={reward.attribute?.key} 
      onChange={(e) => updateReward(index, { 
        attribute: { ...reward.attribute, key: e.target.value } 
      })} />
    <Select value={reward.attribute?.action}>
      <SelectItem value="set">=</SelectItem>
      <SelectItem value="add">+</SelectItem>
      <SelectItem value="subtract">-</SelectItem>
    </Select>
    <Input type="number" value={reward.attribute?.value} />
  </div>
)}

{/* Trigger config */}
{reward.type === 'trigger' && (
  <div className="grid grid-cols-3 gap-2">
    <Select value={reward.trigger?.category}>
      <SelectItem value="sprite">🖼️ Sprite</SelectItem>
      <SelectItem value="sound">🔊 Sonido</SelectItem>
      <SelectItem value="background">🖼️ Fondo</SelectItem>
    </Select>
    <Input placeholder="Key del trigger" value={reward.trigger?.key} />
    <Select value={reward.trigger?.targetMode}>
      <SelectItem value="self">Mismo</SelectItem>
      <SelectItem value="all">Todos</SelectItem>
    </Select>
  </div>
)}
```

---

## FASE 5: Crear componente RewardEditor

### Archivo: `/src/components/quests/reward-editor.tsx` (NUEVO)

**Propósito:**
- Componente reutilizable para editar recompensas
- Usado en objetivos y en misión completa

**Props:**
```typescript
interface RewardEditorProps {
  reward: QuestReward;
  onChange: (reward: QuestReward) => void;
  onDelete: () => void;
  availableAttributes?: string[];  // Lista de atributos del personaje
  availableTriggers?: {
    sprites: string[];
    sounds: string[];
    backgrounds: string[];
  };
  isGroupChat?: boolean;  // Para mostrar opciones de targetMode
}
```

**Estructura:**
```tsx
<div className="reward-item">
  {/* Tipo selector */}
  <Select type>
    <option value="attribute">📊 Atributo</option>
    <option value="trigger">⚡ Trigger</option>
  </Select>
  
  {/* Config específica */}
  {type === 'attribute' && <AttributeConfig />}
  {type === 'trigger' && <TriggerConfig />}
  
  {/* Condición opcional */}
  <ConditionConfig />
  
  {/* Delete button */}
  <Button variant="ghost" onClick={onDelete}>
    <Trash2 />
  </Button>
</div>
```

---

## FASE 6: Actualizar quest-instance-editor.tsx

### Archivo: `/src/components/quests/quest-instance-editor.tsx`

**Cambios:**

1. Actualizar visualización de recompensas:
```tsx
{quest.rewards.map((reward, index) => (
  <Badge key={index}>
    {reward.type === 'attribute' && (
      <>📊 {reward.attribute?.key} {getActionSymbol(reward.attribute?.action)} {reward.attribute?.value}</>
    )}
    {reward.type === 'trigger' && (
      <>⚡ {reward.trigger?.category}: {reward.trigger?.key}</>
    )}
  </Badge>
))}
```

2. Añadir indicador de recompensas ejecutadas:
- Mostrar si ya fueron aplicadas
- Mostrar a quién se aplicaron (en grupo)

---

## FASE 7: Actualizar quest-handler.ts

### Archivo: `/src/lib/triggers/handlers/quest-handler.ts`

**Cambios:**

1. Integrar el nuevo sistema de recompensas:
```typescript
// Cuando se detecta completado de objetivo
if (hit.action === 'progress' && hit.completesObjective) {
  // Ejecutar recompensas del objetivo
  const objectiveRewards = hit.objectiveRewards;
  if (objectiveRewards) {
    executeAllRewards(objectiveRewards, context, storeActions);
  }
}

// Cuando se detecta completado de misión
if (hit.action === 'complete') {
  const questRewards = hit.rewards;
  if (questRewards) {
    executeAllRewards(questRewards, context, storeActions);
  }
}
```

---

## FASE 8: Pruebas y Documentación

### Pruebas a realizar:

1. **Chat Simple:**
   - [ ] Crear misión con recompensa de atributo
   - [ ] Crear misión con recompensa de trigger (sprite)
   - [ ] Crear misión con recompensa de trigger (sound)
   - [ ] Verificar ejecución al completar objetivo
   - [ ] Verificar ejecución al completar misión

2. **Chat Grupal:**
   - [ ] Verificar targetMode: self
   - [ ] Verificar targetMode: all
   - [ ] Verificar que cada personaje recibe sus recompensas

3. **UI:**
   - [ ] Crear recompensa en template
   - [ ] Editar recompensa existente
   - [ ] Eliminar recompensa
   - [ ] Visualizar recompensas en instancia

---

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `/src/lib/triggers/unified-trigger-executor.ts` | Ejecutor de triggers como recompensas |
| `/src/components/quests/reward-editor.tsx` | Componente reutilizable para editar recompensas |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `/src/types/index.ts` | Nuevos tipos QuestReward simplificados |
| `/src/lib/quest/quest-reward-executor.ts` | Refactor para usar 2 tipos |
| `/src/components/settings/quest-template-manager.tsx` | Nueva UI de recompensas |
| `/src/components/quests/quest-instance-editor.tsx` | Visualización actualizada |
| `/src/lib/triggers/handlers/quest-handler.ts` | Integración con nuevo sistema |

---

## Estimación de Tiempo

| Fase | Tiempo Estimado |
|------|-----------------|
| Fase 1: Tipos | 30 min |
| Fase 2: UnifiedTriggerExecutor | 1 hora |
| Fase 3: Refactor reward-executor | 1 hora |
| Fase 4: UI template-manager | 1.5 horas |
| Fase 5: Componente RewardEditor | 1 hora |
| Fase 6: UI instance-editor | 30 min |
| Fase 7: Integración quest-handler | 30 min |
| Fase 8: Pruebas | 1 hora |
| **TOTAL** | **7-8 horas** |

---

## Orden de Implementación Recomendado

1. **Primero el backend:** Fases 1-3 (Tipos → Executor → Refactor)
2. **Luego el frontend:** Fases 4-6 (UI)
3. **Finalmente integración:** Fases 7-8 (Handler → Pruebas)

Esto permite probar el sistema gradualmente y tener un backend funcional antes de tocar la UI.
