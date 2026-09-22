# PlaySession v1 — Production Contract

## START gate

`startPlaySession()` first runs current DungeonSpec validation. Any validation error blocks START and returns `blocked: true`.

A successful START also initializes deterministic player vitality:

- `playerState.hp`
- `playerState.maxHp`
- default MaxHP: `20`

`maxHp` must be a positive safe integer.

## Execution snapshot

A successful START deep-clones the authoring DungeonSpec into an execution snapshot. Later authoring edits cannot mutate the active play session.

Runtime PlayerState, entity states, counters and event history remain separate from the authored DungeonSpec.

## Session state

Current fields include:

- dungeonId / dungeonSeed
- immutable-by-contract snapshot
- status: `playing`, `cleared`, or `failed`
- failureReason
- startedAt / completedAt
- currentRoomId / goalRoomId
- visitedRoomIds
- moves
- `playerState: { hp, maxHp, level, xp, gold, equipment }`
- gameplayState
- event log

## Player vitality

`applyPlayerDamage()` and `applyPlayerHealing()` are immutable PlaySession transitions.

Damage:

- HP never falls below zero;
- `damageTaken` records the amount actually removed from HP;
- HP reaching zero transitions immediately to terminal `failed`;
- terminal reason is `player-defeated`;
- Result reports one death for that terminal reason.

Healing:

- HP never exceeds MaxHP;
- `healingReceived` records the amount actually restored;
- healing cannot revive a finished session.

Current deterministic room-event defaults:

- Enemy combat: `4` damage;
- triggered Trap: `6` damage;
- Recovery: `8` healing.

An entity may supply its own numeric `damage` or `healing` value; the runtime otherwise uses the defaults above.

## Enemy / Trap / Recovery outcomes

Enemy combat uses `resolveEnemyCombat()`:

1. record the first encounter;
2. apply Enemy damage;
3. if the player survives, defeat the Enemy;
4. if the damage is lethal, the run ends and the Enemy remains unresolved.

Trap interaction remains a choice:

- AVOID resolves the Trap without damage;
- RISK / trigger resolves the Trap and applies deterministic damage.

Recovery is one-shot and restores HP up to MaxHP.

All outcomes continue to use the existing gameplay counters and event log rather than creating a second gameplay state system.

## Progression and loot

Player progression is deterministic runtime state:

- Level starts at `1`;
- XP starts at `0`;
- Gold starts at `0`;
- Weapon and Armor equipment slots start empty;
- XP required for the next level is `level × 20`;
- each level-up adds `2` MaxHP and restores up to `2` HP.

Enemy defeat grants deterministic XP + Gold from `dungeonSeed + enemyId + loot table version`.

Treasure OPEN grants deterministic Gold + one loot item from `dungeonSeed + treasureId + loot table version`. Loot is either Weapon or Armor, Tier 1–3. All loot is added to runtime inventory; a higher-tier item automatically replaces the currently equipped item in the matching slot.

Reward generation never mutates the authored DungeonSpec.

## Movement

Movement is permitted only between rooms connected by a runtime-enabled corridor in the execution snapshot.

Movement, room-event resolution and PlayerState transitions are renderer-independent. Rendering, collision and presentation remain separate adapters.

## Result

A finished session produces a Result containing:

- terminal status / failure reason;
- elapsed time;
- moves;
- ordered route and unique visited rooms;
- final / goal room;
- final `playerState`;
- gameplay metrics including interactions, Enemy / Treasure / Trap / Recovery counts, damage, healing, XP earned, Gold earned, level-ups, loot collected and deaths.

The authoring/runtime separation invariant remains unchanged.
