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

The original DAI-053 MVP translated one natural-language request into exactly one existing `move-entity` command.

DAI-100 AI Edit V2 keeps the **single-command** boundary but expands the safe translation set to:

- `move-entity`;
- `move-room`;
- `resize-room`;
- `add-entity`;
- `remove-entity`.

The provider receives only bounded authoring context:

- rooms: `id`, `x`, `z`, `width`, `depth`;
- entities: `id`, `type`, `roomId`.

The structured provider output is a fixed command envelope. Existing IDs must come from the exact context enums. For `add-entity`, the model does **not** invent an ID: it returns a supported entity type plus an existing room ID, and the server deterministically allocates an `*-ai-NNN` ID before returning the ordinary core `add-entity` EditCommand.

The natural-language translator:

- cannot emit arbitrary code;
- cannot mutate DungeonSpec directly;
- cannot invent existing entity or room IDs;
- cannot remove Start/Goal;
- cannot create Start/Goal;
- cannot emit more than one command;
- bounds room coordinates and dimensions;
- rejects no-op movement/resizing;
- keeps room/corridor creation, corridor edits, event edits, and batch transactions unsupported;
- remains behind the backend/provider boundary so browser code never receives the provider secret.

The browser applies the translated command through the same editor command/preflight path as manual authoring. Successful AI edits therefore remain undoable/redoable and structural room edits must also pass the normal renderer/route preflight before mutation.

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
- natural-language room creation/removal
- natural-language corridor creation/removal/reconnection
- natural-language doorway-side editing
- natural-language event-logic editing
- multi-command natural-language transactions
