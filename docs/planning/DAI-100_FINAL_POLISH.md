# DAI-100 — Final Polish / Judge Experience

## Status

**ACTIVE — accepted core remains stable; expanded DAI-100 implementation scope is now active before final release/freeze.**

DAI-099 remains the accepted rollback candidate. DAI-100 is a new replacement-candidate track for presentation and judge-experience improvements. It must not silently mutate the frozen DAI-099 identity.

Base:

- commit: `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3`
- rollback: `rollback/submission-candidate-dai-099-2026-09-24`
- public runtime-source SHA-256:
  `dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`

DAI-090 is now run in two phases. Round 1 is an early regression probe before the remaining DAI-100 implementation work; the final 20/20 run remains a release gate after the runtime stabilizes.

DAI-090 Round 1 passed on 2026-09-28 JST against the hosted Cloudflare production `/api/design-intent` path:

- 20/20 cases returned HTTP 200;
- 20/20 remained schema-valid and bounded;
- Cloud provider selected 20/20;
- fallback selected 0/20;
- semantic constraints: 58/59 passed (98.3051%);
- local API key was not required;
- no secret/full-prompt evidence leak;
- overall gate: PASS with `falseChecks: []`.

The single Round 1 semantic miss was `greed-punishment / deception >= 0.45` with one observed value of `0.30`. A follow-up five-call hosted probe then returned a stable neutral `0.5 / 0.5 / 0.5` for `greedPunishment / rewardDensity / deception`, revealing a broader semantic-calibration weakness rather than a one-off malformed result.

A provider-instruction hardening candidate is now implemented:

- all 13 normalized DesignIntent axes have explicit semantic definitions;
- `0.5` is reserved for genuinely neutral/moderate intent;
- clear directional wording should move relevant axes meaningfully away from neutral;
- greed/reward consequences are explicitly mapped to `greedPunishment`;
- recurring/prominent reward opportunities are mapped to `rewardDensity`;
- `deception` remains separately tied to bait/misdirection/false-safety/hidden-risk wording;
- the strict schema, duration semantics, stateless `store:false` request, and MVP instant-death boundary are unchanged;
- local gate: `npm run validate:dai-100-intent-semantics`.

Owner-local semantic-hardening gate passed on 2026-09-28 JST:

- Cloud Intent / routing / Natural Edit tests: 32/32 PASS;
- syntax validation: PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

The semantic-hardening code is therefore **locally accepted**, while hosted semantic verification remains required after deployment.

DAI-091 pre-public exposure audit remains a release gate.

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

Automated owner-local validation passed on 2026-09-28 JST at `3f38a360971f16d630cdae6975c8e78298b9e6a1` through `npm run validate:dai-100-audio`:

- Audio presentation unit tests: 8/8 PASS;
- DAI-097/100 browser audio smoke: PASS;
- Owner UI regression: PASS;
- production hosting build: PASS;
- legal / provenance audit: PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

Audio V2 remains **pending only the owner listening review** before final acceptance.

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

## Priority B — AI Edit foundation

### Accepted V2 foundation

The first DAI-100 AI Edit V2 pass preserves the single-command safety boundary and supports:

- `move-entity`;
- `move-room`;
- `resize-room`;
- `add-entity`;
- `remove-entity`.

V2 receives bounded Room geometry (`id/x/z/width/depth`) plus Entity `id/type/roomId`. Existing IDs are schema-enumerated. Added Entity IDs are allocated server-side as deterministic `*-ai-NNN` IDs.

Specification:

`spec/edit-command/NATURAL_EDIT_V2.md`

Owner-local V2 acceptance passed on 2026-09-26 JST through `npm run validate:dai-100-ai-edit`: Cloud Intent, Editor Core, hosting Function, five-command visible-Chrome smoke, production build, DAI-074 privacy audit, syntax, and git-diff checks all passed.

Live-provider/public semantic verification remains a replacement-candidate release gate.

### Active V3 structural expansion

The accepted V2 boundary is now being expanded in Priority I through a separately versioned V3 contract. V3 keeps exactly one command per request and reuses the existing manual `EditCommand` / `applyCommand()` / `EditSession` safety path rather than adding an AI-only editing engine.

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

Owner-local acceptance passed on 2026-09-28 JST at `1d9b5a2dabe22a86cec6f64545726bd62c198de1` through `npm run validate:dai-100-event-feedback`.

The 7-step gate passed end-to-end:

- production hosting build: PASS;
- Event feedback visible-Chrome smoke: PASS;
- Room Event gameplay regression smoke: PASS;
- Motion / feedback regression smoke: PASS;
- Owner UI regression smoke: PASS;
- syntax validation: 200 files PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

Accepted presentation invariants include:

- Room-event intro emphasis without shifting the panel away from the viewport center;
- blocking Combat/Trap resolution feedback;
- Treasure feedback;
- Floor-advance feedback across a two-floor run;
- final Result feedback;
- two-floor run completion;
- no browser console/page/request/HTTP errors;
- existing Room Event gameplay semantics unchanged.

This second presentation-only Motion / feedback slice is therefore **accepted**.

Remaining targets:

- Player/Enemy idle or encounter motion if performance remains acceptable;
- Result transition continuity beyond the accepted feedback pill;
- any further camera/focus polish that can be added without changing gameplay semantics.

## Expanded DAI-100 implementation scope — 2026-09-28

The remaining schedule will be used for implementation rather than entering release freeze early.

Everything below is now an intended DAI-100 deliverable unless a concrete regression, performance problem, or schedule constraint forces a later scope cut.

### E — DAI-090 early unexpected-prompt pass

Run the frozen 20-case DAI-090 corpus now as **Round 1**.

Purpose:

- find provider/schema weaknesses while there is still time to fix them;
- cover injection, arbitrary-code requests, secret-exfiltration requests, contradictory instructions, multilingual input, noisy Unicode, raw-JSON injection, and terse input;
- require 20/20 valid bounded DesignIntent results;
- repeat the exact same corpus as **Final** after runtime changes stop.

Artifacts and runner:

- `spec/design-intent/fixtures/dai-090-unexpected-prompts-v1.json`;
- `scripts/run-dai-090-unexpected-prompts.mjs`;
- `scripts/run-dai-090-validation.ps1`;
- `docs/testing/DAI-090_UNEXPECTED_PROMPTS.md`.

### F — Programmatic character motion

Implementation candidate is now present:

- Player idle breathing / subtle sway;
- Enemy idle / threat motion;
- first-encounter threat pulse;
- combat-resolution defeat shrink/lift effect using a renderer-only transient group;
- 30 fps render cap while character motion is active;
- Edit-mode Enemy presentation remains static;
- `prefers-reduced-motion: reduce` stops the animation loop and restores identity poses;
- pure `character-motion.js` math is independently unit-tested;
- existing DAI-096 visible-Chrome smoke now checks motion over time, encounter motion, defeat cleanup, equipment presentation, and reduced-motion behavior;
- dedicated gate: `npm run validate:dai-100-character-motion`.

The implementation is presentation-only: Play Core combat/session state is still applied synchronously and is never delayed for animation.

Owner-local acceptance passed on 2026-09-28 JST at `f5dff5369dad2652350c131a9a5ac3bb920f8566`.

The 7-step `npm run validate:dai-100-character-motion` gate passed end-to-end:

- Renderer / character-motion unit tests: 36/36 PASS;
- Programmatic character visible-Chrome smoke: PASS;
- Browser performance regression smoke: PASS;
- Owner UI regression smoke: PASS;
- production hosting build: PASS;
- syntax validation: PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

Accepted browser invariants include Player idle motion over time, Enemy encounter motion over time, immediate defeat presentation, defeat cleanup, equipment presentation continuity, reduced-motion loop shutdown/identity pose, and zero browser/page/request/HTTP errors.

Performance remained within the existing browser budget with p95 frame cadence approximately `31.6 ms` and all interaction/performance gates green.

This Character Motion slice is therefore **accepted**.

Requirements retained:

- no Play Core timing or combat semantic changes;
- no external creative assets;
- animation stops/disposes cleanly;
- `prefers-reduced-motion` path;
- dedicated browser/performance acceptance.

### G — Result transition + camera/event focus polish

Implementation candidate is now present:

- blocking Enemy/armed-Trap Room entry triggers a bounded event-focus presentation;
- event focus centers the logical camera on the current Room without changing Play Core;
- Floor advance recenters on the new Floor start Room and uses a dedicated settle transition;
- final clear/fail recenters on the final Room and uses a viewport dim/reveal transition;
- Result banner and metrics reveal in short staged presentation timing;
- Room selection in Edit remains unchanged and does not recenter;
- `prefers-reduced-motion: reduce` disables all newly added CSS animations;
- no gameplay/result state waits for an animation;
- dedicated browser gate: `npm run validate:dai-100-result-focus`.

The dedicated smoke exercises a real 2-Floor run and verifies event focus, Floor transition, Result transition, camera target alignment, Result banner/metrics reveal, settled final content, reduced-motion behavior, and browser/network error absence.

Owner-local acceptance passed on 2026-09-28 JST at `8e16db88b32c5b9b05f39c6b98095c122ff4ba18`.

The 8-step `npm run validate:dai-100-result-focus` gate passed end-to-end:

- production hosting build: PASS;
- Result / camera-focus visible-Chrome smoke: PASS;
- Event feedback regression smoke: PASS;
- Character Motion regression smoke: PASS;
- Motion / feedback regression smoke: PASS;
- Owner UI regression smoke: PASS;
- syntax validation: PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

Accepted browser invariants include event-focus class activation and current-Room camera targeting, Floor-transition focus on the new start Room, final Result focus on the final Room, staged Result banner/metrics reveal, settled Result content remaining visible, two-Floor clear completion, reduced-motion disabling all new animations, and zero browser/page/request/HTTP errors.

The Owner UI 3D-entity probe was hardened without weakening the invariant: Start remains preferred, but any currently visible pickable entity can satisfy the generic 3D-picking check before Start-specific same-Room protection is tested separately.

This Result transition / camera-focus slice is therefore **accepted**.

### H — DesignIntent-driven atmosphere

Implementation candidate is now present.

A pure `packages/renderer-three/src/atmosphere.js` profile maps bounded DesignIntent values into presentation-only scene parameters:

- tension / difficulty / deception / trap density contribute to bounded visual pressure;
- exploration / fairness / telegraph strength contribute to bounded clarity/readability;
- background and fog palette shift subtly with the resulting profile;
- HemisphereLight sky/ground colors and intensity vary within fixed safe bounds;
- DirectionalLight color/intensity varies within fixed safe bounds;
- current-Room emissive readability responds to fairness/telegraph strength;
- semantic Entity colors remain unchanged;
- Edit mode attenuates the atmosphere to 40% so authoring stays highly readable;
- Play uses the full bounded profile;
- Result uses a 75% continuity profile;
- missing DesignIntent preserves the legacy no-fog renderer presentation.

This is renderer-only. DungeonSpec, Play Core, collision/routing, Entity semantics, and visibility rules are unchanged.

Unit/browser acceptance is provided through:

`npm run validate:dai-100-atmosphere`

The dedicated browser smoke compares tense vs exploration/readability profiles on the same authored state, verifies actual Three.js background/fog/light values, ensures the marker palette remains unchanged, checks that atmosphere application cannot mutate Rooms/Corridors/Entities, verifies normal Edit→Play→Edit wiring, enforces readability bounds, and checks browser/network errors.

Owner-local acceptance passed on 2026-09-28 JST at `a1f0d02155fbcdb12576f643f9f3513318951d53`.

The 7-step `npm run validate:dai-100-atmosphere` gate passed end-to-end:

- Renderer / atmosphere unit tests: 42/42 PASS;
- production hosting build: PASS;
- Atmosphere visible-Chrome smoke: PASS;
- browser performance regression smoke: PASS;
- Owner UI regression smoke: PASS;
- syntax validation: PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

Accepted browser invariants include legacy no-DesignIntent rendering, DesignIntent-enabled atmosphere, stronger Fog for tense profiles, brighter ambient lighting for readability-oriented profiles, Edit attenuation, actual Three.js profile matching, unchanged semantic marker palette, no Dungeon state mutation, normal Edit→Play→Edit wiring, bounded readability, and zero browser/page/request/HTTP errors.

This DesignIntent Atmosphere slice is therefore **accepted**.

### I — AI Edit structural commands

Implementation candidate is now present under **Natural Edit V3**.

The single-command provider set is expanded from five to eleven commands:

- `move-entity`;
- `move-room`;
- `resize-room`;
- `add-entity`;
- `remove-entity`;
- `add-room`;
- `remove-room`;
- `add-corridor`;
- `remove-corridor`;
- `reconnect-corridor`;
- `set-corridor-doors`.

Structural safety:

- provider output remains one strict structured command;
- existing Room/Entity/Corridor IDs are exact context enums;
- new Room IDs are server-allocated as `room-ai-NNN`;
- new Corridor IDs are server-allocated as `corridor-ai-NNN`;
- new Entity IDs remain server-allocated as `<type>-ai-NNN`;
- Room coordinates are bounded to ±256 and dimensions to 4–32;
- overlapping new Rooms are rejected before browser application;
- Start/Goal Rooms cannot be removed;
- Corridor self-loops and duplicate endpoint pairs are rejected;
- door sides are cardinal or automatic only;
- no-op structural changes are rejected;
- the browser still runs the existing `createDungeonScenePlan()` structural preflight before `EditSession.apply()`;
- DungeonSpec validation remains authoritative for Start→Goal reachability;
- Undo/Redo uses the existing inverse-command stack.

Bounded provider context now contains:

- Rooms: `id/x/z/width/depth`;
- Entities: `id/type/roomId`;
- Corridors: `id/fromRoomId/toRoomId/width/kind/fromSide/toSide`.

Events, Play/Run state, renderer objects/route meshes, files, persistence data, and credentials remain excluded.

Specifications:

- `spec/edit-command/NATURAL_EDIT_V2.md` — accepted historical five-command contract;
- `spec/edit-command/NATURAL_EDIT_V3.md` — active structural contract;
- `spec/edit-command/EDIT_COMMAND_V1.md` — authoritative editor command shapes.

Browser acceptance adds a six-command structural flow with Undo/Redo at every stage:

`add Room → add Corridor → set door sides → reconnect Corridor → remove Corridor → remove Room`.

Integrated owner-local gate:

`npm run validate:dai-100-ai-edit-structural`

The gate includes Cloud Intent tests, Editor Core tests, hosting Function tests, prior V2 browser regression, new structural visible-Chrome smoke, production build, DAI-074 privacy re-audit, Owner UI regression, syntax, and git-diff checks.

Owner-local acceptance passed on 2026-09-28 JST at `34169906c79babd487575444d158bd0c588857bb`.

The 10-step `npm run validate:dai-100-ai-edit-structural` gate passed end-to-end:

- Cloud Intent structural contract tests: 38/38 PASS;
- Editor Core structural command tests: 30/30 PASS;
- Hosting Function tests: 14/14 PASS;
- prior AI Edit V2 five-command browser regression: PASS;
- AI Edit V3 structural visible-Chrome smoke: PASS;
- production hosting build: PASS;
- DAI-074 secret/privacy re-audit: PASS;
- Owner UI regression smoke: PASS;
- syntax validation: PASS;
- git diff / whitespace check: PASS;
- final result: `passed: true`, `falseChecks: []`.

The structural browser smoke verified the full six-command sequence with Undo/Redo at every stage, preserved START eligibility, ended with zero Critical validation errors, and restored the original structural counts.

The privacy re-audit accepted the new bounded Corridor context (`id/fromRoomId/toRoomId/width/kind/fromSide/toSide`) while preserving `store:false`, no persistent browser storage, prompt/secret non-echo, server-side secret isolation, and `Cache-Control:no-store`.

This AI Edit V3 structural slice is therefore **accepted**.

### J — Reactive Audio V2 intensity

Implementation candidate is now present on top of the existing Programmatic Audio V2 architecture.

The Web Audio graph now separates user mixer values from reactive presentation gain:

```text
BGM voices → user BGM gain → reactive BGM gain → master
SE cues    → user SE gain  → reactive SE gain  → master
```

Reactive intensity is derived deterministically from:

- current Edit / Play / Result audio mode;
- DesignIntent `tension`, `combatDensity`, `trapDensity`, and `targetDifficulty`;
- active Enemy count in the current Room;
- armed Trap count in the current Room;
- current Player HP ratio.

Presentation behavior:

- Edit stays low-intensity;
- ordinary Play uses a DesignIntent-derived exploration level;
- Enemy presence raises the profile to encounter intensity;
- armed Trap presence raises danger intensity;
- low HP adds bounded stress;
- resolving Room danger ramps back toward exploration;
- Floor advance keeps the Play motif continuous and relies on the existing `floor-advance` cue while the new Floor adopts its current-room intensity;
- Result clear/fail keep their existing BGM modes with bounded result intensity.

The reactive layer never rewrites the user's BGM/SE slider values.

Bounds:

- BGM multiplier: `0.82..1.18`;
- SE multiplier: `0.94..1.06`;
- intensity ramp: `0.28 s`.

No DungeonSpec / Play Core / Run Core semantics are changed and no new external audio assets are introduced.

Specification:

`spec/audio/PROGRAMMATIC_AUDIO_V2.md`

Dedicated acceptance:

`npm run validate:dai-100-reactive-audio`

The 9-step gate includes Audio unit tests, the existing DAI-097/100 audio regression smoke, a dedicated exploration→encounter→resolution→Result→Edit browser smoke, browser performance, Owner UI, production build, legal/provenance, syntax, and git diff checks.

Owner-local automated acceptance passed on 2026-09-29 JST at `ec291ebb5791364b80131109bbf033c0317c1b99`.

The 9-step `npm run validate:dai-100-reactive-audio` gate passed after the final Markdown EOF-whitespace cleanup:

- Audio presentation / reactive-intensity unit tests: 13/13 PASS;
- existing DAI-097/100 audio regression smoke: PASS;
- Reactive Audio visible-Chrome smoke: PASS;
- browser performance regression smoke: PASS;
- Owner UI regression smoke: PASS;
- production hosting build: PASS;
- legal / provenance audit: PASS;
- syntax validation: PASS;
- git diff / whitespace check: PASS (no output);
- final result: automated acceptance complete.

Accepted browser invariants include Edit low intensity, Play exploration intensity, Enemy Room encounter boost, event-resolution return to exploration, optional Treasure not re-entering danger, user BGM/SE mix values remaining unchanged, bounded reactive gain multipliers, Result continuity, Edit restoration, no external audio assets, and zero browser/page/request/HTTP errors.

This Reactive Audio V2 intensity slice is therefore **automatically accepted**.

The broader Audio V2 track still requires the separate **owner listening review** before final acceptance.

### K — JSON Import / round-trip

Add import for the generic exchange format and full authored format:

- `DungeonLayoutExchange v1` import;
- `DungeonRunSpec v1` / full Dungeon JSON import;
- strict validation and fail-closed errors;
- imported state opens in the existing editor;
- import → edit → export round-trip evidence;
- no arbitrary code/data execution.

### L — Complete Algorithm Lab set

In addition to accepted **Delaunay + MST + Loops** and **BSP**, implement all remaining planned Algorithm Lab strategies:

1. Rooms + Mazes;
2. Random Walk;
3. Cellular Automata;
4. Maze Carving;
5. Gameplay Graph / Grammar;
6. Wave Function Collapse (WFC).

Each strategy should follow the already accepted loose-coupled architecture:

```text
Reusable Algorithm Core
→ algorithm-native plain-data IR
→ Dungeon Architect AI Adapter
→ valid DungeonSpec
→ Product Strategy catalog / selector
```

Each Algorithm Lab implementation requires:

- deterministic explicit Seed;
- algorithm version/provenance;
- no DOM / Three.js / Editor / Play / network dependency in Core;
- Core invariants/tests;
- DungeonSpec Adapter tests;
- paired Markdown + HTML documentation;
- Product selector registration;
- renderer routeability/validity matrix appropriate to that algorithm;
- multi-floor Test + Mystery browser smoke;
- syntax and git-diff gate.

Version 2 remains the Recommended/default Product strategy.

### M — Final DAI-090 / release phase

After all implementation stops:

1. rerun the exact DAI-090 20-case corpus as **Final**;
2. live-provider/public semantic verification;
3. legal/privacy/pre-public audits;
4. refreshed public E2E;
5. refreshed <3-minute demo video;
6. replacement freeze/rollback point;
7. final submission checks.

### Explicitly excluded from this expansion

Engine-specific export adapters are not part of this DAI-100 submission scope:

- Unity-specific exporter/importer;
- Godot-specific exporter/importer;
- Tiled-specific exporter/importer;
- other engine-specific integration packages.

The generic JSON contracts remain the interoperability boundary for this submission.

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
