# DAI-098 — Multi-floor Simulation / Balance Validation

Date: 2026-09-23 JST
Branch: `feat/dai-098-multi-floor-simulation-balance`

2026-10-04追記: 以下は2026-09-23の歴史的受け入れ記録。現行70%罠回避へ移行した後、同じfixtureの3階damage12でsafe方針も死亡し、最終統合の期待値と不整合になった。現在はSeed/ID/失敗rollを維持し、最後の罠だけdamage9へ調整した検証fixtureを使う。runtimeは変更していない。修正理由・生死境界の回帰・今回の検証範囲は[現行ルールへのfixture整合](SIMULATION_FIXTURE_CURRENT_RULES_2026-10-04.md)を参照。

## Scope

DAI-098 extends the deterministic simulation stack from one DungeonSpec to a complete DungeonRunSpec.

Accepted scope:

- Run Core-backed multi-floor simulation;
- exact PlayerState carry across floors;
- real combat simulation through `resolveEnemyCombat()`;
- HP / MaxHP / XP / Gold / Level / equipment progression;
- floor-by-floor and whole-run metrics;
- authored hazard damage progression;
- observed reach / clear / HP-pressure signals;
- descriptive bottleneck floor;
- run-level DesignIntent fit;
- descriptive-only targetDifficulty proxy excluded from observableFitScore.

## Acceptance command

```powershell
.\scripts\run-dai-098-validation.ps1
```

Final result:

```text
[DAI-098] ALL ACCEPTANCE GATES PASSED.
```

## Acceptance gates

All 13 gates passed on the owner Windows/Chrome environment:

1. Tracked JavaScript syntax gate
2. Complete production Node suite
3. DAI-060 single-floor simulator
4. DAI-061 built-in agents
5. DAI-062 simulation metrics
6. DAI-063 intent fit
7. DAI-064 explainable summary
8. DAI-094 progression / loot
9. DAI-095 multi-floor Run Core
10. DAI-098 multi-floor simulation / balance
11. Multi-floor browser regression
12. Public-doc truthfulness audit
13. Git whitespace / error-marker check

## DAI-098 focused evidence

The fixed 3-floor acceptance fixture uses increasing authored damage pressure:

- Floor 1: Enemy 3 + Trap 4
- Floor 2: Enemy 4 + Trap 8
- Floor 3: Enemy 5 + Trap 12

The acceptance evidence compares deterministic safe, treasure/recovery, and risk policies and verifies:

- safe run clears all three floors;
- treasure run clears all three floors;
- risk run reaches Floor 3 and fails there;
- PlayerState carry is exact between floors;
- HP attrition is observed through real combat/trap runtime;
- XP / Gold / Level / loot / equipment progression carry across floors;
- aggregate policy outcomes are deterministic;
- Floor 3 is identified as the descriptive bottleneck;
- authored hazard damage pressure increases by floor;
- observed pressure signals are available;
- run-level DesignIntent fit covers every floor;
- targetDifficulty remains a descriptive proxy only;
- repeated runs are deterministic;
- authoring DungeonRunSpec remains unchanged.

## Acceptance

DAI-098 is accepted as DONE.
