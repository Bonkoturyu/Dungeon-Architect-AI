# DAI-087 Room Events / Play Meaning

## Status

**DONE.**

## Why this exists

The hackathon asks for plain-language input to become interactive 3D scenes with working logic, not only static geometry.

DAI-085/086 made generated dungeons explorable with Fog of War, mapping, Test Play, and Mystery Play. The remaining weakness was that the integrated browser Play surface mostly exposed movement, while the existing Play Core already implemented enemy and interaction runtime behavior.

DAI-087 surfaces those existing runtime systems without adding a second game engine.

## Room-event rules

When the player enters an explored room:

- **ENEMY — CLEAR**
  - uses existing enemy encounter + defeat runtime;
  - unresolved active enemies block exits.
- **TRAP — AVOID / RISK**
  - uses existing trap resolution runtime;
  - unresolved armed traps block exits;
  - RISK is recorded through the existing trapsTriggered counter.
- **CHEST — OPEN**
  - optional;
  - uses existing treasure runtime and supported event dispatch.
- **REST — USE**
  - optional;
  - uses existing recovery runtime.

No arbitrary generated runtime code is introduced.

## Result

The existing renderer-independent Result metrics are surfaced compactly:

- ENEMY = enemiesCleared
- CHEST = treasuresOpened
- TRAP = trapsTriggered

## Scope boundary

This is intentionally a compact interactive proof of generated working logic, not an attempt to turn the hackathon submission into a full roguelike.

The shared path remains:

```text
DesignIntent
  ↓
existing Generator
  ↓
DungeonSpec
  ↓
PlaySession snapshot
  ↓
existing enemy / interaction / event runtime
  ↓
browser Room Event presentation
```

## Validation

```powershell
npm run smoke:room-events
```

Expected:

- `artifacts/room-events/dai-087-room-events.json`;
- `artifacts/room-events/room-event-blocked.png`;
- `artifacts/room-events/room-event-result.png`.

The browser smoke discovers generated event rooms from the actual snapshot rather than relying on fixed room IDs.


## Accepted evidence

The visible-Chrome smoke passed and human visual review was accepted on 2026-09-20.

Reviewed evidence SHA-256:

- JSON: `cce73710c00fb228540b6f6f376a60c260a41ad64a1bb3576de2def52fba2724`;
- blocked-event PNG: `8b593827b9c061bcf620163c3cc44f402cdadde0b6e7f2fa14318fe90079f055`;
- result PNG: `4a0ae39005c44fc9c7ce37d0ba6cbdb8ef26f36892243c391238c1112fd5cc5d`.

The reviewed blocked-event capture made the active Enemy and exit-blocking state legible. The Result capture surfaced explored topology and compact interaction counters cleanly. The smoke evidence reported empty console/page/request/HTTP error collections.
