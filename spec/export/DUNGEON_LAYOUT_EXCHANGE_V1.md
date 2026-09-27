# DungeonLayoutExchange v1 — Generic Layout JSON Contract

## Status

DAI-100 generic interchange/export format.

This format is intentionally smaller and more game-agnostic than `DungeonSpec`. It is intended for procedural-layout reuse, external tools, prototyping, algorithm comparison, Unity / Unreal / Godot import adapters, and other pattern-generation workflows.

It does **not** replace `DungeonSpec`.

## Design goals

- deterministic JSON: the same authored state and provenance produce byte-stable pretty-printed output;
- multi-floor from the first version;
- renderer-independent;
- engine-independent;
- no AI provider/network/runtime objects;
- preserve geometry and graph connectivity;
- keep only the generic semantic roles `start` / `goal`;
- omit Dungeon Architect AI-specific Enemy / Treasure / Trap / Recovery / Event semantics.

## Required top-level fields

- `schema`: exactly `"dungeon-layout-exchange"`
- `schemaVersion`: exactly `"1.0"`
- `id`: non-empty export identifier
- `source`: provenance object
- `coordinateSystem`: fixed coordinate convention
- `floors`: one or more floors

## Source

Required:

- `application`: `"Dungeon Architect AI"`
- `dungeonSpecVersion`: `"1.0"`

Optional when known:

- `generatorStrategyId`
- `generatorVersion`
- `algorithmVersion`

Prompt text and DesignIntent are intentionally excluded from the generic format.

## Coordinate system

Version 1 is fixed to:

```json
{
  "plane": "XZ",
  "units": "abstract",
  "roomPosition": "center",
  "roomSize": "full-extent",
  "positiveX": "east",
  "positiveZ": "south"
}
```

A Room `x/z` pair is the Room center. `width/depth` are full extents, not half extents.

No Y/elevation information is represented in v1.

## Floors

Each floor contains:

- `id`: stable exchange floor identifier such as `floor-01`
- `index`: zero-based floor index
- `dungeonId`: source DungeonSpec ID
- `seed`: source DungeonSpec Seed
- `rooms`
- `connections`

## Rooms

Each Room contains:

- `id`
- `x`
- `z`
- `width`
- `depth`
- `roles`: zero or more of `start`, `goal`

Other DungeonSpec entity types are deliberately omitted.

Example:

```json
{
  "id": "room-001",
  "x": 12,
  "z": 8,
  "width": 8,
  "depth": 9,
  "roles": ["start"]
}
```

## Connections

Each connection is derived from a DungeonSpec corridor.

Required:

- `id`
- `fromRoomId`
- `toRoomId`
- `width`
- `enabled`

Optional when present in the source:

- `kind`
- `fromSide`
- `toSide`

`fromSide` / `toSide` values are `north | east | south | west`.

The exchange format preserves graph endpoints and endpoint-side preferences, but does not serialize renderer-computed orthogonal route points.

## Determinism

The exporter does not write timestamps, random export IDs, browser information, or environment paths.

For the same:

- authored DungeonSpec floors;
- export ID;
- generator provenance;

the pretty-printed JSON output is byte-stable.

## Generic vs Full export

Use **DungeonLayoutExchange** when the consumer wants a reusable procedural pattern or room graph.

Use **Full Dungeon Export** when the consumer needs Dungeon Architect AI entities, events, warnings, progression-related source fields, or exact DungeonSpec semantics.

See `FULL_DUNGEON_EXPORT_V1.md`.

## Versioning

`DungeonLayoutExchange.schemaVersion` versions this exchange format only.

It is independent from:

- `DungeonSpec.schemaVersion`;
- Generator Version;
- Generator Strategy ID;
- Algorithm Version.

A future coordinate/elevation/module representation requires a new exchange schema version rather than silently changing v1 semantics.
