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

## Confirmed production scope decisions

- 3D stack: Three.js 0.185.1 (ADR-001)
- Cloud LLM provider path: OpenAI Responses API with `gpt-5.6-luna` for the current MVP
- Hosting: Cloudflare Pages + Pages Functions (ADR-002)
- Mobile scope: desktop Chrome supported; mobile/narrow best-effort only (ADR-003)

## Unresolved by design

These still require production evidence before confirmation:

- Play perspective
- Combat model
- Browser local LLM runtime/model
- Final focus category
