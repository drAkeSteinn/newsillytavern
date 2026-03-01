# 🎮 TavernFlow - Plan de Implementación de Nuevas Características

## 📋 Visión General

Este plan detalla la implementación de 5 sistemas principales para mejorar la experiencia de roleplay:

| Sistema | Prioridad | Complejidad | Tiempo Estimado |
|---------|-----------|-------------|-----------------|
| 🌦️ Atmósfera/Clima | Alta | Media | ~4-5 horas |
| 🧠 Memoria/Resúmenes | Alta | Alta | ~5-6 horas |
| 🎯 Quests/Misiones | Media | Media-Alta | ~4-5 horas |
| 💬 Diálogos Mejorados | Media | Media | ~3-4 horas |
| 📊 Estadísticas | Baja | Media | ~3-4 horas |

---

## 🌦️ FASE 1: Sistema de Atmósfera y Clima

### Objetivo
Implementar un sistema de capas atmosféricas (clima, tiempo, partículas) que se superponen al background base.

### Tareas

#### Fase 1.1: Tipos y Estructuras Base
- [ ] **T1.1.1** Crear tipos `AtmosphereLayer`, `AtmosphereState`, `AtmosphereCategory`
- [ ] **T1.1.2** Crear `atmosphereSlice` en el store
- [ ] **T1.1.3** Definir constantes de capas predefinidas (rain, snow, fog, etc.)

#### Fase 1.2: Sistema de Renderizado
- [ ] **T1.2.1** Crear componente `AtmosphereRenderer` (contenedor principal)
- [ ] **T1.2.2** Implementar efectos CSS (rain, snow básico, fog)
- [ ] **T1.2.3** Implementar sistema de partículas Canvas (fireflies, leaves)
- [ ] **T1.2.4** Crear overlays de sprites (rain overlay, light rays)

#### Fase 1.3: Integración con Trigger System
- [ ] **T1.3.1** Crear `atmosphere-handler.ts` en handlers
- [ ] **T1.3.2** Implementar detección de triggers atmosféricos
- [ ] **T1.3.3** Integrar con `use-trigger-system.ts`

#### Fase 1.4: UI de Configuración
- [ ] **T1.4.1** Crear `atmosphere-settings.tsx` panel de configuración
- [ ] **T1.4.2** Crear `atmosphere-presets.tsx` para presets rápidos
- [ ] **T1.4.3** Integrar en settings-panel

#### Fase 1.5: Audio Atmosférico
- [ ] **T1.5.1** Integrar con el sistema de sonidos existente
- [ ] **T1.5.2** Implementar loops de audio para clima
- [ ] **T1.5.3** Sistema de volumen dinámico por intensidad

---

## 🧠 FASE 2: Sistema de Memoria y Resúmenes

### Objetivo
Sistema que genera resúmenes automáticos de la conversación y mantiene memoria del personaje.

### Tareas

#### Fase 2.1: Tipos y Store
- [ ] **T2.1.1** Crear tipos `SummaryData`, `MemoryEvent`, `SummarySettings`
- [ ] **T2.1.2** Extender `ChatSession` con campos de resumen y memoria
- [ ] **T2.1.3** Crear `summarySlice` en el store

#### Fase 2.2: API de Resumen
- [ ] **T2.2.1** Crear `/api/chat/summary/route.ts`
- [ ] **T2.2.2** Implementar lógica de generación de resumen
- [ ] **T2.2.3** Sistema de prompt templates personalizables
- [ ] **T2.2.4** Manejo de errores y reintentos

#### Fase 2.3: Integración con Chat
- [ ] **T2.3.1** Detectar fin de turno (chat normal y grupos)
- [ ] **T2.3.2** Disparar generación de resumen en background
- [ ] **T2.3.3** Guardar resumen en ChatSession
- [ ] **T2.3.4** Integrar resumen en prompt builder

#### Fase 2.4: Sistema de Memoria
- [ ] **T2.4.1** Crear tipos `CharacterMemory`, `RelationshipMemory`
- [ ] **T2.4.2** Implementar detección de eventos importantes
- [ ] **T2.4.3** API para CRUD de memorias
- [ ] **T2.4.4** Integrar memoria en prompts

#### Fase 2.5: UI de Configuración
- [ ] **T2.5.1** Panel de configuración en tab "Chat" de settings
- [ ] **T2.5.2** Editor de prompt template
- [ ] **T2.5.3** Vista de resumen actual
- [ ] **T2.5.4** Editor de memoria del personaje

---

## 🎯 FASE 3: Sistema de Quests/Misiones

### Objetivo
Sistema de seguimiento de objetivos que se activan automáticamente o manualmente.

### Tareas

#### Fase 3.1: Tipos y Store
- [ ] **T3.1.1** Crear tipos `Quest`, `QuestObjective`, `QuestSettings`
- [ ] **T3.1.2** Crear `questSlice` en el store
- [ ] **T3.1.3** Definir constantes de detección (frases, patterns)

#### Fase 3.2: Sistema de Detección
- [ ] **T3.2.1** Crear `quest-handler.ts` en handlers
- [ ] **T3.2.2** Implementar detección de nuevas quests
- [ ] **T3.2.3** Implementar detección de completación
- [ ] **T3.2.4** Parser para tags especiales `<quest>`

#### Fase 3.3: API de Quests
- [ ] **T3.3.1** Crear `/api/quests/route.ts` (CRUD)
- [ ] **T3.3.2** Endpoints para crear, actualizar, completar
- [ ] **T3.3.3** Persistencia en ChatSession

#### Fase 3.4: UI del Quest Log
- [ ] **T3.4.1** Crear `quest-log-panel.tsx` (panel principal)
- [ ] **T3.4.2** Crear `quest-card.tsx` (tarjeta individual)
- [ ] **T3.4.3** Crear `quest-editor.tsx` (editor manual)
- [ ] **T3.4.4** Notificaciones de quest completada

#### Fase 3.5: Integración
- [ ] **T3.5.1** Integrar con trigger system
- [ ] **T3.5.2** Añadir quests activas al prompt
- [ ] **T3.5.3** Persistir quests en sesión

---

## 💬 FASE 4: Sistema de Diálogos Mejorados

### Objetivo
Mejorar la presentación visual de mensajes con speech bubbles, typewriter y formateo.

### Tareas

#### Fase 4.1: Tipos y Configuración
- [ ] **T4.1.1** Crear tipos `DialogueSettings`, `DialogueFormat`
- [ ] **T4.1.2** Crear `dialogueSlice` en el store
- [ ] **T4.1.3** Configuración por personaje (colores, estilo)

#### Fase 4.2: Parser de Formato
- [ ] **T4.2.1** Crear `dialogue-parser.ts` (parsear *acciones*, "diálogos", etc.)
- [ ] **T4.2.2** Implementar detección de emociones
- [ ] **T4.2.3** Detección de tipo de segmento

#### Fase 4.3: Componentes Visuales
- [ ] **T4.3.1** Crear `SpeechBubble` component
- [ ] **T4.3.2** Crear `TypewriterText` component
- [ ] **T4.3.3** Crear `FormattedMessage` component
- [ ] **T4.3.4** Estilos CSS para diferentes tipos de bubbles

#### Fase 4.4: Integración en Chat
- [ ] **T4.4.1** Reemplazar componente de mensaje actual
- [ ] **T4.4.2** Integrar con avatares de personaje
- [ ] **T4.4.3** Soporte para grupos (múltiples personajes)

#### Fase 4.5: UI de Configuración
- [ ] **T4.5.1** Panel en settings (tab "Display")
- [ ] **T4.5.2** Selector de estilo de bubble
- [ ] **T4.5.3** Configuración de velocidad typewriter

---

## 📊 FASE 5: Sistema de Estadísticas

### Objetivo
Sistema de stats visuales que se actualizan automáticamente o manualmente.

### Tareas

#### Fase 5.1: Tipos y Store
- [ ] **T5.1.1** Crear tipos `CharacterStats`, `StatDefinition`, `StatusEffect`
- [ ] **T5.1.2** Crear `statsSlice` en el store
- [ ] **T5.1.3** Definir patterns de detección de cambios

#### Fase 5.2: Sistema de Detección
- [ ] **T5.2.1** Crear `stat-handler.ts` en handlers
- [ ] **T5.2.2** Implementar detección de cambios HP/MP
- [ ] **T5.2.3** Parser para tags `<stat name="hp" change="-10"/>`
- [ ] **T5.2.4** Sistema de status effects

#### Fase 5.3: Componentes Visuales
- [ ] **T5.3.1** Crear `StatPanel` component (panel principal)
- [ ] **T5.3.2** Crear `StatBar` component (barra individual)
- [ ] **T5.3.3** Crear `StatusEffectIcon` component
- [ ] **T5.3.4** Animaciones de cambio de stat

#### Fase 5.4: Sistema de Dice Roll
- [ ] **T5.4.1** Crear `/api/dice/route.ts`
- [ ] **T5.4.2** Comandos `/roll`, `/r` en chat
- [ ] **T5.4.3** Visualización de resultados
- [ ] **T5.4.4** Integración con stats

#### Fase 5.5: Integración
- [ ] **T5.5.1** Integrar con trigger system
- [ ] **T5.5.2** Añadir stats al prompt
- [ ] **T5.5.3** Persistir stats en sesión/personaje

---

## 🔗 Dependencias entre Fases

```
FASE 1 (Atmósfera)
    └── Independiente, puede empezar inmediatamente

FASE 2 (Memoria/Resumen)
    ├── Depende de: Sistema LLM existente
    └── Depende de: Prompt builder existente

FASE 3 (Quests)
    ├── Depende de: Trigger system existente
    └── Similar a: Background triggers (patrón similar)

FASE 4 (Diálogos)
    ├── Depende de: Sistema de chat existente
    └── Integración con: Sistema de grupos

FASE 5 (Stats)
    ├── Depende de: Trigger system existente
    └── Puede integrar: Dice rolling

 Todas las fases se integran con:
    ├── Store existente (tavern-store)
    ├── Settings panel existente
    └── Prompt builder existente
```

---

## 📁 Estructura de Archivos a Crear

```
src/
├── types/
│   └── index.ts (añadir nuevos tipos)
│
├── store/slices/
│   ├── atmosphereSlice.ts
│   ├── summarySlice.ts
│   ├── questSlice.ts
│   ├── dialogueSlice.ts
│   └── statsSlice.ts
│
├── lib/triggers/handlers/
│   ├── atmosphere-handler.ts
│   ├── quest-handler.ts
│   └── stat-handler.ts
│
├── components/
│   ├── atmosphere/
│   │   ├── AtmosphereRenderer.tsx
│   │   ├── atmosphere-settings.tsx
│   │   └── atmosphere-presets.tsx
│   │
│   ├── memory/
│   │   ├── summary-settings.tsx
│   │   ├── memory-editor.tsx
│   │   └── summary-viewer.tsx
│   │
│   ├── quests/
│   │   ├── quest-log-panel.tsx
│   │   ├── quest-card.tsx
│   │   └── quest-editor.tsx
│   │
│   ├── dialogue/
│   │   ├── SpeechBubble.tsx
│   │   ├── TypewriterText.tsx
│   │   ├── FormattedMessage.tsx
│   │   └── dialogue-settings.tsx
│   │
│   └── stats/
│       ├── StatPanel.tsx
│       ├── StatBar.tsx
│       ├── StatusEffectIcon.tsx
│       └── stats-settings.tsx
│
├── app/api/
│   ├── chat/summary/route.ts
│   ├── quests/route.ts
│   └── dice/route.ts
│
└── lib/
    ├── dialogue-parser.ts
    └── atmosphere-effects.ts

public/
├── effects/
│   ├── rain-drop.png
│   ├── snowflake.png
│   └── fog-overlay.png
│
└── sounds/ambient/
    ├── rain-light.mp3
    ├── rain-heavy.mp3
    ├── wind.mp3
    └── fire-crackle.mp3
```

---

## 🎯 Orden de Implementación Recomendado

### Sprint 1: Base Systems
1. **FASE 1**: Atmósfera (impacto visual inmediato)
2. **FASE 2**: Memoria/Resumen (mejora calidad AI)

### Sprint 2: Interactive Systems
3. **FASE 3**: Quests (añade profundidad narrativa)
4. **FASE 4**: Diálogos (mejora UX)

### Sprint 3: Advanced Features
5. **FASE 5**: Stats (para roles con combate)

---

## ✅ Criterios de Aceptación por Fase

### Fase 1 - Atmósfera
- [ ] Efectos de lluvia funcionan con CSS
- [ ] Efectos de nieve funcionan con Canvas
- [ ] Triggers detectan cambio de clima
- [ ] Audio atmosférico se reproduce
- [ ] UI permite configurar efectos

### Fase 2 - Memoria/Resumen
- [ ] Resumen se genera automáticamente
- [ ] Resumen se incluye en el prompt
- [ ] Prompt template es personalizable
- [ ] Memoria del personaje funciona
- [ ] UI muestra resumen actual

### Fase 3 - Quests
- [ ] Quests se detectan automáticamente
- [ ] Quests se pueden crear manualmente
- [ ] Completación se detecta
- [ ] Quest Log UI es funcional
- [ ] Quests activas en prompt

### Fase 4 - Diálogos
- [ ] Speech bubbles renderizan correctamente
- [ ] Typewriter effect funciona
- [ ] Formato de texto (cursiva, etc.) funciona
- [ ] Colores por personaje funcionan
- [ ] Configuración en settings

### Fase 5 - Stats
- [ ] Stats se muestran visualmente
- [ ] Cambios se detectan automáticamente
- [ ] Dice roll funciona
- [ ] Status effects funcionan
- [ ] Stats en prompt

---

## 📝 Notas Adicionales

- Cada fase debe pasar `bun run lint` sin errores
- Cada fase debe ser testeada en el preview
- Los tipos deben estar bien documentados
- El código debe seguir el estilo existente
- Las animaciones deben ser suaves (60fps)
- La UI debe ser responsive

---

*Documento creado: Plan de Implementación v1.0*
*Última actualización: Pendiente de aprobación*
