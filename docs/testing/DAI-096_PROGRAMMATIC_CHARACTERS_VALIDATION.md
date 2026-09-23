# DAI-096 — Programmatic Player / Enemy Presentation Validation

Date: 2026-09-23 JST  
Branch: `feat/dai-096-programmatic-characters`

## Scope

DAI-096 replaces abstract runtime character markers with project-authored low-poly Three.js character presentation.

- no external model, texture, animation, or creative asset;
- Enemy keeps its authored Spec ID and existing runtime visibility semantics;
- active Enemy renders as a multi-part low-poly creature;
- defeated/dormant/unexplored Enemy remains governed by the existing runtime visibility rules;
- Player is runtime-only and is not serialized into DungeonSpec;
- Player follows the current Play/Result room;
- Player Level slightly affects body scale;
- equipped Weapon adds blade + guard;
- equipped Armor adds armor presentation including pauldrons;
- Edit mode remains unchanged.

## Acceptance environment

- Windows local repository
- Node.js v24.15.0
- Chrome 153.0.8010.53

## One-command acceptance

Command:

```powershell
.\scripts\run-dai-096-validation.ps1
```

Final result:

```text
[DAI-096] ALL ACCEPTANCE GATES PASSED.
```

The 13-step acceptance runner completed successfully, including:

1. Renderer Three tests
2. Play Core tests
3. Run Core tests
4. Renderer Three browser smoke
5. DAI-093 player stats
6. DAI-094 progression + loot
7. DAI-095 multi-floor runtime
8. DAI-096 programmatic character smoke
9. DAI-095 multi-floor browser smoke
10. Room-event browser smoke
11. Owner UI regression smoke
12. Hosting build
13. Legal/provenance regression

## Dedicated DAI-096 browser smoke

`npm run smoke:programmatic-characters`

Result: `passed: true`

Verified:

- Player visible at Play start;
- Player follows the current room;
- Enemy uses the multi-part programmatic body;
- defeated Enemy disappears;
- loot updates Player presentation;
- Player presentation matches equipped PlayerState;
- console/page/request/HTTP error arrays are empty.

Observed Player start presentation:

- room: `room-001`
- Level 1
- Weapon Tier 0
- Armor Tier 0
- base body includes boots, legs, torso, head, arms, and crest.

Observed Enemy presentation:

- Spec ID: `enemy-1`
- room: `room-005`
- body includes feet, legs, torso, head, arms, two horns, and face.

After Enemy clear, no Enemy character remained rendered for that defeated Spec ID.

Observed loot presentation:

- HP 16/20
- Level 1
- XP 9
- Gold 14
- Weapon: Tier 1
- Armor: none
- Player rendering added `weapon-blade` and `weapon-guard`.

## Visual review

Owner-provided visible screenshots were reviewed.

Accepted observations:

- Player and Enemy are visibly distinct low-poly character silhouettes rather than abstract character pins;
- Enemy is visible together with the Room Event interaction surface before clear;
- the defeated Enemy is absent after clear;
- Player remains visible in the current room after loot;
- the overall Play HUD / Room Event / exit-control layout remains intact.

Character scale is intentionally compact relative to the room and can be revisited as presentation polish later; it is not a DAI-096 acceptance blocker.

## Provenance

DAI-096 uses only project-authored primitive geometry and color/material constants.

No new third-party creative asset was introduced.

## Acceptance

DAI-096 is accepted as DONE.

Next planned task: DAI-097 — Audio presentation.
