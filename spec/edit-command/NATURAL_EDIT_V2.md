# Natural-language Edit V2

## Status

DAI-100 implementation candidate. Acceptance pending owner-local validation and later live/public provider verification.

## Goal

Expand the original DAI-053 one-command `move-entity` path without weakening the proven safety boundary.

The V2 provider still returns **exactly one** structured command per request.

## Supported natural-language command set

- `move-entity`
- `move-room`
- `resize-room`
- `add-entity`
- `remove-entity`

Room/corridor creation/removal, corridor reconnection/door-side edits, event edits, batch transactions, and arbitrary code remain unsupported.

## Bounded provider context

The browser sends only:

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

No corridors, events, renderer objects, Play/Run state, credentials, files, account identifiers, or browser persistence are added to the request.

## Structured-output envelope

The provider returns one strict object with all fields present:

- `type`
- `entityId`
- `roomId`
- `x`
- `z`
- `width`
- `depth`
- `entityType`

Fields not used by the selected command must be `null`.

Existing IDs are constrained to exact context enums.

## Server-side materialization

For `add-entity`, the model does not choose the new entity ID.

It selects:

- an existing room ID;
- one of `enemy | treasure | trap | recovery`.

The adapter then deterministically allocates the first free:

`<type>-ai-NNN`

and materializes the ordinary core:

```json
{
  "type": "add-entity",
  "entity": {
    "id": "recovery-ai-001",
    "type": "recovery",
    "roomId": "room-middle"
  }
}
```

## Validation

Independent adapter validation rejects:

- unsupported command types;
- missing/extra fields;
- invented existing room/entity IDs;
- Start/Goal removal;
- Start/Goal co-location through move-entity;
- no-op entity movement;
- no-op room movement;
- no-op resize;
- room coordinates outside ±256;
- room width/depth outside 4–32;
- unsupported add-entity types.

The browser then applies the returned ordinary `EditCommand` through the same manual editor preflight/application path.

This preserves:

- DungeonSpec validation;
- renderer/route preflight for structural room changes;
- immutable EditSession application;
- Undo/Redo;
- selection synchronization.

## Privacy/security

- OpenAI requests remain `store: false`.
- `OPENAI_API_KEY` remains server-side only.
- provider errors are sanitized by the Pages Function.
- the full prompt is not stored in repository evidence.
- DAI-074 is reopened because room geometry is a new documented outbound data field.

## Acceptance sequence

1. cloud-intent unit tests;
2. editor-core tests;
3. hosting Function tests;
4. deterministic visible-Chrome V2 browser smoke covering all five commands + Undo;
5. production hosting build;
6. DAI-074 secret/privacy audit;
7. syntax / whitespace checks;
8. later live-provider semantic regression against a deployed replacement candidate;
9. DAI-090-style unexpected-prompt regression rerun before final freeze.
