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

## Second visual pass after first screenshot review

The first visible-Chrome screenshots passed the automated layout gates but still showed too much developer-oriented chrome and insufficient Play emphasis.

The second pass therefore adds:

- brighter neutral application surfaces while keeping the 3D viewport visually dominant;
- routine `ready` / selection-none / edit-status text hidden;
- Undo/Redo hidden outside the Edit workflow;
- `✓ Valid` / `! Fix N` instead of the longer validation sentence;
- Play stats compressed to `👣 moves` and `🗺 mapped`;
- a spatial 3×3 exit pad instead of a horizontal "Exits" strip;
- stronger visual weight for unknown exits than already-explored exits;
- a cyan current-room floor ring;
- a closer Play/Result camera fit;
- concise viewport labels: `Explore / Auto-map` and `Cleared / Run complete`;
- a dedicated success banner for Result;
- previous Result state forcibly hidden when a new Play run begins.

These changes remain presentation-only around the shared generation/rendering core. Fog-of-war state remains renderer-independent.

## Third visual pass

The second screenshot set confirmed that Fog-of-War, current-room emphasis, compact metrics, and the first spatial exit pad were working, but three presentation issues remained:

- the 318 px Play/Result rail wasted viewport width;
- the exit pad was visually larger than necessary;
- emoji metrics were platform-dependent and less legible than intended.

The third pass changes presentation only:

- Play/Result now use the 3D viewport at full workspace width;
- the Play/Result status panel becomes a compact top-right overlay;
- the Edit toolbar exists only in the Edit workflow;
- Help / Return-to-Edit move into the main header;
- the exit pad shrinks from 168 px to roughly 138 px;
- Play metrics use stable glyphs `↠` (moves) and `▦` (mapped rooms) rather than emoji;
- the Play camera pulls back slightly to retain more exploration context;
- Result keeps the compact overlay and stronger `✓ CLEARED` banner.

The overlay retains pointer access only on the status card itself, leaving the 3D surface unobstructed elsewhere.

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
