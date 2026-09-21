# EditCommand v1 — Production Contract

## Purpose

Authoring UI must not mutate DungeonSpec directly. Supported edits are expressed as explicit commands and produce a new validated Spec plus an inverse command.

## Supported v1 commands

### `move-room`

```json
{ "type": "move-room", "roomId": "room-001", "x": 12, "z": 24 }
```

### `move-entity`

```json
{ "type": "move-entity", "entityId": "enemy-1", "roomId": "room-004" }
```

Start and Goal may be moved through this command, but validation rejects placing them in the same room.

### `resize-room`

```json
{ "type": "resize-room", "roomId": "room-004", "width": 10, "depth": 14 }
```

### `add-entity`

Generic add supports non-protected entity types. Start/Goal cannot be created through this generic command.

### `remove-entity`

Generic remove cannot remove Start/Goal.

### `add-room`

```json
{
  "type": "add-room",
  "room": { "id": "room-editor-001", "x": 36, "z": 12, "width": 8, "depth": 8 }
}
```

### `remove-room`

```json
{ "type": "remove-room", "roomId": "room-editor-001" }
```

A room containing Start or Goal is protected. Removing another room also removes its incident corridors, non-protected entities, and events that reference those removed objects. The resulting DungeonSpec must still validate, including Start→Goal reachability.

### `add-corridor`

```json
{
  "type": "add-corridor",
  "corridor": {
    "id": "corridor-editor-001",
    "fromRoomId": "room-002",
    "toRoomId": "room-editor-001",
    "width": 3,
    "kind": "manual"
  }
}
```

### `remove-corridor`

```json
{ "type": "remove-corridor", "corridorId": "corridor-editor-001" }
```

Removal is rejected when the resulting DungeonSpec would make Goal unreachable.

### `set-corridor-doors`

```json
{
  "type": "set-corridor-doors",
  "corridorId": "corridor-001",
  "fromSide": "north",
  "toSide": "south"
}
```

Each endpoint may be `north`, `east`, `south`, `west`, or `auto`/null. The renderer's orthogonal router honors explicit endpoint sides and continues routing around room interiors.

`restore-room` and `restore-corridor` are internal inverse commands used by Undo/Redo; they are not exposed as ordinary authoring actions.

## Natural-language translation boundary

Natural-language authoring does not bypass `EditCommand`.

The first DAI-053 MVP path translates one natural-language request into exactly one existing `move-entity` command. The provider receives a bounded context containing only current room IDs and entity ID/type/location triples. Structured output is constrained to exact current IDs, independently validated, and then passed to the normal `EditSession.apply()` boundary.

The natural-language translator:

- cannot emit arbitrary code;
- cannot mutate DungeonSpec directly;
- cannot invent entity or room IDs;
- cannot emit multiple commands in the first MVP path;
- rejects no-op moves;
- remains behind the backend/provider boundary so browser code never receives the provider secret.

The browser edit stays undoable/redoable because the translated result is an ordinary `move-entity` command.

## Invariants

- source Spec is not mutated
- result must pass current DungeonSpec validation
- every successful command returns an inverse command
- failed commands return an error and no new Spec
- undo/redo uses the same command boundary
- a new edit clears the redo stack
- natural-language edits must become supported explicit commands before application

## Not yet supported

- corridor width editing
- doorway offset editing along a wall (v1 structural UI selects the cardinal wall side only)
- shortcut/event logic editing from the manual UI
- batch transactions
- natural-language translation for commands other than the first `move-entity` path
