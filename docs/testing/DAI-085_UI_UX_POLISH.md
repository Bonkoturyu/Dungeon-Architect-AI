# DAI-085 UI/UX Polish

## Status

**IN PROGRESS / VISUAL REVIEW REQUIRED.**

This task intentionally occurs after the first DAI-084 freeze. The old frozen candidate and rollback branch remain valid recovery points, but they are no longer the intended final submission candidate once this runtime UI change is accepted.

A new candidate freeze is required after polish is approved.

## Scope

Judge-facing UI/UX polish plus DAI-086 exploration presentation. DesignIntent/DungeonSpec contracts, provider behavior, EditCommand semantics, and simulation semantics remain unchanged. Play gains a renderer-independent visibility/map projection and Mystery Play entry path while continuing to use the same Generator, DungeonSpec, PlaySession, and Three.js renderer.

Primary goals:

- make the 3D dungeon the visual focus;
- establish clear Describe → Validate/Play → Edit → AI Edit hierarchy;
- reduce the dense “developer tool” appearance;
- make current mode and validation state immediately legible;
- hide irrelevant authoring controls during Play/Result;
- preserve all existing DOM IDs and automation paths;
- keep desktop Chrome as the supported submission target;
- keep narrow/mobile as best-effort;
- make Play exploratory: hide unvisited topology, auto-map visited rooms/corridors, and expose exits without revealing Goal location;
- provide Test Current and fresh-seed Mystery Play.

## First polish pass

### Header / toolbar

- stronger Dungeon Architect AI branding;
- explicit Edit / Play / Result mode badge;
- room/entity selections rendered as compact chips;
- validation rendered as a state pill;
- START receives primary-action hierarchy;
- history/mode/help actions grouped by purpose.

### 3D viewport

- viewport fills remaining application height without magic pixel subtraction;
- 3D view is visually separated from controls;
- lightweight in-canvas instruction overlay;
- mode-aware instructions;
- Play/Result expands the viewport by narrowing the right status rail.

### Authoring rail

- numbered workflow panels;
- short explanatory microcopy;
- Generate emphasized as the first action;
- Validation / Play is visually persistent;
- entity management consolidated into one Manual Edit panel;
- natural-language edit separated as an AI action;
- Play/Result hides all editor-only panels.

### Onboarding

- retained workflow and IDs;
- improved spacing, contrast, and action hierarchy.

## Validation

Run:

```powershell
git fetch origin
git switch feat/ui-ux-polish-2026-09-19
git pull --ff-only origin feat/ui-ux-polish-2026-09-19
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-ui-ux-polish-validation.ps1
```

Expected:

- `artifacts/ui-ux-polish/ui-ux-polish.json`;
- `artifacts/ui-ux-polish/ui-ux-edit.png`;
- `artifacts/ui-ux-polish/ui-ux-play.png`;
- `artifacts/ui-ux-polish/ui-ux-result.png`;
- `artifacts/exploration-ux/dai-086-exploration-ux.json`;
- `artifacts/exploration-ux/test-play-start.png`;
- `artifacts/exploration-ux/test-play-after-one-move.png`;
- `artifacts/exploration-ux/mystery-play-start.png`.

The screenshots require human visual review before merge.

## Candidate-freeze consequence

The historical rollback remains:

`rollback/submission-candidate-m8-2026-09-19`

After UI/UX acceptance, create a new final candidate freeze. Do not move or overwrite the historical rollback ref.
