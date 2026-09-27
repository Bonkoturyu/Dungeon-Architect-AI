# DAI-100 — Final Polish / Judge Experience

## Status

**ACTIVE — JSON export and the first Motion / feedback slice are accepted; Priority D follow-up remains.**

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

Owner-local acceptance is complete as of 2026-09-26 JST. Evidence covers Generator tests 21/21, the exhaustive 300-case routeability matrix with 60 unique spatial layouts and zero failures, production hosting build, Generator V2 browser provenance, Exploration/Mystery, Multi-floor isolation/progression, Owner UI regression, syntax validation, and git diff checks. The final Owner UI fix changed only smoke/test code after the exhaustive runtime matrix, so the accepted Generator V2 runtime itself did not change between exhaustive and final UI evidence.

Generator V1 spatial embedding is deterministic serpentine placement for a given room count. That limits the visual effect of different prompts.

Do not silently change Generator V1 semantics. Introduce any materially new layout method under a new generator version or an explicitly versioned presentation transform.

Targets:

- more than one deterministic seed-driven spatial composition;
- room-size variation where valid;
- stronger Start/Goal/treasure/trap/recovery visual distinction;
- prompt/DesignIntent-driven atmosphere without implying mechanics that are not implemented;
- improved lighting, fog/depth, floor/readability, and event focus;
- no external creative asset unless separately reviewed and licensed.

## Priority C.5 — Generator Strategy / Algorithm Lab

Started on 2026-09-26 JST.

The next generator phase is no longer a single replacement algorithm. The product should expose:

- Version 1 — Classic;
- Version 2 — Recommended;
- Algorithm Lab strategies such as BSP, Delaunay + MST + Loops, Rooms + Mazes, Random Walk, Cellular Automata, Maze Carving, Gameplay Graph, and WFC.

A loose-coupled library boundary has been introduced before wiring the selector into the application:

- `packages/generator-strategy-core/` — implementation-neutral request/result contract and registry;
- `packages/generator/src/strategies/v1-classic.js` — frozen V1 adapter;
- `packages/generator/src/strategies/v2-recommended.js` — accepted V2 adapter;
- `packages/generator/src/strategy-catalog.js` — composition root and Recommended alias.

Algorithm Core requirements:

- pure-data / JSON-compatible input-output;
- explicit Seed and Algorithm Version;
- no DOM / Three.js / Editor / Play / network dependency;
- Algorithm-native IR is allowed behind an Adapter;
- valid DungeonSpec remains the application-facing output;
- architecture must remain suitable for later npm package, WASM, DLL/.so/.dylib wrappers.

Documentation is maintained in paired Markdown + HTML under:

`docs/generator-algorithms/`

Strategy Core / V1-V2 equivalence validation passed locally on 2026-09-26 JST: Strategy Core 3/3, Generator 24/24, syntax validation 172 files PASS, and git diff check PASS.

The application selector wiring has now started. Version 2 remains the default Recommended strategy; Version 1 remains the frozen Classic strategy. Algorithm Lab entries will be registered through the same catalog as their independent Core packages are implemented.

Generator Strategy selector local browser acceptance passed on 2026-09-26 JST. The visible-Chrome smoke verified that the selector is visible, both V1 Classic and V2 Recommended are registered/listed, V2 is selected by default, V1 and V2 dispatch to the expected generator versions, the same Prompt keeps the same deterministic Seed across strategies, V1/V2 produce different spatial embeddings, both outputs remain Start-eligible, the DesignIntent request shape remains unchanged, and browser/request errors are absent.

The integrated `validate:dai-100-generator-v2:fast` gate also passed 10/10 on 2026-09-26 JST at commit `59f2b236ac4bdda156a8adacd3fdd5a35b62474c`. It covered Strategy Core, Generator versioning, production hosting build, Owner UI, Generator selector, Generation surface, Exploration/Mystery, Multi-floor, syntax validation, and git diff/whitespace checks.

Follow-up Generator-selector localization acceptance also passed on 2026-09-26 JST at `38e2a6df87b9371892eb14f35cad63b97333d25a`: Owner UI PASS with `allFiveLanguagesSwitchLive: true`, exact Generator/Recommended labels verified for EN/JA/zh-Hans/zh-Hant/KO, syntax validation PASS across 173 files, and git diff check PASS.

### First Algorithm Lab Core — Delaunay + MST + Loops

Implementation has started under `packages/generator-algorithms/delaunay-mst/`.

The reusable Core is intentionally independent from Dungeon Architect AI application layers:

- no DOM / Three.js / Editor / Play / provider dependency;
- explicit deterministic Seed;
- project-authored scatter, Bowyer-Watson Delaunay triangulation, Kruskal MST, and bounded loop restoration;
- algorithm-native plain-data output;
- internal connectivity / duplicate-edge / room-overlap invariants;
- suitable for later npm/WASM/DLL-style wrapping.

The application-specific Adapter lives separately at `packages/generator/src/strategies/delaunay-mst-lab.js`. It maps the Core IR to DungeonSpec and, for this first gate, reuses the frozen V1 DesignIntent content/profile mapping so entity/event semantics remain stable while topology changes.

Dedicated Markdown + HTML documentation is available at:

- `docs/generator-algorithms/DELAUNAY_MST.md`
- `docs/generator-algorithms/DELAUNAY_MST.html`

The first Core/Adapter acceptance gate passed locally on 2026-09-27 JST at `a603bd7b0586e726ba22ad078b77fa38a285a07c`: reusable Core tests 8/8 PASS, Generator/Algorithm Lab adapter tests 29/29 PASS, syntax validation 181 files PASS, and git diff/whitespace checks PASS.

After that gate, the Delaunay strategy was registered into the Product Strategy catalog while Version 2 remains the default Recommended strategy.

Product-level acceptance passed locally on 2026-09-27 JST at `4b25ab70b484489d2ed45f249d32bbd6f878b282` via `npm run validate:dai-100-delaunay-mst`:

- reusable Core: 8/8 PASS;
- Generator / Algorithm Lab adapter suite: 29/29 PASS;
- 150-case Delaunay renderer routeability matrix: 150/150 PASS with 30 unique spatial layouts and zero failures;
- production hosting build: PASS;
- Owner UI / five-language selector regression: PASS;
- V1 / V2 / Delaunay Product selector smoke: PASS;
- Delaunay three-floor Test + Mystery browser flow: PASS;
- syntax validation: 183 files PASS;
- git diff / whitespace check: PASS.

Renderer evidence recorded 133 strict routes and 17 cases using the existing `crossing-fallback` router mode. This is accepted for the experimental Algorithm Lab strategy because all 150 cases remained valid and renderable, but it remains a visual-quality optimization target rather than a correctness blocker.

The previous Windows `DEP0190` warning in the Delaunay acceptance runner was also removed by switching its npm subprocess execution to the same `npm_execpath` / Node spawning model used by the other DAI-100 validators.

### Second Algorithm Lab Core — BSP

Implementation has started under `packages/generator-algorithms/bsp/` after Delaunay Product acceptance.

The reusable BSP Core is independent from application/runtime layers and produces a BSP-native IR:

```text
Root bounds
→ Binary partition tree
→ Leaf regions
→ One Room per leaf
→ Sibling-subtree tree links
→ Bounded optional extra links
```

Current properties:

- explicit deterministic Seed;
- Room count = leaf count;
- BSP tree edge count = `N - 1`;
- Room placement remains inside its partition leaf;
- Room overlap, duplicate-edge, and connectivity invariants fail closed;
- `routeChoice` is adapted to bounded `extraConnectionRatio`;
- no DOM / Three.js / Editor / Play / provider dependency in the Core;
- application-specific DungeonSpec mapping remains in `packages/generator/src/strategies/bsp-lab.js`;
- V1 frozen DesignIntent content/profile mapping is reused only in the Adapter to keep gameplay-content semantics stable for algorithm comparison.

Detailed paired documentation:

- `docs/generator-algorithms/BSP.md`
- `docs/generator-algorithms/BSP.html`

BSP Core/Adapter acceptance passed locally on 2026-09-27 JST at `eec6772fff3aecc2383a28b51b0385aebacad509`:

- BSP reusable Core: 8/8 PASS;
- Generator / BSP Algorithm Lab adapter suite: 33/33 PASS;
- syntax validation: 190 files PASS;
- git diff / whitespace check: PASS.

BSP is registered in the Product Strategy catalog while Version 2 remains the default Recommended strategy.

Functional Product acceptance passed locally on 2026-09-27 JST at `573f1f7c64d7d7f29606acc86a385b0ec631e4fe` through the expanded `npm run validate:dai-100-bsp` gate:

- BSP reusable Core: 8/8 PASS;
- Generator / BSP Algorithm Lab adapter suite: 33/33 PASS;
- 150-case renderer routeability matrix: 150/150 PASS, 30 unique spatial layouts, zero failures;
- production hosting build: PASS;
- Owner UI / five-language selector regression: PASS;
- V1 / V2 / Delaunay / BSP selector dispatch: PASS;
- BSP three-floor Test + Mystery browser flow: PASS;
- syntax validation: 192 files PASS;
- git diff / whitespace check: PASS.

BSP final functional + performance acceptance passed locally on 2026-09-27 JST at commit `9046a3a676e7988d74bc04196654e00091d0bb3c`.

The directional `fromSide` / `toSide` hints in the BSP Adapter removed the pathological wall-side search cost. The final 9-step `npm run validate:dai-100-bsp` gate passed end-to-end:

- reusable BSP Core: 8/8 PASS;
- Generator / BSP Algorithm Lab adapter suite: 34/34 PASS;
- 150-case Renderer routeability matrix: 150/150 PASS, 30 unique spatial layouts, zero failures;
- matrix duration: `229,665 ms` in the full acceptance run, down from the original `5,454,108 ms`;
- routing modes: 86/150 `crossing-fallback`, 64/150 strict;
- worst observed case in the repeated full run: `15,107 ms`;
- production hosting build: PASS;
- Owner UI / five-language selector regression: PASS;
- V1 / V2 / Delaunay / BSP selector dispatch: PASS;
- BSP three-floor Test + Mystery browser flow: PASS;
- syntax validation: 192 files PASS;
- git diff / whitespace check: PASS.

BSP is therefore **functional + performance accepted** as an Algorithm Lab strategy. The remaining 10–15 second long-tail cases and the 86/150 `crossing-fallback` rate are retained as non-blocking renderer / visual-quality follow-ups. Version 2 remains the Recommended/default Product strategy.

## Priority C.75 — JSON export / pattern interchange

Implemented candidate after Generator Algorithm Lab acceptance.

Two JSON export surfaces are defined:

1. **DungeonLayoutExchange v1** — generic, engine-independent pattern/layout format containing Floors, Room geometry, graph connections, Seed, Start/Goal roles, coordinate convention, and generator provenance while omitting game-specific Enemy/Treasure/Trap/Recovery/Event data.
2. **Full Dungeon JSON** — reuses the existing `DungeonRunSpec v1` with complete `DungeonSpec v1` data per Floor instead of creating a duplicate full-export contract.

Format material:

- `spec/export/DUNGEON_LAYOUT_EXCHANGE_V1.md`
- `spec/export/DUNGEON_LAYOUT_EXCHANGE_V1.schema.json`
- `spec/export/FULL_DUNGEON_EXPORT_V1.md`
- `spec/export/examples/layout-exchange-v1.example.json`

Implementation:

- reusable `packages/export-core/`;
- deterministic pretty-printed JSON with no timestamps;
- current edited authoring state can be exported, not only the initial generated result;
- multi-floor export is one file in both modes;
- Create panel exposes `Layout JSON` and `Full JSON` downloads;
- visible-Chrome download smoke verifies actual downloaded files;
- integrated local gate: `npm run validate:dai-100-json-export`.

Owner-local acceptance passed on 2026-09-27 JST at `a10f5bb8cddc06157d97b58541281908a9c3faca` through `npm run validate:dai-100-json-export`.

Acceptance evidence:

- Export Core tests: 4/4 PASS;
- production hosting build: PASS;
- visible-Chrome actual-download smoke: PASS;
- Generic Layout filename/version contract: PASS (`*.layout.v1.json`);
- Full Dungeon filename/version contract: PASS (`*.dungeon-run.v1.json`);
- Generic `DungeonLayoutExchange v1`: 2-floor export PASS with generator provenance, XZ coordinate contract, Start/Goal roles, and no game-specific entity/event collections;
- Full export: 2-floor `DungeonRunSpec v1` PASS with complete `DungeonSpec v1` payloads;
- downloaded files exactly matched the in-memory export APIs;
- browser console/page/request/HTTP errors: none;
- Motion / feedback smoke: PASS on the same runtime;
- Owner UI regression smoke: PASS;
- syntax validation: 198 files PASS;
- git diff / whitespace check: PASS.

The JSON export / pattern interchange phase is therefore **accepted**.

## Priority D — Motion / feedback

First presentation-only slice implemented after BSP acceptance:

- short Generation reveal on the concealed authored-preview card;
- short viewport camera-settle presentation on Test/Mystery start and Return Edit;
- no gameplay-Core changes;
- logical Three.js camera fit remains synchronous so picking/dragging semantics stay stable;
- Room selection continues to avoid automatic recenter/transition;
- `prefers-reduced-motion` disables the CSS presentation animations;
- dedicated visible-Chrome smoke: `npm run smoke:dai-100-motion-feedback`;
- integrated local gate: `npm run validate:dai-100-motion-feedback`.

Owner-local acceptance passed on 2026-09-27 JST. The dedicated `validate:dai-100-motion-feedback` gate passed first, and the same Motion / feedback smoke passed again inside the later JSON-export gate at `a10f5bb8cddc06157d97b58541281908a9c3faca`.

Accepted invariants:

- Generation reveal presentation is active while the authored layout remains concealed;
- Room selection does not trigger a transition or recenter the camera;
- Test start uses the short viewport camera-settle transition;
- Return Edit uses the same presentation transition;
- browser errors are absent;
- Owner UI regression remains green.

This first presentation-only Motion / feedback slice is therefore **accepted**.

Second presentation-only slice implemented:

- Room-event panel gets a short intro emphasis only when its entity signature changes;
- blocking event cards receive a brief pulse without changing interaction semantics;
- Combat, Treasure, Trap and Recovery actions show short non-blocking HUD feedback;
- multi-floor advance shows a Floor-clear feedback pill;
- final clear/fail state shows a Result feedback pill;
- all feedback is DOM/CSS presentation only and does not alter Play Core;
- `prefers-reduced-motion` disables the new animations;
- dedicated gate: `npm run validate:dai-100-event-feedback`.

This second slice is **pending owner-local acceptance**.

Remaining targets:

- Player/Enemy idle or encounter motion if performance remains acceptable;
- Result transition continuity beyond the accepted feedback pill;
- any further camera/focus polish that can be added without changing gameplay semantics.

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
