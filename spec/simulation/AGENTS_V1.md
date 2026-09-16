# Built-in Simulation Agents v1

## Purpose

DAI-061 adds deterministic policy implementations on top of the DAI-060 simulator. Agents choose from the simulator's bounded action vocabulary; they never mutate DungeonSpec or PlaySession directly.

## Built-in agent IDs

### `shortest-path`

Goal: minimize room moves to Goal.

Behavior:
- ignores optional treasure, recovery, enemy, and trap interactions;
- chooses the minimum-hop route to Goal;
- breaks equal-distance choices lexicographically by room ID;
- returns `stop` if no observed adjacent step can reach Goal.

### `treasure-greedy`

Goal: collect reachable unresolved treasure before finishing.

Behavior:
- opens a treasure when one is present in the current room;
- otherwise routes to the nearest unresolved treasure by hop count;
- ties are broken by treasure ID and then room ID;
- after all reachable treasure is resolved, routes to Goal;
- returns `stop` if no observed adjacent step can reach the current target.

### `cautious`

Goal: reach Goal while preferring lower-hazard routes.

Behavior:
- static room hazard penalty: Trap `+6`, Enemy `+4`;
- route cost is one per move plus room hazard penalty;
- equal-cost choices break by hop count and then room ID;
- if the agent is already in a room with an unresolved Trap, it inspects the Trap first and then avoids it;
- it does not defeat optional Enemies merely to increase progress counters;
- returns `stop` if no observed adjacent step can reach Goal.

## Determinism

All built-in v1 agents are deterministic. Same DungeonSpec + same simulator state + same trace must yield the same next action.

## Boundaries

- no RNG;
- no hidden mutable session reference;
- no arbitrary code generation;
- no cross-agent scoring in this contract;
- no claim that these policies model real humans;
- these are deterministic probes used to expose structural differences in generated dungeons.
