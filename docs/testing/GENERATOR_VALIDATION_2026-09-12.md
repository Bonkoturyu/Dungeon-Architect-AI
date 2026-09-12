# Generator / Core Validation — 2026-09-12

## Scope

Production clean-room work for DAI-020, DAI-021, DAI-023 and DAI-025.

## Environment

- Node.js v22.16.0
- npm 10.9.2
- Test runner: built-in `node:test`
- Third-party runtime dependency: none

## Command

```bash
npm test
```

## Result

Core:
- tests: 7
- pass: 7
- fail: 0

Generator:
- tests: 7
- pass: 7
- fail: 0

Total: 14/14 pass.

## Covered

- minimal DungeonSpec validity
- JSON parse error handling
- stable ID uniqueness
- reference validation
- Start/Goal count
- structural Start→Goal reachability
- deterministic room graph
- Seed-sensitive alternate routes
- guaranteed backbone
- non-overlapping default room positions
- generated Spec validates
- routeChoice creates alternate edges
- same inputs produce byte-stable DungeonSpec

## Not covered

- browser rendering
- corridor geometry/walls/doors
- key/door soft locks
- gameplay/runtime
- Edit Mode
- working-logic events
- human UX
