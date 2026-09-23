# Play UI Stack Layout — Owner Follow-up

Date: 2026-09-23 JST

## Purpose

Refine the Play-mode UI hierarchy after DAI-096 owner visual review.

The target is the owner-provided layout reference:

- room/gameplay dialogs occupy the viewport center;
- directional exit controls sit at the lower center;
- player progression/status readout sits immediately below the directional controls;
- errors appear over the room/gameplay dialogs at the viewport center.

## Play bottom HUD

The visible Play status order is fixed to:

1. `LV`
2. `HP current/max`
3. `EXP current/required`
4. `G`

Example:

```text
LV 1   HP 20/20   EXP 0/20   G 0
```

`MOVE`, `MAP`, and `FLOOR` remain available as internal/diagnostic state but are not part of the visible bottom status strip.

The status strip:

- uses a readable dark backplate;
- uses a larger monospace readout than the previous right-side Play panel;
- is centered horizontally in the viewport;
- stays near the bottom edge.

## Direction controls

`CHOOSE EXIT` and the directional pad sit immediately above the status strip.

The existing directional semantics remain unchanged:

- north/up;
- east/right;
- south/down;
- west/left;
- known/unexplored exit styling.

If a blocking room event prevents leaving, the exit control remains hidden as before.

## Room event stack

Room-local actionable content is presented as a centered dialog stack.

Examples:

- Enemy;
- Chest/Treasure;
- Trap;
- Recovery.

Requirements:

- the stack is centered in the 3D viewport;
- each event is an independent dialog card;
- cards retain their actions and blocking semantics;
- visible card order follows the authored entity order, providing a stable "earlier first" order;
- the stack has a readable backplate;
- the stack may scroll vertically if the room contains many events.

## Error layer

Errors use the viewport notice surface but change presentation while in Play/Result:

- centered in the viewport;
- higher z-index than Room Event dialogs;
- opaque/readable dark-red backplate;
- assertive alert semantics;
- does not replace or reorder the underlying event stack.

Edit-mode blocked-operation notices retain their previously accepted lower-center placement.

## Result scope

This follow-up changes Play-mode hierarchy.

The existing Result panel remains separate and is not moved into the bottom Play HUD.

## Acceptance

Automated acceptance must verify:

- bottom HUD centered near the viewport bottom;
- directional controls immediately above status;
- visible status order exactly `LV, HP, EXP, G`;
- status font size is readable;
- status backplate is non-transparent;
- Room Events are centered;
- Room Events stack in deterministic authored order;
- Room Event backplate is non-transparent;
- Error notice is centered and has a higher z-index than Room Events;
- Error notice has a readable backplate;
- existing Room Events, multi-floor, programmatic-character, Owner UI, and hosting regressions remain green.

Primary focused smoke:

```text
npm run smoke:play-ui-stack-layout
```

One-command acceptance:

```powershell
.\scripts\run-play-ui-stack-layout-validation.ps1
```
