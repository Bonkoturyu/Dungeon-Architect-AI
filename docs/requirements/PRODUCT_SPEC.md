# Product Spec v1.0

## Product

Dungeon Architect AI converts natural-language game-design intent into a validated, editable, playable low-poly 3D dungeon in the browser.

## Core flow

`DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT / REVEAL`

## DesignIntent core axes

- `fairness`
- `tension`
- `exploration`
- `greedPunishment`
- `routeChoice`
- `learnability`

Supporting candidates include combat/trap/reward density, deception, telegraph strength, backtracking, target duration, and target difficulty.

## MVP working logic vocabulary

### Triggers
- `on_enter_room`
- `on_interact_entity`
- `on_open_treasure`
- `on_enemy_group_cleared`

### Conditions
- flag
- item owned
- enemy group state
- one-shot

### Actions
- spawn enemy group
- unlock/open door
- enable shortcut
- give reward
- set flag
- reveal hint

Free-form runtime code generation is not part of MVP.

## MVP MUST

- prompt input
- DesignIntent
- DungeonSpec
- low-poly 3D generation
- Start / Goal
- multiple routes
- enemy / treasure / trap
- at least one supported working-logic event
- basic Edit Mode
- manual edit
- at least one natural-language edit path
- reachability / critical validation
- START gate
- playable browser loop
- Result / Reveal
- fallback examples
- legal/license records

## Out of scope

- real-time online multiplayer
- accounts/matchmaking
- monetization
- massive world
- free-form 3D asset generation
- professional DCC editor
- complex action combat
- large enemy roster

## Supported UI languages

The browser UI and first-run guide support live switching between:

- English (**default**)
- Japanese
- Simplified Chinese
- Traditional Chinese
- Korean

Language selection is page-session UI state only; reloading starts in English.

Localization architecture:

- English is the default language and fallback catalog.
- UI logic uses stable message IDs such as `tabs.create`, `goal.reachable`, and `entity.enemy`; rendered translated text is not used as a gameplay/state discriminator.
- Runtime/gameplay decisions continue to use language-neutral IDs and constants such as `entity.type === "enemy"`, room IDs, corridor IDs, validation codes, action IDs, and mode values.
- A language catalog is only a presentation mapping from stable message ID → localized string.
- If a requested language has no entry for a stable message ID, the English message is displayed.
- If the language identifier itself is unsupported, message lookup also falls back to English.
- New UI languages can therefore be added by adding a catalog without changing gameplay judgment logic.

Dungeon IDs, schema identifiers, API identifiers, validation/error codes, generator versions, and gameplay action IDs remain stable language-neutral contracts.

## Confirmed production scope decisions

- 3D stack: Three.js 0.185.1 (ADR-001)
- Cloud LLM provider path: OpenAI Responses API with `gpt-5.6-luna` for the current MVP
- Hosting: Cloudflare Pages + Pages Functions (ADR-002)
- Mobile scope: desktop Chrome supported; mobile/narrow best-effort only (ADR-003)
- Final focus category: `AI 3D Scene Generation` (ADR-004)

## Unresolved by design

These still require production evidence before confirmation:

- Play perspective
- Combat model
- Browser local LLM runtime/model
