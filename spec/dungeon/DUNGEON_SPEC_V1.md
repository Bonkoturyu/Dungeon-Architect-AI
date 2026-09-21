# DungeonSpec v1 — Production Contract

## Status

Clean-room production contract. No Pre experiment implementation is copied.

## Required top-level fields

- `schemaVersion`: `1.0`
- `id`: non-empty string
- `seed`: non-negative safe integer
- `rooms`: array
- `corridors`: array
- `entities`: array
- `events`: array

## Rooms

- `id`
- `x`, `z`
- `width`, `depth` > 0

## Corridors

- `id`
- `fromRoomId`
- `toRoomId`
- `width` > 0

Both room references must exist; a corridor cannot connect a room to itself.

## Entities

MVP v1 types:

- start
- goal
- enemy
- treasure
- trap
- recovery

Each entity requires a stable ID and valid room reference.
Exactly one Start and one Goal are required.

## Stable IDs

Room, corridor, entity and event IDs share one global namespace in v1. Duplicate IDs are rejected.

## Reachability

Current Core validation builds an undirected adjacency graph from valid corridor references and rejects a Goal room that cannot be reached from the Start room with `GOAL_UNREACHABLE`.

This is structural reachability only. Key/door/event-condition soft locks are handled by later validation tasks.

## Renderer independence

Serialized DungeonSpec does not contain renderer objects, DOM nodes, Unity objects, GPU handles, scene nodes or runtime session references.

## Generator versioning

`DungeonSpec.schemaVersion` describes the serialized data contract. It is **not** the generator algorithm version.

The current generation method is frozen as **Generator Version 1** under:

`packages/generator/src/versions/v1/`

Future generation algorithms are added as Version 2, Version 3, etc. without overwriting V1. See:

- `docs/architecture/GENERATOR_VERSIONS.md`
- `docs/research/DUNGEON_GENERATION_ALGORITHMS.md`

## Generator contract now available

The production **Generator Version 1** can create:

- deterministic room graph from Seed
- guaranteed backbone Start→Goal route
- deterministic alternate route choices based on `routeChoice`
- deterministic serpentine grid layout
- Start/Goal entities

### Multiple-route constraints

For Generator Version 1:

- `routeChoice` remains normalized to `[0, 1]`;
- alternate-route capacity is `max(1, floor(roomCount / 3))`;
- requested alternate count is `round(routeChoice * capacity)`;
- the generator produces that exact alternate count for every supported room count (`3..64`);
- every alternate edge reconnects two rooms already on the backbone rather than creating a disconnected/dead-end branch;
- alternate edges skip at least one backbone room and span at most four backbone steps;
- duplicate/self/adjacent alternate edges are not generated;
- increasing `routeChoice` for the same Seed/roomCount preserves the lower-choice alternate set as a deterministic prefix;
- each alternate edge adds one independent graph cycle, so a positive alternate count yields multiple Start→Goal route choices while retaining the guaranteed backbone.

These constraints are structural. They do not yet assign risk, reward, safety, trap, combat, or semantic quality to one route versus another.

The same inputs are byte-stable within the current schema/generator implementation.

## Current non-goals

- key/door dependency validation
- event semantic validation
- risk/safety semantics on alternate routes
- route quality / intent-fit scoring
- runtime state
- renderer-specific objects
- persistence migration
