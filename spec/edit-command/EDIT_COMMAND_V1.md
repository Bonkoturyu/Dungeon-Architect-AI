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

### `add-entity`

Generic add supports non-protected entity types. Start/Goal cannot be created through this generic command.

### `remove-entity`

Generic remove cannot remove Start/Goal.

## Invariants

- source Spec is not mutated
- result must pass current DungeonSpec validation
- every successful command returns an inverse command
- failed commands return an error and no new Spec
- undo/redo uses the same command boundary
- a new edit clears the redo stack

## Not yet supported

- room add/remove
- corridor add/remove
- resize-room
- door/shortcut commands
- event logic edits
- batch transactions
- natural-language command parsing
