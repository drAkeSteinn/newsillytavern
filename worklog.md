# Worklog - TavernFlow Stats System Implementation

---
Task ID: 1
Agent: Main Agent
Task: Implement Character Stats System

Work Log:
- Added comprehensive Stats types in `/src/types/index.ts`:
  - AttributeDefinition, SkillDefinition, IntentionDefinition, InvitationDefinition
  - StatRequirement, StatsBlockHeaders, CharacterStatsConfig
  - SessionStats, CharacterSessionStats, StatChangeLogEntry
  - StatsTriggerHit, ResolvedStats
  - DEFAULT_STATS_BLOCK_HEADERS, DEFAULT_STATS_CONFIG constants
  
- Extended CharacterCard interface with `statsConfig?: CharacterStatsConfig`
- Extended ChatSession interface with `sessionStats?: SessionStats`

- Created statsSlice in `/src/store/slices/statsSlice.ts`:
  - initializeSessionStats - Initialize stats for characters in a session
  - updateCharacterStat - Update single attribute value
  - batchUpdateCharacterStats - Batch update from LLM detection
  - resetCharacterStats - Reset to default values
  - clearSessionStats - Clear all session stats
  - getCharacterStats, getAttributeValue getters
  - evaluateRequirement, evaluateRequirements helper functions
  - filterSkillsByRequirements, filterIntentionsByRequirements, filterInvitationsByRequirements

- Created stats-resolver in `/src/lib/stats/stats-resolver.ts`:
  - Pre-LLM resolution of {{key}} templates
  - resolveStats - Full stats resolution for a character
  - resolveStatsInText - Resolve all keys in text
  - buildSkillsBlock, buildIntentionsBlock, buildInvitationsBlock
  - buildStatsPromptSections - Build sections for prompt viewer
  - hasStatsKeys, extractStatsKeys - Key detection utilities

- Created stats-detector in `/src/lib/stats/stats-detector.ts`:
  - Post-LLM detection of stat changes via keyword patterns
  - detectStatsUpdates - Main detection function
  - detectAttributeUpdates - Pattern matching for attributes
  - StatsDetectionState class for streaming support
  - checkStatsTriggers - Integration with trigger system
  - detectionsToTriggerHits - Convert to trigger format

- Created stats module index in `/src/lib/stats/index.ts`

- Integrated statsSlice into main store (`/src/store/index.ts`)

- Updated imports in prompt-builder to include stats resolution

Stage Summary:
- Core stats system infrastructure complete
- Types defined and integrated with CharacterCard and ChatSession
- Store slice created with all necessary actions
- Pre-LLM resolver for template keys
- Post-LLM detector for keyword patterns
- Session stats stored in sessions.json via ChatSession.sessionStats
- Character stats config stored in characters.json via CharacterCard.statsConfig
- Ready for UI implementation in character editor

---
Task ID: 2
Agent: Main Agent
Task: Complete Stats System - Stats Handler for Triggers

Work Log:
- Verified existing implementation:
  - Types: CharacterStatsConfig, SessionStats, AttributeDefinition, etc. - all defined
  - statsSlice: Complete with all actions for managing session stats
  - stats-resolver (Pre-LLM): Template key resolution for {{vida}}, {{habilidades}}, etc.
  - stats-detector (Post-LLM): Keyword pattern detection for stat updates
  - StatsEditor UI: Complete component in character editor Stats tab
  - Character Editor: Stats tab integrated (line 738-744)

- Created stats-handler for triggers system (`/src/lib/triggers/handlers/stats-handler.ts`):
  - StatsHandlerState - State management for detection
  - StatsTriggerContext - Context for trigger checking
  - StatsHandlerResult - Result structure with triggers and detections
  - checkStatsTriggersInText - Main detection during streaming
  - executeStatsTrigger - Execute stat update from trigger match
  - executeAllStatsTriggers - Batch execution
  - resetStatsHandlerState - Reset for new message
  - detectStatsInFullText - Non-streaming mode detection
  - processGroupStats - Multi-character detection for group chats
  - getAttributePatterns, testPattern - Utility functions

- Updated TriggerMatch type to include 'stats' trigger type
- Added stats-handler export to handlers index

- Verified persistence:
  - sessions.json structure supports sessionStats field
  - characters.json structure supports statsConfig field
  - No characters currently have statsConfig (expected for new feature)

Stage Summary:
- Stats system fully integrated with trigger system
- Post-LLM detection can update stats during streaming
- Group chat support for multi-character stats
- Pre-LLM resolution injects current values into prompts
- UI available in character editor Stats tab
- Persistence ready via existing JSON structure

---
Task ID: 3
Agent: Main Agent
Task: Implement Typography and Content Style Customization (Option C)

Work Log:
- Added new type interfaces in `/src/types/index.ts`:
  - TypographySettings: Font family, size, weight, line height, letter spacing
  - ContentStyleSettings: Styles for dialogue, action, thought, whisper, emotion, narration
  - DEFAULT_TYPOGRAPHY_SETTINGS and DEFAULT_CONTENT_STYLE_SETTINGS constants

- Extended DialogueSettings interface:
  - Added `typography: TypographySettings` field
  - Added `contentStyles: ContentStyleSettings` field
  - Updated DEFAULT_DIALOGUE_SETTINGS with new defaults

- Updated dialogueSlice in `/src/store/slices/dialogueSlice.ts`:
  - Added setTypographySettings action
  - Added setContentStyles, setDialogueStyle, setActionStyle, setThoughtStyle, setWhisperStyle, setNarrationStyle, setEmotionStyle actions
  - All actions properly handle undefined defaults

- Completely rewrote DialogueSettingsPanel in `/src/components/dialogue/dialogue-settings-panel.tsx`:
  - Added tabbed interface with "Tipografía", "Estilos", "Efectos" tabs
  - Typography tab: Font family selection (system, serif, sans, mono, custom), font size, weight, line height, letter spacing
  - Styles tab: Color and style customization for each content type (dialogue, action, thought, whisper, narration)
  - Effects tab: Existing bubble style, typewriter, format detection settings
  - Added color presets for easy selection
  - Added live preview for typography settings

- Updated TextFormatter in `/src/components/tavern/text-formatter.tsx`:
  - Now reads typography and contentStyles from store
  - Applies typography classes (font-family, size, weight, line-height, letter-spacing)
  - Applies content-specific styles based on parsed content type
  - Added support for new format types: thought `(text)`, whisper `~text~`
  - Narration text now uses contentStyles.narration settings

Stage Summary:
- Users can now customize font family, size, weight, line height, and letter spacing
- Users can customize colors and styles for each content type
- Settings apply to both normal and group chats via shared store
- All settings persist via the existing persistence system
- Backward compatible with default values for all new settings

---
Task ID: 4
Agent: Main Agent
Task: Implement Lorebook Selection for Characters and Groups

Work Log:
- Updated types in `/src/types/index.ts`:
  - Added `lorebookIds?: string[]` to CharacterCard interface (after hudTemplateId)
  - Added `lorebookIds?: string[]` to CharacterGroup interface (after hudTemplateId)

- Created LorebookSelector component in `/src/components/tavern/lorebook-selector.tsx`:
  - Multi-select dropdown with checkboxes for each lorebook
  - Shows selected lorebooks as badges with remove button
  - Displays lorebook status (active/inactive) and entry count
  - Clear all button when multiple lorebooks selected
  - Info text explaining only active lorebooks inject content

- Updated Character Editor in `/src/components/tavern/character-editor.tsx`:
  - Added import for LorebookSelector and BookOpen icon
  - Added LorebookSelector UI below HUD template selector
  - Uses `character.lorebookIds` for value and updates state on change

- Updated Group Editor in `/src/components/tavern/group-editor.tsx`:
  - Added import for LorebookSelector and BookOpen icon
  - Added `lorebookIds` to initialValues and default values
  - Added `lorebookIds` state with useState
  - Added LorebookSelector UI below HUD template selector
  - Added `lorebookIds` to groupData in handleSave function

- Updated Chat Panel in `/src/components/tavern/chat-panel.tsx`:
  - Renamed `activeLorebookIds` to `globalActiveLorebookIds` for clarity
  - Added `effectiveLorebookIds` computed value:
    - For group chat: uses `activeGroup?.lorebookIds` or falls back to global
    - For normal chat: uses `activeCharacter?.lorebookIds` or falls back to global
  - Updated all lorebook filtering to use `effectiveLorebookIds`
  - Updated useCallback dependencies accordingly

Stage Summary:
- Characters can now have specific lorebooks assigned
- Groups can now have specific lorebooks assigned
- Chat uses only the linked lorebooks (character or group specific)
- Falls back to global active lorebooks if none assigned
- Prevents all lorebooks from activating when not relevant
- UI matches SillyTavern-style lorebook binding

---
Task ID: 5
Agent: Main Agent
Task: Implement Lorebook Priority Logic for Characters and Groups

Work Log:
- Updated chat-panel.tsx with new lorebook selection logic:
  
  **Normal Chat:**
  - If character has `lorebookIds` → use those lorebooks
  - If character has NO `lorebookIds` → use empty (no fallback to global)
  
  **Group Chat:**
  - If group has `lorebookIds` → use ONLY those (for all characters)
  - If group has NO `lorebookIds` → each character uses their own lorebooks
  - Characters without lorebooks get empty (no fallback)

- Added `effectiveLorebookIds` computed with `useMemo`:
  - For group mode: returns group lorebook IDs if present, empty otherwise
  - For normal mode: returns character lorebook IDs if present, empty otherwise
  
- Added `characterLorebooksMap` computed with `useMemo`:
  - Only computed for group mode when group has no lorebooks
  - Maps characterId to their lorebook IDs
  - Passed to API for per-character lorebook handling

- Updated group-stream API route:
  - Added `characterLorebooksMap` extraction from body
  - Added `useGroupLorebooks` flag to determine lorebook source
  - Moved lorebook section building inside character loop when needed
  - Each character now gets their own lorebook section based on:
    - Group lorebooks (if group has any) → shared by all
    - Character's own lorebooks (if group has none) → per-character

Stage Summary:
- Lorebooks now correctly prioritize character vs group assignments
- No fallback to global lorebooks (clean separation)
- Group lorebooks override character lorebooks when group has them
- Per-character lorebooks work independently when group has none
- Each character in a group can have different active lorebooks

---
Task ID: 6
Agent: Main Agent
Task: Fix System Prompt Replacement Logic

Work Log:
- Issue: Character's custom system prompt was being added as a DUPLICATE section
  - "System Prompt" showed default: "You are now in roleplay mode..."
  - "Custom System Prompt" showed character's custom prompt separately
  - Both were included in the final prompt, causing duplication

- Fixed in `/src/lib/llm/prompt-builder.ts`:
  - `buildSystemPrompt()`: Now checks if `character.systemPrompt` exists and is not empty
    - If present → uses it as the main "System Prompt"
    - If empty → uses the default "You are now in roleplay mode..."
  - `buildGroupSystemPrompt()`: Same logic for group chats
    - If character has custom prompt → uses it
    - Otherwise → uses "You are in a group roleplay..."

- Removed the duplicate "Custom System Prompt" section that was added after character notes

Stage Summary:
- Character's "Prompt de Sistema" now correctly REPLACES the default system prompt
- No more duplication in Prompt Viewer
- Works for both normal chats and group chats
- If character has no custom system prompt, the default is used

---
Task ID: 7
Agent: Main Agent
Task: Fix Character Attributes HUD Integration and Session Stats

Work Log:
- **Fixed HUD attribute filtering** in `/src/components/tavern/hud-display.tsx`:
  - Removed requirement for `color || icon` when showing attributes
  - Now only requires `showInHUD !== false` to display in HUD
  - Attributes will show with default styling if no color/icon is set

- **Updated HUD to support group chats**:
  - Added `MultiCharacterAttributesHUD` component for multi-character display
  - Group chats now show attributes for ALL group members
  - Each character's attributes are displayed in separate cards with character name header
  - Single character chats continue to work as before (no header shown)

- **Initialized session stats on chat creation** in `/src/store/slices/sessionSlice.ts`:
  - Added helper functions: `createDefaultCharacterStats`, `initializeSessionStatsForCharacters`
  - `createSession` now initializes `sessionStats` with default attribute values
  - For group chats: initializes stats for ALL group members
  - For normal chats: initializes stats for the single character
  - Stats are populated from `character.statsConfig.attributes` default values

- **Added session stats reset functionality**:
  - Added `resetSessionStats(sessionId)`: Resets stats to default values without clearing messages
  - Added `clearChat(sessionId)`: Resets stats AND clears messages (returns to first message)
  - Both functions properly handle group chats with multiple characters

Stage Summary:
- Character attributes with "Mostrar en HUD" now appear in HUD without requiring color/icon
- Group chats display each character's attributes separately with character name headers
- Session stats are automatically initialized when creating new chat sessions
- Stats values come from character's attribute `defaultValue` settings
- `clearChat` and `resetSessionStats` available for chat management
- All changes persist via existing session persistence system

---
Task ID: 8
Agent: Main Agent
Task: Integrate Stats Handler into Unified Trigger System and Improve Detection Keys

Work Log:
- **Updated AttributeDefinition type** in `/src/types/index.ts`:
  - Added `keys?: string[]` field for alternative detection keys
  - Updated documentation to match HUD field system
  - Maintained backward compatibility with `detectionTags` (legacy)

- **Updated stats-detector.ts** to use HUD-like key system:
  - Added `getDetectionKeys()` to extract all keys (key + keys[] + detectionTags fallback)
  - Added `keyMatchesAttribute()` for case-sensitive matching
  - Added `buildPatternFromKeys()` similar to HUD handler
  - Updated `detectAttributeUpdates()` to use new key system
  - Now detects: `[Vida=35]`, `Vida: 35`, `HP: 35`, `hp: 35`, etc.

- **Updated stats-handler.ts** for trigger system integration:
  - Simplified `StatsHandlerResult` interface
  - Added batch update support via `allDetections`
  - Updated `executeStatsTrigger()` to work with store actions
  - Added group chat support via `processGroupStats()`

- **Integrated into unified trigger system** in `/src/lib/triggers/use-trigger-system.ts`:
  - Added `statsEnabled` config option
  - Added `statsHandlerState` initialization
  - Added stats processing in `processStreamingContent`
  - Added cleanup in reset handlers
  - Added reset in `resetForNewMessage`

- **Updated Stats Editor UI** in `/src/components/tavern/stats-editor.tsx`:
  - Redesigned "Detección automática" section
  - Shows "Key principal" (always detected)
  - Added "Keys alternativas" input with comma-separated values
  - Shows badges with all detection keys
  - Added case sensitivity toggle with tooltip
  - Added detection format examples

Stage Summary:
- Stats system now uses the same key detection system as HUD fields
- Attributes can have primary key + alternative keys for detection
- Case sensitivity toggle affects key matching
- Integrated with unified trigger system for real-time detection
- UI matches HUD field editor style
- Detects formats: `[key=value]`, `key: value`, `key=value`

---
Task ID: 9
Agent: Main Agent
Task: Implement HUD Context System for Prompt Injection

Work Log:
- **Added new types** in `/src/types/index.ts`:
  - `HUDContextPosition` - Reuses LorebookPosition values (0-7)
  - `HUDContextConfig` - Configuration for context injection:
    - `enabled` - Toggle for activation
    - `content` - Text content to inject
    - `position` - Where to inject in prompt
    - `scanDepth` - Messages to consider (optional)

- **Updated HUDTemplate interface**:
  - Added `context?: HUDContextConfig` field

- **Updated HUD Editor** in `/src/components/settings/hud-manager.tsx`:
  - Added new "Contexto" section with:
    - Switch to enable/disable context injection
    - Dropdown for injection position (7 options):
      - Después del System Prompt (0)
      - Después del mensaje del usuario (1)
      - Antes del mensaje del usuario (2)
      - Después del mensaje del asistente (3)
      - Antes del mensaje del asistente (4)
      - Al inicio del chat (5)
      - Al final del chat (6)
    - Slider for scan depth (1-20 messages)
    - Textarea for context content

- **Added context injection functions** in `/src/lib/llm/prompt-builder.ts`:
  - `buildHUDContextSection()` - Creates PromptSection from config
  - `injectHUDContextIntoMessages()` - Injects into ChatApiMessage array
  - `injectHUDContextIntoSections()` - Injects into PromptSection array

- **Updated all API routes**:
  - `/api/chat/stream` - Stream-based chat
  - `/api/chat/generate` - Non-streaming chat
  - `/api/chat/regenerate` - Message regeneration
  - `/api/chat/group-stream` - Group chat streaming
  - All routes now extract `hudContext` from request body
  - All routes inject context at configured position

- **Updated chat-panel.tsx**:
  - Added `activeHUDContext` computed value
  - Extracts context from active HUD template
  - Passes to all API calls via `hudContext` parameter

Stage Summary:
- HUD templates can now have context text that injects into prompts
- Context always injects when enabled (no key detection like lorebooks)
- 7 injection positions available matching SillyTavern lorebook positions
- Works for both normal chats and group chats
- Context is visible in Prompt Viewer with cyan color
- Scan depth allows limiting context relevance window

---
Task ID: 10
Agent: Main Agent
Task: Implement SillyTavern-style Example Dialogue Formatting

Work Log:
- **Added `processExampleDialogue()` function** in `/src/lib/prompt-template.ts`:
  - Parses `<START>` tags to separate dialogue blocks
  - Replaces `{{user}}` and `{{char}}` with actual names
  - Formats each block as:
    ```
    ### Instruction:
    userName: [user's dialogue]
    
    ### Response:
    charName: [character's dialogue]
    ```
  - Handles multi-line dialogue continuation
  - Falls back to raw text if no `<START>` tags found

- **Updated prompt-builder.ts**:
  - Imported `processExampleDialogue` function
  - Updated `buildSystemPrompt()` to format examples
  - Updated `buildGroupSystemPrompt()` to format examples
  - Example dialogue sections now show formatted output

Stage Summary:
- Example dialogue (`mesExample`) now formats with `<START>` blocks
- Output follows SillyTavern instruction/response format
- Template variables `{{user}}` and `{{char}}` are replaced
- Works for both normal and group chats
- Prompt Viewer shows formatted dialogue examples
