# DAI-100 — Final Polish / Judge Experience

## Status

**ACTIVE — Audio Polish implementation complete, acceptance pending.**

DAI-099 remains the accepted rollback candidate. DAI-100 is a new replacement-candidate track for presentation and judge-experience improvements. It must not silently mutate the frozen DAI-099 identity.

Base:

- commit: `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3`
- rollback: `rollback/submission-candidate-dai-099-2026-09-24`
- public runtime-source SHA-256:
  `dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`

DAI-090 20/20 and the DAI-091 pre-public exposure audit are retained as release gates to rerun after the new runtime stabilizes.

## Why this exists

The current candidate is functionally complete and safe to publish, but there is still schedule available before submission. The remaining opportunity is not basic correctness; it is stronger judge-facing polish, clearer AI authorship, stronger scene variation, and more memorable presentation.

## Priority A — Audio / presentation polish

### Implemented in the first DAI-100 pass

- Programmatic Audio V2 with deterministic long-form motifs for Edit / Play / Cleared / Failed;
- ~0.45 second BGM mode crossfades;
- stronger authored transition/event cue voicings;
- separate BGM and SE runtime gains;
- compact header mixer with BGM/SE sliders;
- multilingual mixer labels;
- no persistence and no external audio assets;
- updated unit/browser smoke coverage;
- one-command acceptance runner: `npm run validate:dai-100-audio`.

Specification:

`spec/audio/PROGRAMMATIC_AUDIO_V2.md`

This phase is **not accepted yet** until the owner-local validation and listening/visual review pass.

Current DAI-097 audio is intentionally minimal:

- Edit: two-voice ambient pad
- Play: two-voice tense ambient pad
- Result clear: three-voice consonant pad
- Result fail: two-voice low pad
- synthesized one-shot cues
- one mute toggle

DAI-100 should make this feel like deliberate game music rather than an acceptance placeholder while preserving the zero-external-asset boundary.

Target:

- distinct musical motifs for Edit / Explore / danger-combat / cleared / failed;
- smooth crossfades instead of abrupt mode replacement;
- stronger but still low-volume dungeon ambience;
- separate BGM and SE volume controls if UI remains compact;
- event-sensitive intensity changes without mutating Play Core;
- keep Web Audio / project-authored synthesis so no new music-license burden is introduced.

## Priority B — AI Edit V2

### Implemented candidate

The first DAI-100 AI Edit V2 pass is now implemented with the existing single-command safety boundary.

Supported natural-language commands:

- `move-entity`;
- `move-room`;
- `resize-room`;
- `add-entity`;
- `remove-entity`.

The provider receives bounded room geometry (`id/x/z/width/depth`) plus entity `id/type/roomId`. Existing IDs are schema-enumerated. New entity IDs are allocated server-side as deterministic `*-ai-NNN` IDs, so the provider never invents them.

Structural room edits are routed through the same editor preflight used by manual authoring, and successful AI edits remain Undo/Redo compatible.

Specification:

`spec/edit-command/NATURAL_EDIT_V2.md`

Deterministic visible-Chrome coverage exercises all five browser application paths. One-command validation:

`npm run validate:dai-100-ai-edit`

Owner-local acceptance passed on 2026-09-26 JST: Cloud-intent 32/32, Editor Core 30/30, Hosting 14/14, visible-Chrome five-command smoke PASS, production build PASS, DAI-074 secret/privacy re-audit PASS, syntax PASS, and git diff check PASS. Live-provider/public semantic verification remains a replacement-candidate deployment gate.

The manual Editor already supports more than the AI path:

- move-room
- resize-room
- add/remove room
- add/remove/reconnect corridor
- set corridor door sides
- move/add/remove entity

The current cloud AI adapter is still hard-coded to exactly one `move-entity` command.

DAI-100 should expand natural-language authoring only through existing validated `EditCommand` boundaries.

First safe target set:

1. `move-entity`
2. `move-room`
3. `resize-room`
4. `add-entity`
5. `remove-entity`

Corridor and room creation/removal remain a second gate because they have larger reachability and ID-generation implications.

Requirements:

- one command per request initially;
- strict schema;
- no arbitrary code;
- no invented existing IDs;
- bounded context only;
- independent validation before `EditSession.apply()`;
- Undo/Redo preserved;
- unsupported requests fail closed.

## Priority C — Scene variation / visual identity

### Implemented candidate — Generator V2 spatial variation

Generator V2 is now registered under `packages/generator/src/versions/v2/` without modifying the frozen V1 implementation.

The DAI-100 browser candidate explicitly uses V2 while the library default remains V1 for regression/reproduction.

V2 preserves V1 graph/gameplay semantics but adds Seed-driven:

- column-count variation;
- 12/13/14 spacing variation;
- eight rotation/mirror orientations;
- first-row serpentine direction variation;
- deterministic 7–9 × 7–9 Room dimensions.

A dedicated acceptance matrix covers multiple Seeds × room counts × routeChoice values and requires both DungeonSpec validity and renderer scene-plan routeability.

One-command validation:

`npm run validate:dai-100-generator-v2`

This phase is **not accepted yet** until the owner-local matrix and browser regressions pass.

Generator V1 spatial embedding is deterministic serpentine placement for a given room count. That limits the visual effect of different prompts.

Do not silently change Generator V1 semantics. Introduce any materially new layout method under a new generator version or an explicitly versioned presentation transform.

Targets:

- more than one deterministic seed-driven spatial composition;
- room-size variation where valid;
- stronger Start/Goal/treasure/trap/recovery visual distinction;
- prompt/DesignIntent-driven atmosphere without implying mechanics that are not implemented;
- improved lighting, fog/depth, floor/readability, and event focus;
- no external creative asset unless separately reviewed and licensed.

## Priority D — Motion / feedback

Improve perceived quality without creating a second gameplay engine:

- camera easing / focus transitions;
- room-event emphasis;
- short generation reveal;
- Player/Enemy idle or encounter motion if performance remains acceptable;
- combat/loot/floor-clear feedback;
- Result transition and return-to-edit continuity.

## Explicit non-goals for the first DAI-100 pass

- physics locomotion;
- first-person or third-person controller;
- arbitrary runtime code generation;
- unrestricted multi-command AI editing;
- external paid asset dependency;
- mobile support expansion;
- persistence/accounts.

## Acceptance strategy

DAI-100 is accepted only after:

1. unit/runtime regressions remain green;
2. visible Chrome polish smoke passes;
3. owner visual/audio review accepts the result;
4. public build/deployment smoke passes;
5. legal/privacy/pre-public audits rerun;
6. DAI-090 unexpected prompts are rerun against the replacement candidate;
7. a replacement freeze/rollback point is created;
8. final video is recaptured if the judge-visible runtime changed materially.

Until then, DAI-099 remains the safe submission fallback.
