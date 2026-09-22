# DAI-094 — Level / XP / Equipment / Loot Validation

Date: 2026-09-22 JST  
Branch: `feat/dai-094-progression-loot`

## Scope

DAI-094 extends the DAI-093 PlaySession with deterministic progression and loot:

- Level / XP / Gold in PlayerState;
- Weapon + Armor equipment slots;
- deterministic Enemy XP + Gold rewards;
- deterministic Treasure Gold + Tier 1–3 loot;
- runtime inventory recording;
- automatic replacement by higher-tier equipment;
- Level-up threshold `level × 20 XP`;
- +2 MaxHP per Level-up;
- Play HUD progression readout;
- Result and Simulator progression metrics.

## Acceptance environment

- Windows local repository
- Node.js v24.15.0
- Chrome 153.0.8010.53 for browser smoke

## One-command acceptance

Command:

```powershell
.\scripts\run-dai-094-validation.ps1
```

Result:

```text
[DAI-094] ALL ACCEPTANCE GATES PASSED.
```

## Gate results

### 1. Play Core

`npm run test:play`

- tests: 46
- pass: 46
- fail: 0
- cancelled: 0
- skipped: 0

Includes deterministic reward tables, Level-up, MaxHP growth, inventory, auto-equip, PlayerState/Result compatibility, and DAI-093 HP behavior.

### 2. Simulation Core

`npm run test:simulation`

- tests: 24
- pass: 24
- fail: 0
- cancelled: 0
- skipped: 0

Simulator observation and deterministic execution remain compatible with the extended PlayerState.

### 3. Legacy runtime regressions

All passed:

- DAI-031 Enemy runtime;
- DAI-032 Interaction runtime;
- DAI-033 Event logic;
- DAI-060 Simulator;
- DAI-062 Simulation metrics;
- DAI-093 Player stats.

This verifies that Enemy/Treasure reward hooks did not break existing event, interaction, simulation, or HP contracts.

### 4. DAI-094 deterministic validation

`npm run validate:progression-loot`

Result: `passed: true`

Observed deterministic progression fixture:

- 3 Enemy rewards: 11 XP + 8G, 9 XP + 4G, 8 XP + 3G;
- Level-up occurred after accumulated Enemy XP;
- final Level: 2;
- final XP: 8;
- final Gold: 37;
- final MaxHP: 22;
- Weapon: Tier 2;
- Armor: Tier 1;
- XP earned: 28;
- Gold earned: 37;
- Level-ups: 1;
- Loot collected: 2.

Direct PlayResult and Simulator metrics matched, repeated simulation was deterministic, and the authoring DungeonSpec remained unchanged.

### 5. Room-event browser smoke

`npm run smoke:room-events`

Result: `passed: true`

Progression-specific checks passed:

- `progressionMetricsVisible`;
- `progressionRewardsRecorded`;
- Treasure reward text visible;
- Result progression metrics visible;
- browser error arrays empty.

Observed Result example:

```text
HP 12/20
LV 1
XP 17/20
G 22
LOOT 1
WPN T2
ARM —
DMG 8
HEAL 0
ENEMY 2
CHEST 1
TRAP 0
```

### 6. Owner UI regression

`npm run smoke:owner-ui-review`

Result: `passed: true`

All existing owner-approved UI/UX invariants remain green. The extended Play summary remains centered and the editor sidebar has no horizontal overflow.

## Acceptance

DAI-094 is accepted as DONE.

Next planned gameplay-expansion task: DAI-095 — Multi-floor DungeonRunSpec.
