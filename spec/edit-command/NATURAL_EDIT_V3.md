# Natural-language Edit V3 — Structural single-command authoring

## Status

DAI-100 implementation candidate. Owner-local structural acceptance is pending. Live-provider/public semantic verification remains a final replacement-candidate gate.

## Goal

Extend the accepted Natural-language Edit V2 single-command boundary to the remaining existing manual structural authoring operations without creating a second editor engine.

Every successful provider result is still materialized into exactly one existing `EditCommand` and is applied through the normal browser `applyCommand()` preflight plus `EditSession`.

## Supported command set

V3 supports exactly these eleven natural-language command types:

1. `move-entity`
2. `move-room`
3. `resize-room`
4. `add-entity`
5. `remove-entity`
6. `add-room`
7. `remove-room`
8. `add-corridor`
9. `remove-corridor`
10. `reconnect-corridor`
11. `set-corridor-doors`

Batch transactions, Event editing, arbitrary code, corridor-width editing, and doorway-offset editing remain unsupported.

## Bounded provider context

The browser sends only the edit request plus these authoring fields.

### Rooms

- `id`
- `x`
- `z`
- `width`
- `depth`

### Entities

- `id`
- `type`
- `roomId`

### Corridors

- `id`
- `fromRoomId`
- `toRoomId`
- `width`
- `kind`
- `fromSide`
- `toSide`

No Events, renderer objects, renderer route meshes, Play/Run state, credentials, files, persistence data, or account identifiers are added.

## Structured-output envelope

The provider returns one strict object with every field present:

- `type`
- `entityId`
- `roomId`
- `x`
- `z`
- `width`
- `depth`
- `entityType`
- `corridorId`
- `fromRoomId`
- `toRoomId`
- `fromSide`
- `toSide`

Unused fields must be `null`.

Existing Room/Entity/Corridor identifiers are schema-enumerated from the bounded context.

Endpoint sides are one of:

- `north`
- `east`
- `south`
- `west`
- `null` for automatic routing

## Deterministic server-side IDs

The provider never creates new object identifiers.

For `add-entity`, the adapter allocates:

`<type>-ai-NNN`

For `add-room`, the adapter allocates:

`room-ai-NNN`

For `add-corridor`, the adapter allocates:

`corridor-ai-NNN`

The first free ID in lexical numeric order is used.

## Structural validation

The provider adapter independently rejects:

- invented existing Room/Entity/Corridor IDs;
- Start/Goal removal;
- removal of a Room containing Start or Goal;
- Room coordinates outside ±256;
- Room dimensions outside 4–32;
- overlapping `add-room` geometry;
- Corridor self-loops;
- duplicate unordered Corridor endpoint pairs;
- invalid cardinal sides;
- no-op move/resize/reconnect/door-side changes;
- unsupported extra fields or command types.

The browser then performs the existing structural preflight before mutation:

`provider validation → applyCommand() → createDungeonScenePlan() preflight → EditSession.apply()`

DungeonSpec validation therefore remains authoritative for topology and Start→Goal reachability, while renderer routeability is checked before structural mutation is committed.

## Undo / Redo

All V3 outputs are existing `EditCommand` values. Existing inverse-command behavior remains authoritative:

- Room creation/removal;
- Corridor creation/removal;
- Corridor reconnection;
- cardinal door-side edits;
- prior V2 Room/Entity edits.

No special AI-only undo stack exists.

## Privacy / security

- OpenAI requests use `store: false`.
- `OPENAI_API_KEY` remains server-side only.
- one command is returned per request;
- provider output is strict-schema constrained and independently validated;
- browser context remains bounded;
- Function errors are sanitized and use `Cache-Control: no-store`;
- Events, runtime state, renderer data, and arbitrary files are not outbound.

Because V3 adds bounded Corridor topology to the outbound authoring context, DAI-074 must be rerun before the replacement candidate can be published.

## Acceptance

Owner-local acceptance gate:

`npm run validate:dai-100-ai-edit-structural`

The gate includes:

1. Cloud Intent / Natural Edit unit tests;
2. Editor Core command tests;
3. hosting Function tests;
4. prior five-command browser regression;
5. six-command structural visible-Chrome smoke;
6. production build;
7. DAI-074 secret/privacy re-audit;
8. Owner UI regression;
9. syntax validation;
10. git diff/whitespace check.

The structural browser smoke verifies:

`add Room → Undo/Redo → add Corridor → Undo/Redo → set door sides → Undo/Redo → reconnect Corridor → Undo/Redo → remove Corridor → Undo/Redo → remove Room → Undo/Redo`

with Start eligibility and validation remaining green throughout.
