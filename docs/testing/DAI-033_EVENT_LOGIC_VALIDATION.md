# DAI-033 Supported Event Logic Validation

## Status

**IN PROGRESS.**

DAI-033 implements the MVP working-logic vocabulary as a fixed, schema-validated, renderer-independent runtime. It does not execute arbitrary JavaScript or generated code.

## Production event contract

### Triggers

- `on_enter_room` with `roomId`
- `on_interact_entity` with `entityId`
- `on_open_treasure` with treasure `entityId`
- `on_enemy_group_cleared` with non-empty `enemyIds`

### Conditions

- `flag` with `key` and JSON-scalar `value`
- `item_owned` with `itemId` and positive `minCount`
- `enemy_group_state` with `enemyIds` and `cleared` / `not_cleared`
- `one_shot`

### Actions

- `spawn_enemy_group` with predeclared enemy IDs
- `unlock_open_door` with logical `doorId`
- `enable_shortcut` with an existing corridor ID
- `give_reward` with `itemId` and positive count
- `set_flag` with non-reserved key and JSON-scalar value
- `reveal_hint` with `hintId`

`packages/core/src/dungeon-spec.js` validates all supported event structures and references before START.
Unsupported trigger, condition, or action types are Critical validation errors and block START.

## Runtime model

`packages/play-core/src/event-runtime.js` exposes deterministic event dispatch plus read helpers for logical door/hint state and runtime shortcut availability.

Runtime rules:

- snapshot events are evaluated in array order;
- same-trigger later events see state written by earlier fired events, making chains deterministic;
- all event processing operates on cloned PlaySession state;
- a failed action does not partially mutate the caller session;
- `one_shot` uses reserved runtime bookkeeping flags under `__dai:`;
- author-defined `set_flag` actions cannot write reserved `__dai:` keys;
- successful events append a `logic-event-fired` audit event with event ID, trigger, and action types.

## Action semantics

### `set_flag`
Writes `PlaySession.gameplayState.flags[key]`.

### `give_reward`
Adds the requested count to `PlaySession.gameplayState.inventory[itemId]` using safe-integer checks.

### `reveal_hint`
Sets reserved runtime hint state. Presentation is a later UI concern.

### `unlock_open_door`
Sets reserved logical door `unlocked` and `open` state. DungeonSpec v1 does not yet have a first-class door collection, so DAI-033 does not claim final door geometry or collision behavior.

### `enable_shortcut`
Sets runtime shortcut state. Corridors with `initiallyEnabled: false` are excluded from PlaySession movement adjacency until the corresponding action fires.

### `spawn_enemy_group`
Activates predeclared enemy entities with `initiallyActive: false`. Spawned enemies use the same DAI-031 runtime state contract. Defeated enemies cannot be respawned by this MVP action.

## Automatic dispatch integration

- START dispatches `on_enter_room` for the Start room.
- successful movement dispatches `on_enter_room` for the destination room before Goal completion is finalized.
- successful treasure/trap/recovery interactions dispatch `on_interact_entity`.
- successful treasure opening additionally dispatches `on_open_treasure` after `on_interact_entity`.
- successful enemy defeat dispatches the `on_enemy_group_cleared` evaluation; an event fires only when every referenced enemy is defeated.

## Test coverage

Core tests verify:

- the supported trigger/condition/action vocabulary validates;
- unsupported vocabulary is rejected;
- room/entity/treasure/corridor/enemy references are type checked;
- event actions cannot be empty;
- reserved runtime flag keys cannot be spoofed by author actions.

Play Core tests verify:

- disabled shortcuts block movement until enabled by an event;
- `on_open_treasure` actions apply exactly once under `one_shot`;
- flag, item-owned, and enemy-group-state conditions work;
- same-trigger event chains execute in stable array order;
- enemy-group-clear events fire only after the final referenced enemy is defeated;
- dormant predeclared enemies can be activated by `spawn_enemy_group`;
- unsupported event definitions block START through the normal DungeonSpec gate.

## Production evidence scenario

`scripts/run-dai-033-event-logic.mjs` derives an event-enabled scenario from the production PCE 20-room fixture without modifying the committed fixture.

The scenario exercises all four trigger types, all four condition types, and all six action types. It also verifies:

- `corridor-10` is unavailable before a treasure-open event and traversable after `enable_shortcut`;
- re-entering `room-02` does not duplicate its one-shot reward;
- warning-chest inspection satisfies a flag-conditioned interaction event;
- the enemy-group event does not fire after only `enemy-01`, then fires after `enemy-02`;
- a dormant enemy in `room-09` is activated only after the item-owned and enemy-group-cleared conditions are true;
- prior sessions, authoring data, and the fixed execution snapshot remain unchanged;
- Goal clear and existing Result generation remain valid.

## Required production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-033-event-logic; git pull --ff-only origin feat/dai-033-event-logic; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-033-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` SHA-256;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node test suite;
4. runs the deterministic DAI-033 event-logic evidence scenario;
5. writes `artifacts/event-logic/dai-033-event-logic.json`.

## Completion gate

Do not mark DAI-033 DONE until:

- the complete production Node test suite passes;
- the event-logic evidence reports `passed = true`;
- the generated JSON evidence is reviewed.

## Explicit non-goals

DAI-033 does not decide or implement:

- arbitrary/free-form runtime code;
- dynamic runtime creation of unregistered enemy entities;
- final door geometry/collision presentation;
- final hint UI;
- player HP/death/failure;
- combat policy or perspective selection;
- simulation/balance scoring.

Those remain later M3, PCE-1.0, renderer/UI, and simulation work.
