# Production Test Plan

## Core

- DesignIntent schema validation
- DungeonSpec serialization
- Seed reproducibility
- ID uniqueness
- broken-reference rejection
- Start→Goal reachability
- edit-command reversibility
- START gate severity handling

## Prompt regression

At minimum test:

1. beginner / short dungeon
2. short-dangerous vs long-safe
3. greed punishment
4. scary but low combat
5. first run hard, second run learnable
6. mean but fair
7. confusing but not boring
8. contradictory prompt
9. unsupported request
10. unexpected language/input format

## Browser

- primary Chromium browser
- Edge recheck
- Firefox/Safari where supported
- fresh profile/browser
- WebGPU available/unavailable paths where relevant

## Release gates

- Critical validation errors: 0 in release fixtures
- known crash: 0 on primary demo path
- secret scan: pass
- legal registers: complete for shipped dependencies/assets
- fresh-browser demo: pass
- <3-minute demo path: repeatable
