# TavernFlow - Quest System Analysis Report

---
Task ID: 1
Agent: Code Assistant
Task: Deep review of the Quest System

## Work Log:
- Analyzed quest system types and interfaces
- Reviewed quest-detector.ts for activation/detection logic
- Reviewed quest-handler.ts for trigger handling
- Reviewed quest-reward-executor.ts for reward execution
- Checked integration with sprites/sounds/attributes/HUD
- Verified quest loading on chat creation/reset

---

# ANÁLISIS PROFUNDO DEL SISTEMA DE MISIONES

## 1. ARQUITECTURA GENERAL

### 1.1 Componentes Principales

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUEST SYSTEM ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │ QuestTemplate     │     │ SessionQuestInstance              │
│  │ (JSON archivo)    │────▶│ (En sesión JSON)                 │
│  │ - Blueprint       │     │ - Estado actual                   │
│  │ - Configuración   │     │ - Progreso                        │
│  └──────────────────┘     └──────────────────┘                  │
│           │                        │                             │
│           ▼                        ▼                             │
│  ┌──────────────────────────────────────────────────┐           │
│  │              Quest Template Slice                 │           │
│  │  - loadTemplates()                                │           │
│  │  - createQuestInstance()                          │           │
│  └──────────────────────────────────────────────────┘           │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────┐           │
│  │              Session Slice                        │           │
│  │  - initializeSessionQuests()                      │           │
│  │  - activateQuest()                                │           │
│  │  - progressQuestObjective()                       │           │
│  │  - completeQuest()                                │           │
│  └──────────────────────────────────────────────────┘           │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────┐           │
│  │           Post-LLM Detection Flow                 │           │
│  │  1. quest-detector.ts - detecta keywords          │           │
│  │  2. quest-handler.ts - procesa triggers           │           │
│  │  3. use-trigger-system.ts - ejecuta acciones      │           │
│  │  4. quest-reward-executor.ts - aplica rewards     │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Flujo de Datos

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Character/  │    │  Session    │    │   Quest     │
│ Group Card  │───▶│  Creation   │───▶│  Instance   │
│ questIds    │    │             │    │  (available)│
└─────────────┘    └─────────────┘    └─────────────┘
                                             │
                                             ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Rewards    │◀───│  Complete   │◀───│  Activate   │
│  Execute    │    │  Quest      │    │  (keyword)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## 2. ANÁLISIS DE COMPONENTES

### 2.1 Tipos (types/index.ts) ✅ CORRECTO

**Fortalezas:**
- Sistema de tipos bien definido con `QuestTemplate` y `SessionQuestInstance`
- Nuevo sistema de detección de valores (`QuestValueCondition`) implementado
- Soporte para múltiples tipos de rewards (attribute, sprite, sound, background, item, custom)
- Operadores de comparación numéricos y de texto implementados

**Estructura correcta:**
```typescript
QuestTemplate (blueprint)
├── id, name, description
├── activation: QuestActivationConfig
│   ├── key, keys[], caseSensitive
│   ├── method: 'keyword' | 'turn' | 'manual' | 'chain'
│   └── turnInterval (para method: 'turn')
├── objectives: QuestObjectiveTemplate[]
│   ├── id, description, type
│   ├── completion: { key, keys[], caseSensitive, valueCondition }
│   └── targetCount, isOptional
├── completion: QuestCompletionConfig
├── chain: QuestChainConfig
└── rewards: QuestReward[]

SessionQuestInstance (runtime)
├── templateId
├── status: 'locked' | 'available' | 'active' | 'completed' | 'failed'
├── objectives: SessionQuestObjective[]
├── progress, activatedAt, completedAt, activatedAtTurn
└── completedBy
```

### 2.2 Quest Detector (quest-detector.ts) ✅ CORRECTO

**Funciones principales:**
- `detectQuestActivations()` - Detecta keywords de activación
- `detectObjectiveProgress()` - Detecta progreso en objetivos
- `detectQuestCompletions()` - Detecta completado de quests
- `checkValueCondition()` - Nuevo: detecta valores después de keys

**Detección de valores implementada:**
```typescript
// Formatos soportados:
// "key: valor", "key=valor", "key valor"
extractValueAfterKey(text, key, caseSensitive)

// Operadores numéricos: >, <, >=, <=, ==, !=
compareNumberValue(actual, target, operator)

// Operadores de texto: equals, contains, startsWith, endsWith, notEquals
compareTextValue(actual, target, operator, caseSensitive)
```

**Clase QuestDetectionState:**
- Maneja estado de detección durante streaming
- Evita duplicados con Set de posiciones procesadas
- Resetea correctamente entre mensajes

### 2.3 Quest Handler (quest-handler.ts) ✅ CORRECTO

**Integración con trigger system:**
- Recibe tokens del token-detector
- Procesa tanto tags legacy como detección por keys
- Emite QuestTriggerHit para el trigger system

**Funciones de prompt:**
- `buildQuestPromptSection()` - Construye sección de misiones activas
- `buildQuestKeysPrompt()` - Lista de keys para que la IA use

### 2.4 Quest Reward Executor (quest-reward-executor.ts) ✅ CORRECTO

**Tipos de rewards soportados:**

| Tipo | Función | Integración |
|------|---------|-------------|
| attribute | `executeAttributeReward()` | ✅ Stats system |
| sprite | `executeSpriteReward()` | ✅ Sprite triggers/packs |
| sound | `executeSoundReward()` | ✅ Sound collections |
| background | `executeBackgroundReward()` | ✅ Background system |
| item | `executeItemReward()` | ⚠️ Placeholder (no implementado) |
| custom | `executeCustomReward()` | ✅ Extensible |

**Sprite reward search flow:**
1. Si value es URL → usar directamente
2. Si value es label → buscar en spritePacks por keyword
3. Si no hay value → buscar en spriteTriggers por key
4. Soporta returnToIdleMs para volver a idle

### 2.5 Session Slice (sessionSlice.ts) ✅ CORRECTO

**Funciones de quest instances:**

```typescript
// Creación de instancia
createQuestInstancesFromTemplates(templates): SessionQuestInstance[]
  // Crea con status='available' ✓
  // Inicializa objetivos con currentCount=0 ✓

// Activación
activateQuest(sessionId, templateId)
  // Cambia status de 'available' a 'active' ✓
  // Registra activatedAt y activatedAtTurn ✓

// Progreso
progressQuestObjective(sessionId, questId, objectiveId, amount)
  // Incrementa currentCount ✓
  // Marca isCompleted si llega a targetCount ✓
  // Auto-completa quest si todos los objetivos están listos ✓

// Completado
completeQuest(sessionId, templateId, characterId)
  // Marca status='completed' ✓
  // Registra completedAt y completedBy ✓

// Reset (clearChat)
clearChat(sessionId)
  // Resetea sessionQuests usando createQuestInstancesFromTemplates ✓
  // Resetea turnCount a 0 ✓
```

---

## 3. INTEGRACIÓN CON OTROS SISTEMAS

### 3.1 Stats/Attributes ✅ INTEGRADO

**Flujo:**
```
LLM Response → stats-handler.ts → detectStatsUpdates
            → store.updateCharacterStat()
            → sessionStats.characterStats[characterId].attributeValues
            
Quest Reward → quest-reward-executor.ts → executeAttributeReward
            → storeActions.updateCharacterStat()
            → Actualiza mismo attributeValues
```

**Correctamente integrado:**
- Stats handler actualiza valores en tiempo real
- Quest rewards pueden modificar los mismos atributos
- Ambos usan el mismo store action

### 3.2 Sprites ✅ INTEGRADO

**Flujo de reward:**
```
Quest Reward (type: 'sprite', key: 'feliz')
      │
      ▼
executeSpriteReward() busca en:
      │
      ├─▶ character.spritePacks[].keywords
      │       └─▶ pack.items[].spriteUrl
      │
      └─▶ character.spriteTriggers[].keywords
              └─▶ trigger.spriteUrl
      │
      ▼
store.applyTriggerForCharacter(characterId, spriteUrl, returnToIdleMs)
```

### 3.3 Sounds ✅ INTEGRADO

```typescript
// Quest reward ejecuta:
executeSoundReward(reward, context, storeActions)
  // key = collection name
  // value = filename
  storeActions.playSound(collection, filename, volume)
```

### 3.4 Backgrounds ✅ INTEGRADO

```typescript
executeBackgroundReward(reward, context, storeActions)
  // value = background URL
  storeActions.setBackground(backgroundUrl)
```

### 3.5 HUD ⚠️ INTEGRACIÓN PARCIAL

**Estado actual:**
- HUD muestra valores de stats
- Quest rewards pueden modificar stats (que se reflejan en HUD)
- NO existe integración directa para mostrar quests activas en HUD

**Recomendación:**
- Crear componente QuestHUD separado
- O añadir soporte de quests al HUDTemplate

### 3.6 Prompt Builder ✅ INTEGRADO

```typescript
// prompt-builder.ts
buildQuestPromptForLLM(templates, sessionQuests, options, keyContext)
  // Construye sección con misiones activas
  // Incluye objetivos y progreso
  // Muestra keys disponibles para la IA
```

---

## 4. VERIFICACIÓN DE CARGA EN CHAT CREATION/RESET

### 4.1 Creación de Chat (createSession)

```typescript
// sessionSlice.ts líneas 158-236
createSession: (characterId, groupId) => {
  // ...
  
  // Initialize session quests
  let sessionQuests: SessionQuestInstance[] = [];
  
  if (groupId) {
    // Group chat: ONLY use group's quest templates
    const group = get().getGroupById?.(groupId);
    if (group?.questTemplateIds && group.questTemplateIds.length > 0) {
      const templates = get().getTemplatesByIds?.(group.questTemplateIds) || [];
      if (templates.length > 0) {
        sessionQuests = createQuestInstancesFromTemplates(templates);
        // ✅ Status = 'available'
      }
    }
  } else if (character) {
    // Single character chat
    if (character.questTemplateIds && character.questTemplateIds.length > 0) {
      const templates = get().getTemplatesByIds?.(character.questTemplateIds) || [];
      if (templates.length > 0) {
        sessionQuests = createQuestInstancesFromTemplates(templates);
        // ✅ Status = 'available'
      }
    }
  }
  
  // ✅ sessionQuests incluido en la nueva sesión
}
```

**✅ VERIFICADO:** Las misiones se cargan con status='available' al crear sesión.

### 4.2 Reset de Chat (clearChat)

```typescript
// sessionSlice.ts líneas 295-374
clearChat: (sessionId) => {
  // ...
  
  // Reset session quests to template defaults
  let newSessionQuests: SessionQuestInstance[] = [];
  
  if (session.groupId) {
    const group = get().getGroupById?.(session.groupId);
    if (group?.questTemplateIds && group.questTemplateIds.length > 0) {
      const templates = get().getTemplatesByIds?.(group.questTemplateIds) || [];
      if (templates.length > 0) {
        newSessionQuests = createQuestInstancesFromTemplates(templates);
        // ✅ Reinicia con status='available'
      }
    }
  } else if (character?.questTemplateIds && character.questTemplateIds.length > 0) {
    const templates = get().getTemplatesByIds?.(character.questTemplateIds) || [];
    if (templates.length > 0) {
      newSessionQuests = createQuestInstancesFromTemplates(templates);
      // ✅ Reinicia con status='available'
    }
  }
  
  // ✅ turnCount resetado a 0
  // ✅ sessionQuests actualizado
}
```

**✅ VERIFICADO:** Las misiones se reinician correctamente al hacer clearChat.

---

## 5. ERRORES Y PROBLEMAS DETECTADOS

### 5.1 ⚠️ PROBLEMA: buildQuestPromptSection tiene parámetro incorrecto

**Ubicación:** `quest-handler.ts` línea 330

```typescript
// FIRMA ACTUAL (incorrecta):
export function buildQuestPromptSection(
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  templateStr: string  // ❌ Se usa como string de reemplazo
): string {

// PROBLEMA: La función espera templateStr con {{activeQuests}}
// Pero se llama desde prompt-builder.ts con opciones diferentes
```

**En prompt-builder.ts línea 1019:**
```typescript
const questSection = buildQuestPromptSection(
  templates,
  activeQuests,  // ❌ Pasa SessionQuestInstance[] en lugar de sessionQuests
  {
    enabled: options.questInclude ?? true,
    promptTemplate: options.questTemplate,
    showKeys: options.showKeys ?? true,
    showProgress: options.showProgress ?? true,
  },
  keyContext
);
```

**Hay inconsistencia entre la firma y el uso.**

### 5.2 ⚠️ PROBLEMA: Quest chains no se ejecutan automáticamente

**Ubicación:** `use-trigger-system.ts`

```typescript
case 'complete':
  if (hit.questId) {
    store.completeQuest(sessionId, hit.questId, character?.id);
    
    // ❌ FALTA: Verificar chain.autoStart
    // ❌ FALTA: Activar siguiente quest en cadena
  }
  break;
```

**Funciones existentes no utilizadas:**
- `getNextQuestInChain()` en quest-detector.ts
- `shouldAutoStartChain()` en quest-detector.ts

### 5.3 ⚠️ PROBLEMA: Detección de completado no usa valueCondition

**Ubicación:** `quest-detector.ts` línea 524

```typescript
export function detectQuestCompletions(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[]
): QuestCompletionDetection[] {
  // ...
  
  // ❌ NO usa checkValueCondition para el completion
  const match = findKeyMatch(
    text,
    keys,
    template.completion.caseSensitive
  );
  
  // Debería usar:
  // checkValueCondition(text, key, caseSensitive, template.completion.valueCondition)
}
```

### 5.4 ⚠️ PROBLEMA: Item rewards no implementados

**Ubicación:** `quest-reward-executor.ts` línea 488

```typescript
export function executeItemReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  return {
    rewardId: reward.id,
    type: 'item',
    key: reward.key,
    value: reward.value,
    success: false,
    error: 'Item rewards not yet implemented',  // ❌
  };
}
```

### 5.5 ⚠️ PROBLEMA MENOR: Falta validación de objetivos isOptional

**Ubicación:** `sessionSlice.ts` línea 651

```typescript
const allCompleted = updatedObjectives.every(o => o.isCompleted);

// ❌ Esto incluye objetivos opcionales
// Debería ser:
const allCompleted = updatedObjectives
  .filter(o => !o.isOptional)
  .every(o => o.isCompleted);
```

**Corregido parcialmente en calculateQuestProgress:**
```typescript
function calculateQuestProgress(objectives) {
  const requiredObjectives = objectives.filter(o => !o.isOptional);
  // ✅ Correcto
}
```

### 5.6 ✅ CORREGIDO: Prerrequisitos no verificados

**Ubicación:** Al activar quests, no se verifican los prerrequisitos.

```typescript
// Falta verificación en activateQuest:
if (template.prerequisites?.length > 0) {
  const completedIds = sessionQuests
    .filter(q => q.status === 'completed')
    .map(q => q.templateId);
  
  const hasAllPrereqs = template.prerequisites.every(p => completedIds.includes(p));
  if (!hasAllPrereqs) {
    // No debería activar
  }
}
```

---

## 6. SUGERENCIAS DE MEJORA

### 6.1 Mejora: Implementar Quest Chains

```typescript
// En use-trigger-system.ts, caso 'complete':
case 'complete':
  if (hit.questId && hit.template) {
    store.completeQuest(sessionId, hit.questId, character?.id);
    
    // NUEVO: Verificar chain
    if (hit.template.chain && shouldAutoStartChain(hit.template.chain)) {
      const nextQuest = getNextQuestInChain(hit.template, store.questTemplates);
      if (nextQuest) {
        // Crear instancia si no existe y activar
        store.activateQuestFromTemplate(sessionId, nextQuest);
      }
    }
  }
  break;
```

### 6.2 Mejora: Implementar valueCondition en completado

```typescript
export function detectQuestCompletions(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[]
): QuestCompletionDetection[] {
  // ...
  
  const valueCondition = template.completion.valueCondition;
  
  if (valueCondition && valueCondition.valueType !== 'presence') {
    const result = checkValueCondition(
      text,
      template.completion.key,
      template.completion.caseSensitive,
      valueCondition
    );
    
    if (result.matched) {
      detections.push({ ... });
    }
  } else {
    // Legacy presence detection
    const match = findKeyMatch(text, keys, template.completion.caseSensitive);
    if (match) {
      detections.push({ ... });
    }
  }
}
```

### 6.3 Mejora: Verificar prerrequisitos en activación

```typescript
activateQuest: (sessionId, questTemplateId) => {
  const session = get().sessions.find(s => s.id === sessionId);
  const template = get().getTemplateById?.(questTemplateId);
  
  // NUEVO: Verificar prerrequisitos
  if (template?.prerequisites?.length > 0) {
    const completedIds = (session?.sessionQuests || [])
      .filter(q => q.status === 'completed')
      .map(q => q.templateId);
    
    const hasAllPrereqs = template.prerequisites.every(p => completedIds.includes(p));
    if (!hasAllPrereqs) {
      console.warn(`[Quest] Cannot activate ${questTemplateId}: missing prerequisites`);
      return; // No activar
    }
  }
  
  // Continuar con activación...
}
```

### 6.4 Mejora: Implementar Item Rewards

```typescript
export function executeItemReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  if (!storeActions.addToInventory) {
    return { /* error */ };
  }
  
  // key = itemId, value = quantity
  const itemId = reward.key;
  const quantity = typeof reward.value === 'number' 
    ? reward.value 
    : parseInt(String(reward.value)) || 1;
  
  storeActions.addToInventory(itemId, quantity);
  
  return {
    rewardId: reward.id,
    type: 'item',
    key: reward.key,
    value: quantity,
    success: true,
    message: `Added item ${itemId} x${quantity}`,
  };
}
```

### 6.5 Mejora: Quest HUD Integration

```typescript
// Crear QuestHUD component que muestre:
// - Misiones activas con progreso
// - Objetivos completados/pendientes
// - Notificaciones de progreso

// O añadir a HUDTemplate:
interface HUDTemplate {
  // ...
  showQuests?: boolean;
  questDisplayMode?: 'sidebar' | 'overlay' | 'compact';
}
```

### 6.6 Mejora: Persistencia de Quest Templates en DB

Actualmente los quest templates se guardan en archivos JSON. Considerar:
- Migrar a Prisma/SQLite para mejor consistencia
- O mantener JSON pero con backup automático

### 6.7 Optimización: Caching de Templates

```typescript
// En questTemplateSlice, añadir:
const templatesCache = new Map<string, { data: QuestTemplate; timestamp: number }>();

export function getTemplateById(id: string): QuestTemplate | undefined {
  const cached = templatesCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const template = questTemplates.find(t => t.id === id);
  if (template) {
    templatesCache.set(id, { data: template, timestamp: Date.now() });
  }
  return template;
}
```

### 6.8 Mejora: UI para Value Conditions

Actualizar `quest-template-manager.tsx` para permitir configurar:
- Tipo de valor (presence/number/text)
- Operador de comparación
- Valor objetivo

---

## 7. RESUMEN DE ESTADO

| Componente | Estado | Notas |
|------------|--------|-------|
| Tipos | ✅ Completo | Value conditions implementadas |
| Quest Detector | ✅ Funcional | Value detection para objetivos |
| Quest Handler | ⚠️ Parcial | Falta integrar chain |
| Reward Executor | ⚠️ Parcial | Items no implementados |
| Session Slice | ✅ Funcional | Carga/reset correcto |
| Stats Integration | ✅ Completo | Funciona correctamente |
| Sprite Integration | ✅ Completo | Busca en packs y triggers |
| Sound Integration | ✅ Completo | Funciona correctamente |
| Background Integration | ✅ Completo | Funciona correctamente |
| HUD Integration | ⚠️ Parcial | No hay quest display |
| Prompt Integration | ✅ Completo | Quests en contexto LLM |
| Prerequisites | ❌ Falta | No se verifican |
| Quest Chains | ❌ Falta | No se ejecutan automáticamente |
| Value Conditions (completion) | ❌ Falta | No implementado en completado |

---

## 8. PRIORIDAD DE CORRECCIONES

### Alta Prioridad:
1. **Implementar valueCondition en detectQuestCompletions** - Necesario para quests con condiciones de valor
2. **Verificar prerrequisitos en activateQuest** - Evita activación incorrecta
3. **Implementar Quest Chains** - Funcionalidad importante del sistema

### Media Prioridad:
4. **Corregir buildQuestPromptSection** - Inconsistencia de parámetros
5. **Implementar Item Rewards** - Completar sistema de recompensas
6. **Corregir verificación de objetivos opcionales** - Para auto-completado

### Baja Prioridad:
7. **Quest HUD Integration** - Mejora de UX
8. **Caching de templates** - Optimización
9. **UI para value conditions** - Mejora de configuración

---

Stage Summary:
- Sistema de misiones bien arquitecturado con separación Template/Instance
- Integración correcta con sprites, sonidos, backgrounds y stats
- Carga y reset de misiones funciona correctamente
- Varios problemas detectados que necesitan corrección
- Funcionalidades pendientes: quest chains, prerrequisitos, valueCondition en completado, item rewards

---
Task ID: 2
Agent: Code Assistant
Task: Implementar correcciones de alta prioridad

## Work Log:
- Implementada verificación de prerrequisitos en activateQuest (sessionSlice.ts)
- Implementado Quest Chains en completeQuest (sessionSlice.ts)
- Implementado valueCondition en detectQuestCompletions (quest-detector.ts)
- Corregido auto-completado para considerar objetivos opcionales (progressQuestObjective, completeObjective)

---

## CORRECCIONES IMPLEMENTADAS

### 1. ✅ Prerrequisitos en activateQuest (sessionSlice.ts)

**Cambios:**
```typescript
activateQuest: (sessionId, questTemplateId) => {
  // Get template to check prerequisites
  const template = get().getTemplateById?.(questTemplateId);
  
  if (template?.prerequisites && template.prerequisites.length > 0) {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const completedQuestIds = (session?.sessionQuests || [])
      .filter(q => q.status === 'completed')
      .map(q => q.templateId);
    
    const hasAllPrereqs = template.prerequisites.every(p => 
      completedQuestIds.includes(p)
    );
    
    if (!hasAllPrereqs) {
      console.warn(`[Quest] Cannot activate "${template.name}": missing prerequisites`);
      return; // No activar
    }
  }
  
  // Continuar con activación...
}
```

### 2. ✅ Quest Chains en completeQuest (sessionSlice.ts)

**Cambios:**
```typescript
completeQuest: (sessionId, questTemplateId, characterId) => {
  // Get the template to check for chain
  const template = get().getTemplateById?.(questTemplateId);
  
  // Marcar quest como completada...
  
  // Handle quest chain - activate next quest if autoStart is enabled
  if (template?.chain && template.chain.type !== 'none' && template.chain.autoStart) {
    const nextQuestId = template.chain.type === 'specific' 
      ? template.chain.nextQuestId 
      : template.chain.type === 'random' && template.chain.randomPool?.length
        ? template.chain.randomPool[Math.floor(Math.random() * template.chain.randomPool.length)]
        : null;
    
    if (nextQuestId) {
      const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
      const nextQuestInstance = session?.sessionQuests?.find(q => q.templateId === nextQuestId);
      
      if (nextQuestInstance) {
        // Activate existing quest instance
        console.log(`[Quest Chain] Auto-starting next quest: ${nextQuestId}`);
        get().activateQuest(sessionId, nextQuestId);
      } else {
        // Create and activate new quest instance from template
        const nextTemplate = get().getTemplateById?.(nextQuestId);
        if (nextTemplate) {
          console.log(`[Quest Chain] Creating and activating new quest: ${nextQuestId}`);
          get().activateQuestFromTemplate?.(sessionId, nextTemplate);
        }
      }
    }
  }
  
  // Add completion notification...
}
```

### 3. ✅ valueCondition en detectQuestCompletions (quest-detector.ts)

**Cambios:**
```typescript
export function detectQuestCompletions(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[]
): QuestCompletionDetection[] {
  // ...
  
  // Check if valueCondition is specified
  const valueCondition = template.completion.valueCondition;
  
  if (valueCondition && valueCondition.valueType !== 'presence') {
    // Use value condition checking
    const result = checkValueCondition(
      text,
      template.completion.key,
      template.completion.caseSensitive,
      valueCondition
    );
    
    if (result.matched) {
      detections.push({
        templateId: template.id,
        template,
        matchedKey: template.completion.key,
        matchedText: String(result.extractedValue || ''),
        position: 0,
      });
    }
  } else {
    // Legacy presence detection
    const match = findKeyMatch(
      text,
      keys,
      template.completion.caseSensitive
    );
    
    if (match) {
      detections.push({ ... });
    }
  }
}
```

### 4. ✅ Objetivos Opcionales en Auto-Completado (sessionSlice.ts)

**Cambios en progressQuestObjective:**
```typescript
// Only check non-optional objectives for auto-completion
const requiredObjectives = updatedObjectives.filter(o => {
  const objTemplate = template?.objectives.find(ot => ot.id === o.templateId);
  return !objTemplate?.isOptional;
});
const allRequiredCompleted = requiredObjectives.length === 0 || 
  requiredObjectives.every(o => o.isCompleted);

return {
  ...q,
  objectives: updatedObjectives,
  progress: newProgress,
  // Auto-complete quest if all REQUIRED objectives are done
  ...(allRequiredCompleted && {
    status: 'completed' as const,
    completedAt: new Date().toISOString(),
    completedBy: characterId,
  }),
};
```

**Cambios en completeObjective:**
```typescript
// Same filter for optional objectives
const requiredObjectives = updatedObjectives.filter(o => {
  const objTemplate = template?.objectives.find(ot => ot.id === o.templateId);
  return !objTemplate?.isOptional;
});
const allRequiredCompleted = requiredObjectives.length === 0 || 
  requiredObjectives.every(o => o.isCompleted);
```

---

## ESTADO ACTUALIZADO

| Componente | Estado | Notas |
|------------|--------|-------|
| Tipos | ✅ Completo | Value conditions implementadas |
| Quest Detector | ✅ Completo | valueCondition en objetivos y completado |
| Quest Handler | ✅ Funcional | Chain pendiente de integración en trigger-system |
| Reward Executor | ⚠️ Parcial | Items no implementados |
| Session Slice | ✅ Completo | Prerrequisitos, chains y opcionales corregidos |
| Prerequisites | ✅ Implementado | Verificación en activateQuest |
| Quest Chains | ✅ Implementado | Auto-activación en completeQuest |
| Value Conditions (completion) | ✅ Implementado | Detecta valores en completado |
| Objetivos Opcionales | ✅ Corregido | Auto-completado solo con requeridos |

---

Stage Summary:
- Implementadas todas las correcciones de alta prioridad
- Sistema de prerrequisitos funcionando
- Quest chains con auto-activación implementado
- Detección de valores en completado funcionando
- Auto-completado considera correctamente objetivos opcionales
- Lint pasa sin errores

---
Task ID: 3
Agent: Code Assistant
Task: Implementar recompensas para objetivos individuales

## Work Log:
- Añadido campo `rewards?: QuestReward[]` a `QuestObjectiveTemplate` en types
- Añadidos campos `objectiveRewards` y `completesObjective` a `QuestTriggerHit`
- Actualizado `objectivesToTriggerHits()` en quest-detector.ts para incluir rewards y flag de completado
- Actualizado `processParsedTag()` en quest-handler.ts para legado tags
- Añadida función `executeObjectiveRewards()` en quest-reward-executor.ts
- Actualizado use-trigger-system.ts para ejecutar recompensas de objetivos cuando se completan

---

## RECOMPENSAS PARA OBJETIVOS INDIVIDUALES - IMPLEMENTACIÓN

### Concepto

Ahora hay dos tipos de recompensas en el sistema de misiones:

1. **Recompensas de Objetivo**: Se ejecutan cuando un objetivo individual se completa
   - Definidas en `QuestObjectiveTemplate.rewards[]`
   - Se activan para el personaje que está respondiendo

2. **Recompensas de Misión**: Se ejecutan cuando toda la misión se completa
   - Definidas en `QuestTemplate.rewards[]`
   - Se activan para el personaje que completó la misión

### Cambios en Tipos (types/index.ts)

```typescript
export interface QuestObjectiveTemplate {
  // ... existing fields ...
  
  // NUEVO: Recompensas al completar este objetivo
  rewards?: QuestReward[];
}

export interface QuestTriggerHit {
  // ... existing fields ...
  
  rewards?: QuestReward[];        // Quest completion rewards (action='complete')
  objectiveRewards?: QuestReward[]; // NEW: Objective completion rewards
  completesObjective?: boolean;   // NEW: True if this progress completes the objective
}
```

### Flujo de Detección

```
LLM Response con key de objetivo
        │
        ▼
detectObjectiveProgress() en quest-detector.ts
        │
        ├─▶ Calcula si el progreso completará el objetivo
        │   - currentCount + progress >= targetCount
        │
        ▼
objectivesToTriggerHits()
        │
        ├─▶ Si willComplete = true:
        │   - Incluye objective.rewards en hit.objectiveRewards
        │   - Marca hit.completesObjective = true
        │
        ▼
use-trigger-system.ts caso 'progress'
        │
        ├─▶ Si hit.completesObjective && hit.objectiveRewards:
        │   - Ejecuta executeObjectiveRewards()
        │   - Notifica con rewards incluidos
        │
        ▼
Recompensas aplicadas al personaje que responde
```

### Archivos Modificados

1. **types/index.ts**
   - Añadido `rewards?: QuestReward[]` a `QuestObjectiveTemplate`
   - Añadidos `objectiveRewards` y `completesObjective` a `QuestTriggerHit`

2. **quest-detector.ts**
   - `objectivesToTriggerHits()` ahora calcula si el objetivo se completará
   - Incluye rewards del objetivo si se completará

3. **quest-handler.ts**
   - `processParsedTag()` para tags legacy también incluye objective rewards

4. **quest-reward-executor.ts**
   - Nueva función `executeObjectiveRewards()`

5. **use-trigger-system.ts**
   - Importa `executeObjectiveRewards`
   - Caso 'progress' ahora ejecuta rewards si completa objetivo
   - Notificaciones mejoradas con rewards incluidos

### Ejemplo de Uso

```json
{
  "id": "quest-rescue",
  "name": "Rescue Mission",
  "objectives": [
    {
      "id": "obj-reach-village",
      "description": "Reach the village",
      "completion": { "key": "llegar-al-pueblo" },
      "targetCount": 1,
      "rewards": [
        {
          "id": "reward-exp-1",
          "type": "attribute",
          "key": "experiencia",
          "value": 50,
          "action": "add"
        }
      ]
    },
    {
      "id": "obj-defeat-guards",
      "description": "Defeat the guards",
      "completion": { "key": "guardias-derrotados" },
      "targetCount": 3,
      "rewards": [
        {
          "id": "reward-sprite-victory",
          "type": "sprite",
          "key": "victory",
          "returnToIdleMs": 3000
        }
      ]
    }
  ],
  "rewards": [
    {
      "id": "quest-reward-gold",
      "type": "attribute",
      "key": "oro",
      "value": 100,
      "action": "add"
    }
  ]
}
```

En este ejemplo:
- Al completar "Reach the village": +50 experiencia
- Al completar "Defeat the guards" (3/3): Sprite victory por 3 segundos
- Al completar toda la misión: +100 oro

---

Stage Summary:
- Sistema de recompensas para objetivos implementado
- Dos niveles de recompensas: objetivo y misión
- Recompensas se activan para el personaje que responde
- Lint pasa sin errores
- Dev server funciona correctamente

---
Task ID: 4
Agent: Code Assistant
Task: Completar UI de Quest Templates con todos los campos

## Work Log:
- Revisados todos los tipos del sistema de quests en types/index.ts
- Identificados campos faltantes en la UI de quest-template-manager.tsx
- Agregadas "Keys Alternativas" para cada objetivo (`completion.keys`)
- Agregada opción "Case Sensitive" para cada objetivo (`completion.caseSensitive`)
- Agregada sección completa de "Recompensas del Objetivo" para cada objetivo individual
- Verificado que todos los campos del sistema están disponibles en la UI

---

## CAMBIOS EN LA UI DE QUEST TEMPLATES

### Campos Agregados para Objetivos (QuestObjectiveTemplate)

1. **Keys Alternativas de Completado** (`completion.keys`)
   - Campo para agregar múltiples keys alternativas separadas por coma
   - Permite detectar el mismo objetivo con diferentes variaciones

2. **Case Sensitive** (`completion.caseSensitive`)
   - Switch para activar/desactivar distinción de mayúsculas/minúsculas
   - Ahora configurable por objetivo, no solo por misión

3. **Recompensas del Objetivo** (`objective.rewards`)
   - Sección completa para agregar múltiples recompensas por objetivo
   - Soporta: Atributo, Sprite, Sonido, Fondo, Item, Custom
   - Cada recompensa tiene: Tipo, Key, Valor, Acción (para atributos)
   - Botón "Agregar" para añadir nuevas recompensas
   - Botón X para eliminar cada recompensa

### Estructura de la UI de Objetivos

```
┌──────────────────────────────────────────────────────────────┐
│ Objetivo Card                                                 │
├──────────────────────────────────────────────────────────────┤
│ [ID]                [Tipo: Custom ▼]                         │
│ [Descripción del objetivo...]                                │
│                                                              │
│ [Key de Completado] [Keys Alternativas] [Cantidad]           │
│ [Case Sensitive]    [Opcional]                               │
│                                                              │
│ ────────────────────────────────────────────────────────────│
│ Condición de Valor: [ON/OFF]                                │
│   [Tipo: Presencia ▼] [Operador] [Valor Objetivo]           │
│                                                              │
│ ────────────────────────────────────────────────────────────│
│ 🎁 Recompensas del Objetivo           [+ Agregar]            │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ [Tipo ▼] [Key] [Valor] [Acción ▼] [X]              │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│                                          [X Eliminar Objetivo]│
└──────────────────────────────────────────────────────────────┘
```

### Archivos Modificados

1. **quest-template-manager.tsx**
   - Sección de grid para keys del objetivo expandida de 3 a 3+2 columnas
   - Nueva fila para Case Sensitive y Opcional con switches
   - Nueva sección "Objective Rewards Section" con UI completa para recompensas

### Verificación de Tipos

Todos los campos de `QuestObjectiveTemplate` están ahora disponibles en la UI:

| Tipo | Campo | UI |
|------|-------|-----|
| string | `id` | ✅ Input |
| string | `description` | ✅ Input |
| QuestObjectiveType | `type` | ✅ Select |
| string | `completion.key` | ✅ Input |
| string[] | `completion.keys` | ✅ Input (CSV) |
| boolean | `completion.caseSensitive` | ✅ Switch |
| QuestValueCondition | `completion.valueCondition` | ✅ Switch + Selects |
| number | `targetCount` | ✅ Input Number |
| boolean | `isOptional` | ✅ Switch |
| QuestReward[] | `rewards` | ✅ UI Completa |

---

Stage Summary:
- Todos los campos de QuestObjectiveTemplate disponibles en UI
- Keys alternativas agregadas para objetivos
- Case Sensitive configurable por objetivo
- Sección completa de recompensas por objetivo
- Lint pasa sin errores
- Dev server funciona correctamente
