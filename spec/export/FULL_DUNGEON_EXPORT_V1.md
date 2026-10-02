# Full Dungeon JSON Export v1

## Contract

The Full export does not invent another dungeon schema.

It serializes the current authored floors as the existing **DungeonRunSpec v1** contract:

```json
{
  "schemaVersion": "1.0",
  "id": "dungeon-export",
  "floors": [
    {
      "id": "floor-01",
      "dungeon": {
        "schemaVersion": "1.0",
        "id": "generated-...",
        "seed": 123,
        "rooms": [],
        "corridors": [],
        "entities": [],
        "events": []
      }
    }
  ]
}
```

Each `floors[].dungeon` is a complete validated `DungeonSpec v1`.

## Why reuse DungeonRunSpec

- single and multi-floor exports use one contract;
- no duplicate Full-export schema to maintain;
- all DungeonSpec entities/events remain intact;
- existing DungeonRunSpec validation remains the compatibility boundary;
- future import can reuse the same parser/validator path.

## Determinism

Like Generic Layout export, Full export contains no export timestamp.

If the authored floors and export ID are unchanged, serialized output is stable.

## Intended consumers

- Dungeon Architect AI re-import;
- test fixtures;
- game-specific adapters;
- external tools that want full entities/events;
- archival/reproduction of an authored generated dungeon.

For engine-agnostic room-pattern reuse, prefer `DungeonLayoutExchange v1`.


## Import / round-trip

Dungeon Architect AI can import Full JSON through the same `DungeonRunSpec v1` and `DungeonSpec v1` validators used by runtime code.

The importer preserves complete Floor Dungeon data, then runs renderer-routeability preflight before replacing Editor state.

For valid files produced by this exporter:

`Full export → import → Full export`

is byte-stable when the same run export ID is used.

See `JSON_IMPORT_V1.md`.
