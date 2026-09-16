# DAI-060 Deterministic Simulator Core

## Status

**IN PROGRESS.** The renderer-independent simulation core is implemented and awaits production Node evidence.

M6 requires a simulation core before the shortest/greedy/cautious agent policies and intent-fit metrics are added.

## Architecture

DAI-060 deliberately reuses the existing Play Core rather than implementing a parallel approximation of gameplay.

`simulateDungeon()`:

1. validates and starts the Dungeon through `startPlaySession()`;
2. builds a plain-data observation from the current runtime state;
3. asks a policy callback for one bounded action;
4. applies that action through existing Play Core functions;
5. records a deterministic trace;
6. stops on clear/failure or at a fixed step limit;
7. returns the real `PlayResult` plus final gameplay state.

The policy never receives a mutable PlaySession reference.

## Supported action boundary

The first simulator action vocabulary is:

- movement;
- enemy encounter/defeat;
- treasure inspect/open;
- trap inspect/avoid/trigger;
- recovery use;
- stop.

Unsupported actions fail closed.

## Determinism and bounding

The simulator contains no RNG. Same Spec + same deterministic policy + same options must produce the same trace/result.

`maxSteps` defaults to `256` and is hard-limited to `10000`. A policy loop that reaches the step limit terminates with simulation reason `step-limit` and the fixed Play failure reason `stopped`.

## Production validation

Run from the Windows clone:

```powershell
git fetch origin; git switch feat/dai-060-simulator-core; git pull --ff-only origin feat/dai-060-simulator-core; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-060-validation.ps1
```

The runner:

1. verifies the audited `package-lock.json` hash;
2. installs the exact reviewed dependency graph with scripts disabled;
3. runs the complete production Node test suite, including simulation-core tests;
4. runs deterministic DAI-060 evidence scenarios;
5. writes `artifacts/simulator/dai-060-simulator.json`.

## Evidence scenario

The primary scripted policy uses a three-room fixture and drives the real runtime through:

`Start -> Middle -> encounter enemy -> defeat enemy -> open treasure -> avoid trap -> use recovery -> Goal`

Expected terminal evidence includes:

- cleared status;
- exactly two room moves;
- three rooms visited;
- one enemy cleared;
- one treasure opened;
- zero traps triggered;
- one recovery used;
- three interactions.

The evidence runner also verifies:

- an identical rerun produces an identical simulation object;
- a looping policy is bounded by `maxSteps`;
- an unsupported action is rejected;
- the source authoring Spec remains unchanged.

## Completion gate

Do not mark DAI-060 DONE until:

- complete production Node tests pass;
- the primary simulation reaches the expected cleared Result through real Play Core actions;
- deterministic repeat evidence matches exactly;
- the loop scenario terminates at the step limit;
- invalid actions fail closed;
- source authoring state is unchanged;
- generated JSON evidence is reviewed.

## Explicit non-goals

DAI-060 does not yet add:

- shortest/greedy/cautious policy implementations (DAI-061);
- cross-agent metrics aggregation (DAI-062);
- DesignIntent fit scoring (DAI-063);
- explainable simulation summary (DAI-064);
- browser simulation UI.
