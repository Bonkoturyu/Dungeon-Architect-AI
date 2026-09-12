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

## Generator contract now available

The production generator can create:

- deterministic room graph from Seed
- guaranteed backbone Start→Goal route
- optional alternate edges based on `routeChoice`
- deterministic serpentine grid layout
- Start/Goal entities

The same inputs are byte-stable within the current schema/generator implementation.

## Current non-goals

- key/door dependency validation
- event semantic validation
- risk/safety semantics on alternate routes
- runtime state
- renderer-specific objects
- persistence migration
