# TavernFlow Worklog

---
Task ID: phase-0
Agent: Main
Task: FASE 0 - Crear módulos compartidos y refactorizar código duplicado

Work Log:
- Crear directorio src/lib/llm/ y src/lib/llm/providers/
- Crear src/lib/llm/types.ts - Tipos compartidos (ChatApiMessage, StreamRequest, etc.)
- Crear src/lib/llm/utils.ts - Utilidades SSE (createSSEJSON, cleanResponseContent, etc.)
- Crear src/lib/llm/providers/zai.ts - Provider Z.ai (streamZAI, callZAI)
- Crear src/lib/llm/providers/openai.ts - Provider OpenAI (streamOpenAICompatible, callOpenAICompatible)
- Crear src/lib/llm/providers/anthropic.ts - Provider Anthropic (streamAnthropic, callAnthropic)
- Crear src/lib/llm/providers/ollama.ts - Provider Ollama (streamOllama, callOllama)
- Crear src/lib/llm/providers/text-generation-webui.ts - Provider TGWUI/KoboldCPP
- Crear src/lib/llm/providers/index.ts - Exports centralizados
- Crear src/lib/llm/prompt-builder.ts - Constructor de prompts unificado
- Crear src/lib/llm/streaming.ts - Factory de streaming generators
- Crear src/lib/llm/generation.ts - Funciones de generación no-streaming
- Crear src/lib/llm/index.ts - Exports principales
- Refactorizar src/app/api/chat/stream/route.ts - Usar módulos compartidos
- Refactorizar src/app/api/chat/generate/route.ts - Usar módulos compartidos
- Refactorizar src/app/api/chat/group-stream/route.ts - Usar módulos compartidos + multi-provider

Stage Summary:
- Código duplicado eliminado: ~800 líneas reducidas a módulos reutilizables
- Sistema de providers modular: cada proveedor en su archivo
- Groups ahora soportan TODOS los proveedores (no solo Z.ai)
- Prompt builder unificado para chats individuales y grupales
- Facilita el mantenimiento y añadir nuevos proveedores

Archivos creados:
- src/lib/llm/types.ts
- src/lib/llm/utils.ts
- src/lib/llm/prompt-builder.ts
- src/lib/llm/streaming.ts
- src/lib/llm/generation.ts
- src/lib/llm/index.ts
- src/lib/llm/providers/zai.ts
- src/lib/llm/providers/openai.ts
- src/lib/llm/providers/anthropic.ts
- src/lib/llm/providers/ollama.ts
- src/lib/llm/providers/text-generation-webui.ts
- src/lib/llm/providers/index.ts

Archivos modificados:
- src/app/api/chat/stream/route.ts
- src/app/api/chat/generate/route.ts
- src/app/api/chat/group-stream/route.ts

---
Task ID: phase-1
Agent: Main
Task: FASE 1 - Store Refactor - Dividir tavern-store.ts en slices

Work Log:
- Crear directorio src/store/slices/
- Crear src/store/defaults.ts - Valores por defecto (defaultLLMConfig, defaultSettings, etc.)
- Crear src/store/slices/characterSlice.ts - Estado y acciones de personajes
- Crear src/store/slices/sessionSlice.ts - Estado y acciones de sesiones y mensajes
- Crear src/store/slices/groupSlice.ts - Estado y acciones de grupos
- Crear src/store/slices/llmSlice.ts - Estado y acciones de LLM/TTS/PromptTemplates
- Crear src/store/slices/settingsSlice.ts - Estado de configuración de la app
- Crear src/store/slices/lorebookSlice.ts - Estado y acciones de lorebooks
- Crear src/store/slices/personaSlice.ts - Estado y acciones de personas
- Crear src/store/slices/backgroundSlice.ts - Estado de fondos y overlays
- Crear src/store/slices/soundSlice.ts - Estado de sonidos y triggers
- Crear src/store/slices/uiSlice.ts - Estado de UI (modales, loading, etc.)
- Crear src/store/slices/index.ts - Exports de todos los slices
- Crear src/store/index.ts - Store combinado con persist middleware
- Actualizar src/store/tavern-store.ts - Re-export para compatibilidad

Stage Summary:
- Store dividido de 1170+ líneas a 11 archivos manejables (~100-150 líneas cada uno)
- Compatibilidad total con localStorage existente (mismo nombre: 'tavernflow-storage')
- Función merge para migración automática de datos antiguos
- Imports existentes siguen funcionando (re-export desde tavern-store.ts)

Archivos creados:
- src/store/defaults.ts
- src/store/slices/characterSlice.ts
- src/store/slices/sessionSlice.ts
- src/store/slices/groupSlice.ts
- src/store/slices/llmSlice.ts
- src/store/slices/settingsSlice.ts
- src/store/slices/lorebookSlice.ts
- src/store/slices/personaSlice.ts
- src/store/slices/backgroundSlice.ts
- src/store/slices/soundSlice.ts
- src/store/slices/uiSlice.ts
- src/store/slices/index.ts
- src/store/index.ts

Archivos modificados:
- src/store/tavern-store.ts (ahora re-exporta del modular store)

---
Task ID: phase-3
Agent: Main
Task: FASE 3 - Lorebook Integration - Sistema completo de integración de lorebooks en prompts

Work Log:
- Crear directorio src/lib/lorebook/
- Crear src/lib/lorebook/scanner.ts - Escaneo de keywords en mensajes
  - scanForLorebookEntries(): Escanea mensajes buscando keywords de lorebook
  - filterByProbability(): Filtra entries por probabilidad
  - getEntriesByPosition(): Obtiene entries por posición de inyección
  - groupEntries(): Agrupa entries por grupo
  - estimateTokens(): Estima tokens de texto
  - applyTokenBudget(): Aplica límite de tokens a entries
- Crear src/lib/lorebook/injector.ts - Inyección de entradas en prompt
  - buildLorebookSection(): Construye sección de lorebook para prompt
  - createLorebookPromptSection(): Crea PromptSection para visualización
  - processLorebooks(): Procesa todos los lorebooks activos
  - getLorebookForPosition(): Obtiene entries para posición específica
  - formatLorebookContext(): Formatea entries como contexto
  - hasActiveLorebookEntries(): Verifica si hay entries activas
  - getTotalEntryCount(): Cuenta entries totales
- Crear src/lib/lorebook/index.ts - Exports del módulo
- Actualizar src/lib/llm/prompt-builder.ts - Integración de lorebook
  - buildLorebookSectionForPrompt(): Construye sección de lorebook
  - buildChatHistorySections(): Secciones de historial
  - buildPostHistorySection(): Sección post-historia
  - buildGroupSystemPrompt(): Prompt para grupos con lorebook
- Actualizar src/lib/llm/types.ts - Añadir tipos faltantes

Stage Summary:
- Sistema de lorebooks completamente integrado en la construcción de prompts
- Soporte para keywords primarias y secundarias
- Diferentes posiciones de inyección (después de system, antes de user, etc.)
- Control de probabilidad y presupuesto de tokens
- Compatible con formato SillyTavern para import/export

Archivos creados:
- src/lib/lorebook/scanner.ts
- src/lib/lorebook/injector.ts
- src/lib/lorebook/index.ts

Archivos modificados:
- src/lib/llm/prompt-builder.ts
- src/lib/llm/types.ts

---
Task ID: phase-4
Agent: Main
Task: FASE 4 - Contexto Inteligente - Validación, sliding window y race conditions

Work Log:
- Crear src/lib/validations.ts - Esquemas Zod para validación de requests
  - streamRequestSchema, generateRequestSchema, groupStreamRequestSchema
  - validateRequest() helper function
  - sanitizeInput() para limpieza de caracteres de control
  - Validación de LLM params, characters, groups, personas
- Crear src/lib/context-manager.ts - Gestión de sliding window
  - estimateTokens() - Estimación de tokens (~4 chars/token)
  - applySlidingWindow() - Ventana deslizante de mensajes
  - applyTokenLimit() - Límite basado en tokens
  - selectContextMessages() - Selección inteligente combinando ambos
  - GenerationLock class - Prevención de race conditions
  - getContextStats() - Estadísticas del contexto
- Actualizar src/types/index.ts - Añadir ContextSettings interface
- Actualizar src/store/defaults.ts - Añadir defaultContextSettings
- Actualizar src/components/tavern/settings-panel.tsx - UI para config de contexto
  - Nueva pestaña "Contexto" con sliders y opciones
  - Configuración de maxMessages, maxTokens, keepFirstN, keepLastN
  - UI para futuros resúmenes (deshabilitada por ahora)
- Actualizar src/app/api/chat/stream/route.ts
  - Integrar validación Zod
  - Integrar context manager con sliding window
  - Sanitización de input
- Actualizar src/app/api/chat/generate/route.ts
  - Integrar validación Zod
  - Integrar context manager
- Actualizar src/app/api/chat/group-stream/route.ts
  - Integrar validación Zod
  - Integrar context manager
- Actualizar src/components/tavern/chat-panel.tsx
  - Añadir generationIdRef para trackear generación activa
  - Añadir isGenerationInProgressRef para prevención de race conditions
  - Implementar isStillActive() helper
  - Verificar generación activa antes de añadir mensajes
  - Cancelar streaming si nueva generación inicia
  - Pasar contextConfig en requests

Stage Summary:
- Sistema completo de validación de requests con Zod
- Ventana deslizante de mensajes para controlar contexto
- Límite de tokens con estimación automática
- Configuración de contexto en UI de settings
- Race conditions corregidas con refs y generation IDs
- Estructura preparada para sistema de resúmenes futuro

Archivos creados:
- src/lib/validations.ts
- src/lib/context-manager.ts

Archivos modificados:
- src/types/index.ts
- src/store/defaults.ts
- src/components/tavern/settings-panel.tsx
- src/app/api/chat/stream/route.ts
- src/app/api/chat/generate/route.ts
- src/app/api/chat/group-stream/route.ts
- src/components/tavern/chat-panel.tsx

---
Task ID: phase-5
Agent: Main
Task: FASE 5 - Swipe System - Sistema completo de respuestas alternativas

Work Log:
- Actualizar src/types/index.ts - Añadir campo swipes: string[] a ChatMessage
- Actualizar src/store/slices/sessionSlice.ts - Acciones de swipe
  - swipeMessage(): Navegar entre alternativas existentes
  - addSwipeAlternative(): Añadir nueva alternativa
  - setCurrentSwipe(): Establecer índice de swipe
  - getSwipeCount(): Contar alternativas
- Actualizar src/store/index.ts - Migración para mensajes sin swipes
  - Añadir swipes: [content] si no existe
  - Asegurar swipeIndex existe
- Actualizar src/components/tavern/chat-message.tsx - UI de navegación
  - Botones de navegación izquierda/derecha
  - Indicador de índice actual (1/3)
  - Botón derecho genera nueva alternativa si está en el último
  - Icono RefreshCw cuando está en el último swipe
- Actualizar src/components/tavern/novel-chat-box.tsx
  - Importar swipeMessage del store
  - Pasar props de swipe al ChatMessageBubble
  - onSwipe, hasAlternatives, currentIndex, totalAlternatives, onRegenerate
- Crear src/app/api/chat/regenerate/route.ts - Endpoint de regeneración
  - Validación de request
  - Usa contexto de mensajes hasta el mensaje a regenerar
  - Streaming con todos los proveedores
  - Devuelve contenido limpio con messageId y sessionId
- Actualizar src/components/tavern/chat-panel.tsx
  - Añadir addSwipeAlternative del store
  - Crear handleRegenerate() para generar alternativas
  - Pasar onRegenerate al NovelChatBox
  - Prevención de race conditions en regeneración

Stage Summary:
- Sistema completo de swipe para respuestas alternativas
- Navegación con flechas entre alternativas
- Generación de nuevas alternativas al pulsar → en el último swipe
- Indicador visual de índice (1/3, 2/3, etc.)
- Migración automática de mensajes existentes
- Endpoint dedicado para regeneración
- Compatible con todos los proveedores LLM

Archivos creados:
- src/app/api/chat/regenerate/route.ts

Archivos modificados:
- src/types/index.ts
- src/store/slices/sessionSlice.ts
- src/store/index.ts
- src/components/tavern/chat-message.tsx
- src/components/tavern/novel-chat-box.tsx
- src/components/tavern/chat-panel.tsx

---

# 🚀 PLAN DE IMPLEMENTACIÓN - TavernFlow v2.0

## Resumen de Fases

| Fase | Nombre | Duración Est. | Prioridad |
|------|--------|---------------|-----------|
| 0 | Fundamentos y Refactor | 3-4 tareas | 🔴 Alta |
| 1 | Store Refactor (Slices) | 4-5 tareas | 🔴 Alta |
| 2 | Multi-provider para Grupos | 2-3 tareas | 🔴 Alta |
| 3 | Lorebook Integration | 3-4 tareas | 🔴 Alta |
| 4 | Contexto Inteligente | 4-5 tareas | 🟡 Media |
| 5 | Swipe System | 2-3 tareas | 🟡 Media |
| 6 | Pulido Final | 3-4 tareas | 🟢 Baja |

---

## 📋 FASE 0: Fundamentos - Crear Módulos Compartidos

**Objetivo:** Eliminar código duplicado y crear una base sólida para las siguientes fases.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 0.1 | Crear `src/lib/llm/streaming.ts` | Funciones de streaming compartidas (streamZAI, streamOpenAI, etc.) | Nuevo |
| 0.2 | Crear `src/lib/llm/prompt-builder.ts` | Función unificada buildSystemPrompt() | Nuevo |
| 0.3 | Crear `src/lib/llm/providers/index.ts` | Export centralizado de proveedores | Nuevo |
| 0.4 | Refactorizar `stream/route.ts` | Usar módulos compartidos | Modificar |
| 0.5 | Refactorizar `generate/route.ts` | Usar módulos compartidos | Modificar |
| 0.6 | Refactorizar `group-stream/route.ts` | Usar módulos compartidos | Modificar |

### Estructura de Archivos Nueva:
```
src/lib/llm/
├── index.ts              # Exports principales
├── streaming.ts          # Funciones de streaming por proveedor
├── prompt-builder.ts     # Constructor de prompts unificado
├── providers/
│   ├── zai.ts           # Provider Z.ai
│   ├── openai.ts        # Provider OpenAI/Compatible
│   ├── anthropic.ts     # Provider Anthropic
│   ├── ollama.ts        # Provider Ollama
│   └── index.ts         # Exports de providers
└── types.ts             # Tipos compartidos de LLM
```

---

## 📋 FASE 1: Store Refactor - Dividir en Slices

**Objetivo:** Dividir `tavern-store.ts` (1170+ líneas) en slices manejables manteniendo compatibilidad total con localStorage.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 1.1 | Crear `src/store/types.ts` | Interfaces del store compartidas | Nuevo |
| 1.2 | Crear `src/store/characterSlice.ts` | Estado de personajes | Nuevo |
| 1.3 | Crear `src/store/sessionSlice.ts` | Estado de sesiones y mensajes | Nuevo |
| 1.4 | Crear `src/store/groupSlice.ts` | Estado de grupos | Nuevo |
| 1.5 | Crear `src/store/settingsSlice.ts` | Estado de configuración | Nuevo |
| 1.6 | Crear `src/store/lorebookSlice.ts` | Estado de lorebooks | Nuevo |
| 1.7 | Crear `src/store/personaSlice.ts` | Estado de personas | Nuevo |
| 1.8 | Crear `src/store/index.ts` | Store combinado con persist middleware | Nuevo |
| 1.9 | Migrar imports | Actualizar todos los archivos que importan del store | Múltiples |
| 1.10 | Verificar compatibilidad | Tests de que localStorage existente funciona | - |

### Estructura de Archivos Nueva:
```
src/store/
├── index.ts              # Store principal combinado
├── types.ts              # Tipos del store
├── characterSlice.ts     # ~150 líneas
├── sessionSlice.ts       # ~200 líneas
├── groupSlice.ts         # ~150 líneas
├── settingsSlice.ts      # ~150 líneas
├── lorebookSlice.ts      # ~100 líneas
├── personaSlice.ts       # ~100 líneas
└── middleware.ts         # Persist middleware personalizado
```

### Compatibilidad con localStorage:
```typescript
// El nombre del storage debe mantenerse igual
persist(
  store,
  { name: 'tavern-store' }  // Mismo nombre para no perder datos
)
```

---

## 📋 FASE 2: Multi-provider para Grupos

**Objetivo:** Habilitar todos los proveedores LLM (OpenAI, Anthropic, Ollama, etc.) para chats grupales.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 2.1 | Extender `group-stream/route.ts` | Usar provider routing como en individual | Modificar |
| 2.2 | Adaptar streaming para grupos | Cada character usa el provider configurado | Modificar |
| 2.3 | Manejar errores por character | Si un character falla, otros continúan | Modificar |
| 2.4 | Actualizar UI | Mostrar provider usado en cada respuesta | Modificar |

### Dependencias:
- Fase 0 completada (módulos de streaming compartidos)

---

## 📋 FASE 3: Lorebook Integration

**Objetivo:** Sistema completo de lorebooks que escanea keywords y las inyecta en el prompt.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 3.1 | Crear `src/lib/lorebook/scanner.ts` | Escaneo de keywords en mensajes | Nuevo |
| 3.2 | Crear `src/lib/lorebook/injector.ts` | Inyección de entradas en prompt | Nuevo |
| 3.3 | Integrar en `prompt-builder.ts` | Añadir sección "World Information" | Modificar |
| 3.4 | Crear UI de gestión | Panel para editar entradas del lorebook | Modificar |
| 3.5 | Activar por personaje | Lorebook específico por personaje | Modificar |

### Flujo:
```
Mensaje Usuario → Scanner busca keywords → 
Encuentra entradas activas → Injector añade a prompt →
LLM recibe contexto del mundo
```

---

## 📋 FASE 4: Contexto Inteligente

**Objetivo:** Límite de mensajes en contexto, validación de input, y corrección de race conditions.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 4.1 | Crear `src/lib/validations.ts` | Esquemas Zod para validación | Nuevo |
| 4.2 | Añadir validación a API routes | Validar requests en endpoints | Modificar |
| 4.3 | Crear `src/lib/context-manager.ts` | Gestión de sliding window | Nuevo |
| 4.4 | Añadir config de límite en Settings | UI para configurar max mensajes | Modificar |
| 4.5 | Implementar sliding window | Limitar mensajes enviados al LLM | Modificar |
| 4.6 | Corregir race condition | Usar estado derivado en handleSend | Modificar |
| 4.7 | Preparar estructura para resúmenes | Base para futuros summaries | Nuevo |

### Configuración en Settings:
```typescript
interface ChatSettings {
  maxContextMessages: number;      // Ej: 20 mensajes
  enableSummaries: boolean;         // Para futuro
  summaryThreshold: number;         // Ej: cada 10 mensajes
}
```

---

## 📋 FASE 5: Swipe System

**Objetivo:** Sistema completo de respuestas alternativas navegables.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 5.1 | Actualizar tipos | Añadir `alternatives: string[]` a ChatMessage | Modificar |
| 5.2 | Crear función `generateSwipe` | Generar nueva alternativa | Nuevo |
| 5.3 | Crear función `navigateSwipe` | Navegar entre alternativas | Nuevo |
| 5.4 | Crear UI de navegación | Flechas ◀▶ e indicador "2/4" | Modificar |
| 5.5 | Integrar con streaming | Streaming para nueva alternativa | Modificar |

### Estructura de datos:
```typescript
interface ChatMessage {
  id: string;
  content: string;           // Contenido actual visible
  alternatives: string[];    // ["resp1", "resp2", "resp3"]
  swipeIndex: number;        // Índice actual (0-2)
  // ...
}
```

---

## 📋 FASE 6: Pulido Final

**Objetivo:** Traducciones, limpieza de console.log, y optimizaciones finales.

### Tareas:

| # | Tarea | Descripción | Archivos |
|---|-------|-------------|----------|
| 6.1 | Crear `src/lib/i18n.ts` | Sistema de traducciones | Nuevo |
| 6.2 | Traducir componentes UI | Reemplazar strings en inglés | Múltiples |
| 6.3 | Eliminar console.log | Limpiar logs de desarrollo | Múltiples |
| 6.4 | Añadir logs estructurados | Sistema de logging controlado | Nuevo |
| 6.5 | Optimizar re-renders | useMemo/useCallback donde sea necesario | Múltiples |
| 6.6 | Documentación inline | Comentarios en código complejo | Múltiples |

### Estructura de traducciones:
```typescript
// src/lib/i18n.ts
export const t = (key: string, lang: 'es' | 'en' = 'es') => {
  return translations[lang][key] || key;
};

const translations = {
  es: {
    save: "Guardar",
    cancel: "Cancelar",
    // ...
  },
  en: {
    save: "Save",
    cancel: "Cancel",
    // ...
  }
};
```

---

## 📊 Dependencias entre Fases

```
FASE 0 (Fundamentos)
    ↓
FASE 1 (Store) ←→ FASE 2 (Multi-provider)
    ↓                    ↓
FASE 3 (Lorebook) ←─────┘
    ↓
FASE 4 (Contexto)
    ↓
FASE 5 (Swipe)
    ↓
FASE 6 (Pulido)
```

**Fases que pueden ir en paralelo:** 1 y 2 pueden iniciarse juntas después de la Fase 0.

---

## ⚠️ Notas Importantes

1. **Compatibilidad de localStorage:** La Fase 1 DEBE mantener el mismo nombre de storage (`tavern-store`) para no perder datos de usuarios existentes.

2. **Testing:** Después de cada fase, verificar que:
   - Los datos existentes se cargan correctamente
   - Los chats funcionan como antes
   - No hay errores en consola

3. **Rollback:** Antes de cada fase, se recomienda hacer backup del archivo `data/` completo.

---

---
Task ID: 1
Agent: Main
Task: Fix blur background blocking sprite drag

Work Log:
- Identified issue: The blur overlay had z-index: 20 while sprite had z-index: 5
- The overlay was blocking mouse events on the sprite
- Added `pointer-events-none` class to the overlay in background-layer.tsx

Stage Summary:
- Fixed: Sprite can now be dragged even when blur background is enabled
- File modified: src/components/tavern/background-layer.tsx

---
Task ID: 2
Agent: Main
Task: Implement local JSON file persistence for characters, chats, groups, and personas

Work Log:
- Created data/ directory for storing JSON files
- Created src/lib/persistence.ts with utilities for reading/writing JSON files
- Created src/app/api/persistence/route.ts with GET/POST/PUT endpoints
- Created src/hooks/use-persistence-sync.ts for client-side synchronization
- Created src/components/persistence-provider.tsx as a wrapper component
- Modified src/app/layout.tsx to include PersistenceProvider
- Implemented auto-save with 2-second debounce

Stage Summary:
- Data now persists to local JSON files instead of just localStorage
- Files created in /home/z/my-project/data/:
  - characters.json
  - sessions.json
  - groups.json
  - personas.json
  - settings.json
  - lorebooks.json
- Data survives server restarts and browser data clearing
- Auto-save triggers 2 seconds after any change to persistent data

---
Task ID: 3
Agent: Main
Task: Add Lorebooks and Sound Triggers buttons to header

Work Log:
- Added BookOpen and Music icons to imports in page.tsx
- Added settingsTab state to track which settings tab to open
- Added openSettingsTab function to set tab and open settings panel
- Added two new buttons in header:
  - Lorebooks button (BookOpen icon) - opens settings to lorebooks tab
  - Sound Triggers button (Music icon) - opens settings to sounds tab
- Modified SettingsPanel to accept initialTab prop
- Used key prop on Tabs component to remount with new initialTab

Stage Summary:
- Added quick access buttons for Lorebooks and Sound Triggers
- Buttons open Settings panel directly to the corresponding tab
- Files modified:
  - src/app/page.tsx (added buttons and logic)
  - src/components/tavern/settings-panel.tsx (added initialTab prop)

---
Task ID: 4
Agent: Main
Task: Add Prompt Viewer to see the prompt sent to LLM

Work Log:
- Added PromptSection interface to types/index.ts for storing prompt sections
- Updated MessageMetadata to include promptData field
- Modified API chat stream route to:
  - Build prompt sections with colored labels for each section type
  - Send prompt_data event at the start of the stream
  - Sections include: system, persona, character_description, personality, scenario, example_dialogue, character_note, post_history, chat_history, instructions
- Created PromptViewerDialog component with:
  - Color-coded sections with collapsible headers
  - Expand/Collapse All buttons
  - Copy Clean and Copy with Labels buttons
  - Character count and estimated tokens display
- Updated ChatMessageBubble to:
  - Add Eye icon button when message has prompt data
  - Open PromptViewerDialog when clicked
- Updated ChatPanel to capture prompt_data from stream and store in message metadata

Stage Summary:
- Added prompt viewer button to message bubbles
- Prompt sections are stored in message metadata and persisted to JSON
- Dialog shows all sections with color-coded headers
- Copy functionality for clean and formatted prompt
- Files modified:
  - src/types/index.ts (added PromptSection interface)
  - src/app/api/chat/stream/route.ts (build and send prompt sections)
  - src/components/tavern/prompt-viewer-dialog.tsx (new component)
  - src/components/tavern/chat-message.tsx (added prompt viewer button)
  - src/components/tavern/chat-panel.tsx (capture prompt data from stream)

---
Task ID: phase-6
Agent: Main
Task: FASE 6 - Pulido Final - Traducciones, logging y optimizaciones

Work Log:
- Crear src/lib/i18n.ts - Sistema completo de traducciones es/en
  - Diccionario con 150+ claves de traducción
  - Funciones t(), setLanguage(), getCurrentLanguage()
  - Soporte para interpolación de variables {{var}}
- Crear src/lib/logger.ts - Sistema de logging estructurado
  - Logger class con niveles debug/info/warn/error
  - Configuración dinámica de nivel mínimo
  - Funciones createTimer() y withErrorLogging()
  - Loggers pre-configurados: chatLogger, llmLogger, storeLogger, apiLogger, uiLogger
- Traducir componentes UI:
  - src/components/tavern/chat-panel.tsx - Mensajes de error, bienvenida, confirmaciones
  - src/components/tavern/novel-chat-box.tsx - Settings, labels, acciones
  - src/components/tavern/chat-message.tsx - Nombres por defecto, tooltips de swipe
  - src/app/page.tsx - Tooltips de navegación, loading
- Eliminar console.log de producción:
  - Reemplazados todos los console.log/warn/error con logger estructurado
  - Archivos actualizados: chat-panel.tsx, character-panel.tsx, character-editor.tsx, 
    sprite-manager.tsx, background-gallery.tsx, persona-panel.tsx, trigger-editor.tsx,
    sound-triggers-settings.tsx
- Verificación de calidad:
  - ESLint pasa sin errores
  - Dev server compila correctamente
  - No hay errores en consola

Stage Summary:
- Sistema de traducciones completo con soporte español/inglés
- Logging estructurado reemplaza console statements
- Código más mantenible y preparado para producción
- UI consistente en español para el usuario final

Archivos creados:
- src/lib/i18n.ts
- src/lib/logger.ts

Archivos modificados:
- src/components/tavern/chat-panel.tsx
- src/components/tavern/novel-chat-box.tsx
- src/components/tavern/chat-message.tsx
- src/app/page.tsx
- src/components/tavern/character-panel.tsx
- src/components/tavern/character-editor.tsx
- src/components/tavern/sprite-manager.tsx
- src/components/tavern/background-gallery.tsx
- src/components/tavern/persona-panel.tsx
- src/components/tavern/trigger-editor.tsx
- src/components/tavern/sound-triggers-settings.tsx

