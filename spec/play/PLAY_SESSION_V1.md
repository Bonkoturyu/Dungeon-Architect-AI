# PlaySession v1 — Production Contract

## START gate

`startPlaySession()` first runs current DungeonSpec validation. Any validation error blocks START and returns `blocked: true`.

## Execution snapshot

A successful START deep-clones the authoring DungeonSpec into an execution snapshot. Later authoring edits cannot mutate the active play session.

## Session state

Current minimal fields:

- dungeonId / dungeonSeed
- immutable-by-contract snapshot
- status: `playing` or `cleared` (`failed` reserved for later gameplay)
- startedAt / completedAt
- currentRoomId / goalRoomId
- visitedRoomIds
- moves
- event log

## Movement

The current logical slice permits movement only between rooms connected by a corridor in the execution snapshot.

This is not the final player-control implementation. Rendering, collision and perspective remain separate evidence-gated decisions.

## Result

A finished session can produce a basic Result containing status, elapsed time, moves, visited rooms, final room and goal room.

Later gameplay tasks will add treasure/trap/enemy/event metrics without changing the authoring/runtime separation invariant.
