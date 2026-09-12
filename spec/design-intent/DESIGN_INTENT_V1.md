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

`targetDuration` is stored as seconds and normalized to 120..1800.

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
