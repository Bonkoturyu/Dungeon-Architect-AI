# Judge Quick Start

## Current verified browser surface

The current verified editor/play build opens a valid sample dungeon. It does **not yet expose the initial full-dungeon DESCRIBE → GENERATE prompt surface** in the same screen.

Use this guide to evaluate only the features that are currently production-backed.

## Supported judging environment

- desktop Google Chrome on Windows;
- 1440 × 900 or a comparable desktop viewport;
- mobile/narrow is best-effort only and is not a supported submission target.

## Walkthrough

1. Open the editor/play surface.
2. The four-step Guide opens automatically. Read it or close it.
3. Confirm the toolbar reports `Validation: PASS · Critical 0`.
4. Click a room in the 3D view.
5. Use the Entity inspector to select or move an entity, or add a supported entity.
6. Try the verified natural-language edit:
   ```text
   Move the treasure to the room that contains the goal.
   ```
7. The AI path should return one constrained `move-entity` command; the treasure moves to the Goal room.
8. Undo and Redo are available in Edit mode.
9. Press `START`.
10. In Play mode, click an adjacent room, then the Goal room.
11. Confirm the Result reports a clear.
12. Use **Return to Edit** to restore the authoring view.

## What the current AI edit sends

The browser sends only:

- the natural-language edit request;
- room IDs;
- entity ID / type / room ID.

The server-side Function holds the provider credential. The browser never receives `OPENAI_API_KEY`.

## What not to infer from this build

This walkthrough does not demonstrate:

- initial natural-language full-dungeon generation in the current editor UI;
- mobile support;
- a final Perspective or Combat selection;
- persistent save/accounts;
- Safari or Firefox acceptance.

See [Known Limitations](KNOWN_LIMITATIONS.md).
