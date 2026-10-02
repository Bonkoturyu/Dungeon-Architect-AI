# DesignIntent v1 — Production Contract

## Core axes

All values are normalized to `0..1`.

- `fairness`
- `tension`
- `exploration`
- `greedPunishment`
- `routeChoice`
- `learnability`

## Supporting axes

- `combatDensity`
- `trapDensity`
- `rewardDensity`
- `deception`
- `telegraphStrength`
- `backtracking`
- `targetDifficulty`

## Semantic calibration

Provider translation uses the following meanings for the normalized axes:

- `fairness`: avoidable/predictable treatment rather than arbitrary punishment;
- `tension`: sustained pressure, fear, or urgency;
- `exploration`: incentive for optional discovery and detours;
- `greedPunishment`: how strongly pursuing optional or tempting rewards increases risk, cost, or danger;
- `routeChoice`: amount of meaningful branching;
- `learnability`: how well observation or prior failure lets the player improve;
- `combatDensity`: frequency of enemy/combat encounters;
- `trapDensity`: frequency of traps/hazards;
- `rewardDensity`: frequency and availability of meaningful rewards or tempting reward opportunities;
- `deception`: misleading cues, bait, false safety, or deliberately obscured risk;
- `telegraphStrength`: clarity of warnings before danger;
- `backtracking`: amount of returning through already visited spaces;
- `targetDifficulty`: overall intended challenge.

`0.5` is reserved for genuinely neutral/moderate intent. Clear directional wording should move the relevant axis meaningfully away from `0.5`.

Greed/reward wording is calibrated independently from deception: explicit consequences for optional/tempting rewards are a strong positive `greedPunishment` signal; prominent recurring rewards/treasure raise `rewardDensity`; `deception` rises only when bait, misleading cues, false safety, hidden risk, or deliberate trickery are also implied.

## Target duration

`targetDuration` is the expected completion time for one normal playthrough, stored in seconds and validated to `120..1800`.

Interpretation rules:

- an explicit user duration takes priority over qualitative length words and is converted directly to seconds;
- for example, `5 minutes` means approximately `300` seconds rather than a generic medium-length dungeon;
- without an explicit duration, `short` / `brief` requests target approximately `240..420` seconds;
- without an explicit duration, `long` requests target approximately `720..1200` seconds;
- difficulty, content density, or room complexity must not silently redefine the requested duration;
- negation matters: wording such as `not long` must not be interpreted as a request for a long duration.

These are intent-translation semantics. Later generation/simulation may report that a generated dungeon misses the requested target; that must be surfaced as validation or intent-fit evidence rather than changing the requested `targetDuration`.

## MVP safety invariant

`instantDeathAllowed` is always normalized to `false` and a raw validated intent that tries to set it true is rejected with `INSTANT_DEATH_NOT_SUPPORTED`.

This is a product-design constraint for the MVP, not a claim that every generated dungeon is automatically fair. Fairness still requires structural/gameplay validation and later simulation.

## Deterministic fallback

A zero-network fallback parser exists for a limited Japanese/English vocabulary. It recognizes coarse intents such as:

- beginner/easy
- difficult
- greed/treasure
- exploration/detour
- maze/confusion
- scary/low combat
- deceptive/tricky
- fair
- unfair
- short / 5 minutes
- long / 15 minutes

The fallback is not presented as equivalent to an LLM. It exists so the browser experience can still produce normalized intent when a cloud/local provider is unavailable.
