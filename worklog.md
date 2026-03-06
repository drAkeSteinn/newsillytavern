# Worklog - TavernFlow Memory/Summary System Fix

---
Task ID: 1
Agent: Main
Task: Revisar y arreglar el sistema de memoria/resúmenes

Work Log:
- Identificados problemas en el sistema de memoria:
  1. Los resúmenes se generaban pero no se eliminaban los mensajes antiguos
  2. El resumen se agregaba al system prompt en lugar del chat history
  3. Los resúmenes se guardaban en un store separado, no en la sesión JSON
- Creada función `deleteMessagesUpTo` en sessionSlice para eliminar mensajes antiguos
- Modificado `generateSummaryIfNeeded` en chat-panel para:
  - Llamar a deleteMessagesUpTo después de generar el resumen
  - Mantener los mensajes recientes (keepRecentMessages) y el primer mensaje
- Modificado stream route para inyectar el resumen al inicio del chat history:
  - El resumen se convierte en un mensaje artificial del asistente
  - Se agrega al inicio del array de mensajes, no al system prompt
- Modificado group-stream route con los mismos cambios para chats grupales

Stage Summary:
- Los resúmenes ahora eliminan los mensajes antiguos correctamente
- El resumen se inyecta al inicio del chat history (no en system prompt)
- El sistema funciona para chats normales y grupales
- Lint pasa sin errores
- Dev server funciona correctamente

---
Task ID: 2
Agent: Main
Task: Mover resumen a la sesión JSON (sobreescritura)

Work Log:
- Creada interfaz `SessionSummary` en types/index.ts:
  - content, messageRange, tokens, createdAt, model
  - Sin sessionId (ya está en la sesión)
- Agregado campo `summary?: SessionSummary` a ChatSession
- Creadas funciones en sessionSlice:
  - `setSessionSummary(sessionId, summary)` - Sobrescribe el resumen anterior
  - `clearSessionSummary(sessionId)` - Limpia el resumen
- Modificado chat-panel.tsx:
  - Usar `setSessionSummary` en lugar de `addSummary`
  - Usar `activeSession?.summary` para el resumen previo
  - Enviar `summary` (singular) al API en lugar de `summaries` array
- Modificados stream y group-stream routes:
  - Reciben `summary: SessionSummary | undefined`
  - Inyectan el resumen al inicio del chat history

Stage Summary:
- El resumen ahora se guarda en la sesión JSON
- Se sobrescribe en cada nueva generación (un solo resumen)
- Estructura: Último resumen + Mensajes del historial
- Lint pasa sin errores

---
Task ID: 3
Agent: Main
Task: Corregir orden de secciones del prompt (Post-History Instructions)

Work Log:
- Identificado problema: `postHistoryInstructions` se agregaba al system prompt
  - En SillyTavern, debe ir DESPUÉS del chat history, no en el system prompt
- Modificado `buildSystemPrompt`:
  - Removido postHistoryInstructions del system prompt
  - Ahora se pasa como parámetro separado a buildChatMessages
- Modificado `buildChatMessages`:
  - Ahora acepta `postHistoryInstructions` como parámetro
  - Lo inyecta DESPUÉS del chat history como mensaje 'system'
- Modificado `buildGroupSystemPrompt`:
  - Removido postHistoryInstructions del system prompt
- Modificado `buildGroupChatMessages`:
  - Ahora acepta `postHistoryInstructions` como parámetro
  - Lo inyecta DESPUÉS del chat history
- Modificado `buildCompletionPrompt`:
  - Ya manejaba correctamente postHistoryInstructions al final
- Actualizado stream route:
  - Pasa `effectiveCharacter.postHistoryInstructions` a buildChatMessages
  - Comentado correctamente que se inyecta después del chat

Stage Summary:
- El orden correcto de secciones es:
  1. System Prompt → 2. Persona → 3. Character Description → 4. Personality
  5. Scenario → 6. Example Dialogue → 7. Character Note → 8. Lorebook
  9. Chat History (mensajes)
  10. **Post-History Instructions** (DESPUÉS del chat)
- Lint pasa sin errores

---

# RESUMEN DE CAMBIOS - Sistema de Memoria

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `/src/types/index.ts` | Agregada interfaz `SessionSummary`, campo `summary` en `ChatSession` |
| `/src/store/slices/sessionSlice.ts` | Agregadas funciones `setSessionSummary`, `clearSessionSummary`, `deleteMessagesUpTo` |
| `/src/components/tavern/chat-panel.tsx` | Modificado para guardar resumen en sesión, no en store separado |
| `/src/app/api/chat/stream/route.ts` | Recibe `summary` singular, pasa `postHistoryInstructions` correctamente |
| `/src/app/api/chat/group-stream/route.ts` | Mismo cambio para chats grupales |
| `/src/lib/llm/prompt-builder.ts` | Corregido orden de secciones, postHistoryInstructions va después del chat |

## Estructura del Resumen en Sesión

```json
{
  "id": "session-123",
  "characterId": "char-1",
  "messages": [...],
  "summary": {
    "content": "El usuario y el personaje discutieron sobre...",
    "messageRange": { "start": 0, "end": 15 },
    "tokens": 450,
    "createdAt": "2024-01-15T10:30:00Z",
    "model": "gpt-4"
  }
}
```

## Orden Correcto de Secciones del Prompt (SillyTavern Style)

```
┌─────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (antes del chat)                          │
├─────────────────────────────────────────────────────────┤
│ 1. System Prompt (main instruction)                     │
│ 2. Persona Description (user)                           │
│ 3. Character Description                                │
│ 4. Personality                                          │
│ 5. Scenario                                             │
│ 6. Example Dialogue (mes_example)                       │
│ 7. Character Note (Author's Note)                       │
│ 8. Lorebook entries                                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ CHAT HISTORY                                            │
├─────────────────────────────────────────────────────────┤
│ User: Hola                                              │
│ Character: ¡Hola! ¿Cómo estás?                          │
│ User: Bien, ¿y tú?                                      │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ POST-HISTORY INSTRUCTIONS                               │
├─────────────────────────────────────────────────────────┤
│ [System message with instructions after chat]           │
│ "Respond in a friendly manner..."                       │
└─────────────────────────────────────────────────────────┘
```

## Flujo del Sistema de Memoria

```
Usuario envía mensaje
        ↓
incrementMessageCount(sessionId, isGroupMode)
        ↓
¿messagesSinceLastSummary >= threshold?
        ↓ SÍ
generateSummaryIfNeeded()
        ↓
POST /api/chat/summary → Genera resumen con LLM
        ↓
setSessionSummary(sessionId, summary) → Guarda en sesión (sobrescribe anterior)
        ↓
deleteMessagesUpTo(sessionId, keepRecentMessages) → Elimina mensajes antiguos
        ↓
resetMessageCount(sessionId) → Resetea contador
        ↓
En siguiente request:
activeSession.summary se envía al API → Se inyecta al inicio del chat history
```

---
Task ID: 4
Agent: Main
Task: Corregir resolución de keys en postHistoryInstructions

Work Log:
- Identificado problema: Las keys {{user}}, {{char}}, {{stats}} no se resolvían en postHistoryInstructions
- Causa raíz:
  1. En stream/route.ts: postHistoryInstructions se pasaba sin resolver a buildChatMessages
  2. En group-stream/route.ts: Mismo problema
  3. En buildPostHistorySection: No aceptaba keyContext para resolver keys
- Correcciones realizadas:
  1. stream/route.ts: Agregado resolveAllKeys() antes de pasar a buildChatMessages
  2. group-stream/route.ts: Agregado resolveAllKeys() con keyContext
  3. buildPostHistorySection: Agregado parámetro opcional keyContext
- Verificado que processCharacter() ya resuelve todas las keys incluyendo postHistoryInstructions
- generate/route.ts y regenerate/route.ts usan processCharacter() por lo que ya funcionan correctamente

Stage Summary:
- Todas las keys {{user}}, {{char}}, {{userpersona}}, {{stats}} se resuelven correctamente en:
  - System prompt
  - Character description
  - Personality
  - Scenario
  - Example dialogue
  - Character note
  - Lorebook
  - Post-history instructions
- El sistema de resolución de keys está unificado usando:
  - `processCharacter()` para pre-procesar el personaje completo
  - `resolveAllKeys()` para resolver texto específico
  - `keyContext` compartido en todas las resoluciones
- Lint pasa sin errores

---
Task ID: sprite-priority-system
Agent: Main Agent
Task: Document and verify sprite priority system

Work Log:
- Verified sprite priority system is correctly implemented
- Added comprehensive documentation to /docs/SPRITE_PRIORITY_SYSTEM.md
- Added inline comments in character-sprite.tsx explaining priority rules
- Added inline comments in spriteSlice.ts explaining priority rules
- Fixed returnToMode to use 'clear' for state-aware transitions
- Updated all references to point to the correct documentation location

Stage Summary:
- Sprite priority system is correctly implemented:
  1. TRIGGER SPRITE has absolute priority (highest)
  2. STATE COLLECTIONS (talk/thinking/idle) - only shown when no trigger
  3. LEGACY SPRITES - fallback
  4. AVATAR - final fallback
- Key behavior:
  - Trigger sprite persists indefinitely if returnToIdleMs = 0
  - Trigger sprite clears after X ms if returnToIdleMs > 0
  - Trigger sprite is NOT affected by generation lifecycle
  - returnToMode: 'clear' respects current state after trigger clears
- Documentation added at: /docs/SPRITE_PRIORITY_SYSTEM.md
