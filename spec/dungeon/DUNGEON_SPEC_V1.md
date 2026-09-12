# DungeonSpec v1 — Production Contract

## Status

Clean-room production contract. This file is not copied from Pre implementation.

## Required top-level fields

- `schemaVersion`: currently `1.0`
- `id`: non-empty string
- `seed`: non-negative safe integer
- `rooms`: array
- `corridors`: array
- `entities`: array
- `events`: array

## Rooms

Required fields:

- `id`
- `x`, `z`
- `width`, `depth` > 0

## Corridors

Required fields:

- `id`
- `fromRoomId`
- `toRoomId`
- `width` > 0

Both room references must exist and a corridor cannot connect a room to itself.

## Entities

MVP v1 types:

- `start`
- `goal`
- `enemy`
- `treasure`
- `trap`
- `recovery`

Each entity has a stable `id` and valid `roomId`.
Exactly one `start` and exactly one `goal` are required.

## Stable IDs

Room, corridor, entity and event IDs share one global namespace in v1. Duplicate IDs are rejected.

## Renderer independence

Serialized DungeonSpec does not contain renderer objects, DOM nodes, Unity objects, GPU handles, scene nodes or runtime session references.

## Current non-goals

- reachability analysis beyond reference integrity
- event trigger/action semantic validation
- runtime state
- rendering-specific material/mesh objects
- persistence migration

Those are added by later tasks without breaking the renderer-independent boundary.
