# DAI-061 Deterministic Agents

## Status

**IN PROGRESS.** The first three deterministic simulation agents are implemented and await production Node evidence.

DAI-061 runs on the DAI-060 simulation core and intentionally keeps behavior policy separate from gameplay/runtime implementation.

## Implemented policies

- `shortest-path`: minimum-hop Goal route;
- `treasure-greedy`: detours to reachable unresolved treasure before Goal;
- `cautious`: uses a deterministic hazard-weighted Goal route and resolves a Trap safely if already forced into its room.

The policies are deterministic probes, not claims about human behavior.

## Contrast fixture

`spec/simulation/fixtures/agent-contrast-v1.json` provides three meaningful choices from Start:

- a two-move hazardous route to Goal;
- a three-move safe route;
- a three-move treasure route.

Expected policy behavior:

- shortest-path: `room-start -> room-hazard -> room-goal`;
- treasure-greedy: `room-start -> room-treasure -> room-safe-2 -> room-goal`, opening `treasure-side`;
- cautious: `room-start -> room-safe-1 -> room-safe-2 -> room-goal`, avoiding `room-hazard`.

## Production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-061-agents; git pull --ff-only origin feat/dai-061-agents; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-061-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` hash;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node suite;
4. runs all three agents twice on the same contrast fixture;
5. verifies deterministic equality and expected behavioral contrast;
6. writes `artifacts/agents/dai-061-agents.json`.

## Completion gate

Do not mark DAI-061 DONE until:

- complete production Node tests pass;
- all three agents clear the contrast fixture without step-limit termination;
- shortest-path uses the minimum-hop hazardous route;
- treasure-greedy opens the side treasure before Goal;
- cautious avoids the hazardous room when a safe alternative exists;
- all three agents reproduce identical results on an immediate rerun;
- all three routes are behaviorally distinct on the contrast fixture;
- source DungeonSpec remains unchanged;
- generated JSON evidence is reviewed.

## Explicit non-goals

DAI-061 does not yet:

- aggregate cross-agent metrics (DAI-062);
- compute DesignIntent fit scores (DAI-063);
- produce explainable summaries (DAI-064);
- model stochastic/human behavior;
- add browser simulation UI.
