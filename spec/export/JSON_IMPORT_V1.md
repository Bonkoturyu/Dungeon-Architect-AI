# JSON Import / Round-trip v1

## Status

DAI-100 implementation candidate.

This import layer is the inverse boundary for the two accepted JSON export formats:

- `DungeonLayoutExchange v1`;
- Full Dungeon JSON using `DungeonRunSpec v1`.

It does not introduce a third authored schema.

## Entry point

Production import logic lives in:

`packages/export-core/src/layout-exchange.js`

The automatic entry point is:

`importDungeonJson(input)`

It accepts either a JSON string or an already parsed JSON-compatible object and returns a fail-closed result object.

## Supported formats

### DungeonLayoutExchange v1

The importer requires:

- `schema = "dungeon-layout-exchange"`;
- `schemaVersion = "1.0"`;
- the fixed v1 XZ coordinate-system contract;
- 1–10 ordered Floors;
- unique Floor and Dungeon IDs;
- non-negative safe-integer Seeds;
- Room geometry with unique IDs;
- exactly one `start` role and exactly one `goal` role on different Rooms;
- valid Connection endpoints;
- finite positive Connection width;
- boolean `enabled`;
- optional cardinal `fromSide/toSide`;
- no unknown top-level/Floor/Room/Connection fields.

Layout import intentionally reconstructs only the generic semantics contained in the format:

- Rooms;
- Corridors;
- Start;
- Goal.

Enemy / Treasure / Trap / Recovery / Event semantics cannot be reconstructed because Layout JSON deliberately omits them.

Imported Start/Goal Entity IDs are generated deterministically as collision-free `layout-start-NNN` / `layout-goal-NNN` IDs.

### Full Dungeon JSON

Full import accepts the existing `DungeonRunSpec v1` envelope only:

- exact top-level `schemaVersion/id/floors` fields;
- exact Floor `id/dungeon` envelope;
- each Floor Dungeon must pass the authoritative `validateDungeonSpec()`;
- the overall run must pass `validateDungeonRunSpec()`.

All DungeonSpec data is preserved:

- Rooms;
- Corridors;
- Entities;
- Events;
- warnings and optional authored fields;
- Seed and Dungeon ID.

## Browser/editor integration

The Create panel exposes one **Import JSON** control.

The browser:

1. reads a local `.json` file only after explicit user selection;
2. rejects files larger than 2 MiB;
3. parses JSON with `JSON.parse`;
4. detects Layout vs Full;
5. validates every Floor;
6. runs `createDungeonScenePlan()` for every imported Dungeon before changing Editor state;
7. replaces all Floor `EditSession` instances only after every preflight passes;
8. returns to Edit mode;
9. resets selection, Play/Run state, Result state, structural draft state, and Undo/Redo history;
10. preserves only supported Layout provenance fields for subsequent generic re-export.

If any parse, schema, DungeonSpec, RunSpec, or renderer-routeability check fails, the current authored state is not replaced.

## Security boundary

Import does not execute imported text.

There is no:

- `eval`;
- `Function` constructor;
- dynamic script insertion;
- imported module loading;
- HTML execution;
- arbitrary file execution.

Imported IDs and status messages are handled as data through the existing UI and renderer paths.

Unknown Layout fields fail closed.

The browser import file-size cap is 2 MiB.

## Round-trip guarantees

### Layout

For JSON produced by the v1 exporter:

`export Layout → import Layout → export Layout`

is byte-stable when the same export ID and source provenance are used.

Because Layout is intentionally generic, Dungeon Architect AI-specific Entities/Events are not part of that guarantee.

### Full

For valid Full JSON:

`export Full → import Full → export Full`

preserves the complete DungeonSpec data and is byte-stable when the same run export ID is used.

## Editor-after-import guarantee

After a successful import, the resulting Dungeon opens through the same Editor Core / renderer / Start Gate used for generated or manually authored dungeons.

A successful import is not a read-only snapshot. Normal Room/Corridor/Entity editing can continue immediately, with a fresh Undo/Redo history.

## Acceptance

Dedicated gate:

`npm run validate:dai-100-json-import`

The gate includes:

1. Export / Import Core round-trip tests;
2. existing JSON Export browser regression;
3. JSON Import / round-trip visible-Chrome smoke;
4. Owner UI regression;
5. browser performance regression;
6. production hosting build;
7. syntax validation;
8. git diff / whitespace check.

The browser smoke verifies:

- Import control presence;
- Full import restores a deliberately mutated Dungeon;
- imported Full state remains editable;
- Layout import reduces semantics to Start/Goal as specified;
- Layout re-export is stable;
- invalid Layout input leaves the current Editor state unchanged;
- script-like JSON text is not executed;
- browser/page/request/HTTP errors remain absent.
