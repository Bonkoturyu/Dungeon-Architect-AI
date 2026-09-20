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

- room add/remove
- corridor add/remove
- door/shortcut commands
- event logic edits
- batch transactions
- natural-language translation for commands other than the first `move-entity` path
