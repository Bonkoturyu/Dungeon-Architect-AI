# DAI-095 — Multi-floor DungeonRunSpec Validation

Date: 2026-09-22 JST  
Branch: `feat/dai-095-multi-floor-run`

## Scope

DAI-095 adds a sequential multi-floor run layer over the existing DungeonSpec / PlaySession contracts:

- `DungeonRunSpec v1` with 1–10 floors;
- one DungeonSpec rendered and played at a time;
- independent per-floor EditSession / undo state;
- Floor selector in Edit;
- Test always starts from Floor 1;
- Goal completion advances to the next floor;
- HP / MaxHP / Level / XP / Gold / Weapon / Armor carry exactly between floors;
- floor-local GameplayState remains isolated;
- any floor failure terminates the whole run;
- multi-floor Mystery preserves floor count and adopts every generated floor on return to Edit;
- Result and Play UI expose `FLOOR n/N`;
- whole-run validation participates in the START gate.

## Acceptance environment

- Windows local repository
- Node.js v24.15.0
- Chrome 153.0.8010.53

## One-command acceptance

Command:

```powershell
.\scripts\run-dai-095-validation.ps1
```

Result:

```text
[DAI-095] ALL ACCEPTANCE GATES PASSED.
```

All 19 gates passed.

## Gate results

1. Generator tests — 18/18 passed
2. Play Core tests — 47/47 passed
3. Run Core tests — 6/6 passed
4. Simulation Core tests — 24/24 passed
5. DAI-030 session state — passed
6. DAI-031 enemy runtime — passed
7. DAI-032 interaction runtime — passed
8. DAI-033 event logic — passed
9. DAI-034 clear/failure/result — passed
10. DAI-060 simulator — passed
11. DAI-062 simulation metrics — passed
12. DAI-093 player stats — passed
13. DAI-094 progression + loot — passed
14. DAI-095 multi-floor runtime — passed
15. START-gate browser smoke — passed
16. Exploration UX browser smoke — passed
17. DAI-095 multi-floor browser smoke — passed
18. Room-event browser smoke — passed
19. Owner UI regression smoke — passed

## DAI-095 runtime validation

`npm run validate:multi-floor-run`

Result: `passed: true`

Verified:

- one-floor compatibility;
- 10-floor maximum accepted;
- progression applied before transition;
- exact Floor 1 → Floor 2 PlayerState carry;
- exact Floor 2 → Floor 3 PlayerState carry;
- Weapon and Armor equipment persistence;
- three-floor run clear;
- final PlayerState matches the last floor;
- failed floor stops the run;
- authoring DungeonSpecs remain unchanged.

Observed carry example:

```text
Floor 1 final:
HP 15/22
LV 2
XP 5
G 12
Weapon T3
Armor —

Floor 2 start:
HP 15/22
LV 2
XP 5
G 12
Weapon T3
Armor —
```

After Floor 2:

```text
HP 15/22
LV 2
XP 12
G 17
Weapon T3
Armor T2
```

The same state was carried exactly into Floor 3.

## Multi-floor browser validation

`npm run smoke:multi-floor-run`

Result: `passed: true`

Verified:

- three floors generated;
- generated floor IDs unique;
- generated floor seeds unique;
- Floor selector changes the active floor;
- editing one floor does not mutate another;
- Test always starts at Floor 1;
- progression PlayerState carries exactly to Floor 2;
- three-floor run clears;
- Result shows `FLOOR 3/3`;
- Test Play does not mutate authoring;
- Mystery keeps three floors;
- Mystery Return adopts all three floors;
- browser console/page/request/HTTP error arrays are empty.

Observed generated floors:

```text
Floor 1: generated-303179986
Floor 2: generated-303179986-floor-02
Floor 3: generated-303179986-floor-03
```

Observed browser carry:

```text
Floor 1 final → Floor 2 start
HP 12/20
LV 1
XP 18/20
G 9
```

Final run Result example:

```text
FLOOR 3/3
HP 2/22
LV 2
XP 28/40
G 28
```

## Regression coverage

Existing one-floor behavior remains green:

- START gate;
- immutable execution snapshot;
- Exploration UX;
- Room Events;
- player stats;
- progression / loot;
- simulator and metrics;
- owner-accepted UI/UX;
- five-language switching;
- Mystery → Edit adoption;
- direct room/corridor editing.

No browser console, page, request, or HTTP errors were observed in the DAI-095 browser smoke or Owner UI smoke.

## Acceptance

DAI-095 is accepted as DONE.

Next planned task: DAI-096 — Programmatic player/enemy presentation.
