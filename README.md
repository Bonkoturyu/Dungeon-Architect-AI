# Dungeon Architect AI

**Describe. Edit. Play.**

Dungeon Architect AI is a browser-first dungeon-design project for **AI Builder Hackathon 2026**. A natural-language design request is translated into validated `DesignIntent`, mapped into a deterministic low-poly `DungeonSpec`, then edited, validated and played in the same browser experience.

**Live demo:** https://dungeon-architect-ai.pages.dev/

## Verified browser flow

```text
DESCRIBE
  ↓
GENERATE
  ↓
EDIT
  ↓
VALIDATE
  ↓
TEST / MYSTERY
  ↓
EXPLORE + ROOM EVENTS
  ↓
RESULT
```

The current flow above is the refreshed production candidate. DAI-099 predeploy acceptance passed 22/22, the Cloudflare Pages production deployment was revalidated end-to-end against the exact candidate commit/runtime-source fingerprint, and DAI-090 unexpected-prompt verification passed 20/20 cases without requiring a runtime fix.

## Judge quick start

See **[Judge Quick Start](docs/submission/JUDGE_QUICKSTART.md)**.

Recommended judging environment:

- desktop Google Chrome on Windows;
- 1440 × 900 or comparable desktop viewport;
- mobile/narrow layouts are best-effort only.

Suggested refreshed-candidate generation prompt:

```text
Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.
```

Suggested natural-language edit:

```text
Move the treasure to the room that contains the goal.
```

Then confirm `✓ Valid`, open **Play**, choose **▶ Test** (current authored dungeon) or **🎲 Mystery** (fresh Seed that rerolls routes/content without revealing the authored map), resolve any blocking Room Events, navigate with the directional **CHOOSE EXIT** pad until Goal, inspect `✓ CLEARED`, and use **← Edit**. Generator V1 may still produce a similar room layout because its spatial embedding is fixed for a given room count.

## What is production-backed today

| Area | Current status |
|---|---|
| Public demo | Refreshed Cloudflare Pages HTTPS candidate accepted by DAI-099 production public E2E; frozen runtime-source fingerprint verified |
| Renderer | Three.js `0.185.1`, retained by ADR-001; historical benchmark limitations are documented and later production evidence validates the current stack |
| DungeonSpec | Renderer-independent schema, parser, validation, deterministic generation |
| Procedural core | Deterministic graph/layout, corridors, Start/Goal, route-choice controls, Seed reproducibility |
| Natural-language generation | OpenAI Responses cloud path + deterministic fallback → validated DesignIntent → bounded DungeonSpec mapping |
| Play core | Session snapshot, Fog of War / auto-map, directional exits, Room Events, HP/Level/XP/Gold/equipment, 1–10 floor runs with PlayerState carry, Test/Mystery play, clear/failure Result |
| Natural-language edit | Live-tested constrained `move-entity` translation through server-side OpenAI path |
| Edit mode | Room select/move/resize/add/remove; corridor add/remove + N/E/S/W endpoint-side editing; entity add/move/remove; Undo/Redo; Start→Goal route check |
| UI languages | English (default), Japanese, Simplified Chinese, Traditional Chinese, Korean; live switching also available in onboarding |
| Validation | Critical Play gate with structural/reachability checks |
| Simulation | Deterministic simulator, shortest/greedy/cautious agents, metrics, intent-fit and explainable summary |
| Hosting | Cloudflare Pages + Pages Functions / ADR-002 |
| Legal/security | Dependency/AI/service registers, third-party notice, secret/privacy audit |
| Device scope | Desktop Chrome on Windows; mobile/narrow best-effort only / ADR-003 |

## Important current limitations

See **[Known Limitations](docs/submission/KNOWN_LIMITATIONS.md)**.

Key boundaries:

- DesignIntent → DungeonSpec generation is intentionally bounded; not every intent axis has a dedicated semantic generation mechanic;
- the natural-language edit surface currently supports one safe command per request and is constrained to entity relocation;
- Play perspective and combat-model selection remain pending the frozen PCE-1.0 evaluation;
- mobile is outside the supported submission acceptance scope;
- no Safari/Firefox acceptance claim has been made;
- there are no accounts, persistent project storage, analytics or telemetry;
- the refreshed DAI-099 candidate is frozen and publicly revalidated; DAI-090 unexpected-prompt checks also passed. Final repository-publication/compliance and submission remain under DAI-091/DAI-092.

## Sample prompts

See **[Sample Prompts](docs/submission/SAMPLE_PROMPTS.md)**.

The two-floor prompt shown above and the natural-language edit request are verified against the refreshed DAI-099 public candidate. DAI-090 separately verified malformed, contradictory, oversized, mixed-language, injection-like and unsupported prompts against the same frozen production identity.

The repository also retains the frozen ten-case DesignIntent regression corpus at:

`spec/design-intent/fixtures/dai-045-prompt-regression-v1.json`

## Generator versions and research

The current production generator is frozen as **Generator Version 1**. Future generation methods are added as Version 2, Version 3, and so on without deleting or silently replacing earlier implementations.

- [Generator version registry / Version 1 specification](docs/architecture/GENERATOR_VERSIONS.md)
- [Dungeon generation algorithm research](docs/research/DUNGEON_GENERATION_ALGORITHMS.md)

`DungeonSpec schemaVersion` and `Generator Version` are separate concepts: the same DungeonSpec schema may be produced by multiple generator versions.

## Architecture

- `DesignIntent` represents normalized game-design intent.
- `DungeonSpec` is renderer-independent serialized dungeon data.
- Generator/Core produces deterministic structure and bounded intent-driven entities.
- Editor mutations go through explicit `EditCommand` operations.
- `▶ Test` creates a fixed execution snapshot of the current authored dungeon; `🎲 Mystery` uses a fresh Seed so route/content choices can change without exposing the authoring map. Generator V1 can still keep a similar room layout; spatial variability is a future Generator Version concern.
- Play Core does not directly mutate authoring state.
- Three.js consumes the spec/snapshot through a disposable renderer adapter.
- Cloudflare Pages Functions hold provider credentials server-side.
- AI output is schema-constrained and independently validated before application.

Relevant ADRs and design reviews:

- [Editor UI/UX Review — 2026-09-21](docs/research/EDITOR_UI_UX_REVIEW_2026-09-21.md)
- [ADR-001 — Three.js production renderer](docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md)
- [ADR-002 — Cloudflare Pages hosting](docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md)
- [ADR-003 — Desktop-only submission mobile scope](docs/architecture/adr/ADR-003-MOBILE-SCOPE-DESKTOP-ONLY.md)
- [ADR-004 — Final focus category: AI 3D Scene Generation](docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md)

## Run locally

Requirements:

- Node.js `24.15.0`
- desktop Google Chrome for production browser smokes

Install:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

Run the static development surface:

```powershell
npx vite --host 127.0.0.1
```

The live AI buttons require the same-origin Pages Function endpoints; a plain static Vite server does not provide the production provider secret boundary.

Build the production Pages output:

```powershell
npm run build:hosting
```

See [Cloudflare Pages deployment](docs/deployment/CLOUDFLARE_PAGES.md).

## Verification

```powershell
npm test
```

Major evidence and task-specific gates are recorded under `docs/testing/` and `scripts/`.

## Privacy and AI boundary

- no accounts, analytics, ads, telemetry, database or persistent project storage are part of the current MVP;
- browser authoring/play state is in-memory;
- generation sends the generation request text to the same-origin `/api/design-intent` endpoint;
- natural-language edit sends request text plus bounded room/entity identifiers to `/api/natural-edit`;
- `OPENAI_API_KEY` remains server-side;
- OpenAI requests explicitly use `store: false`;
- `store: false` is **not** claimed to be Zero Data Retention.

See [Privacy / Data Flow](docs/privacy/PRIVACY_DATA_FLOW.md).

## Licensing and provenance

Project code is licensed under **Apache-2.0**.

The current browser candidate uses no third-party or AI-generated creative assets. The selected redistributed third-party runtime is Three.js `0.185.1`; its MIT notice is included in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and copied into the production `dist/` build.

See:

- [Third-party dependencies](docs/legal/THIRD_PARTY_DEPENDENCIES.md)
- [Third-party creative assets](docs/legal/THIRD_PARTY_ASSETS.md)
- [AI usage register](docs/legal/AI_USAGE.md)
- [Third-party services](docs/legal/THIRD_PARTY_SERVICES.md)

## Submission status

Refreshed production demo:

https://dungeon-architect-ai.pages.dev/

Submission metadata:

- Focus category: **AI 3D Scene Generation**
- Short description: frozen in [DAI-083 Submission Description / Focus Category](docs/submission/DAI-083_DESCRIPTION_CATEGORY.md)

DAI-099 refreshed freeze:

- candidate commit: `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3`;
- candidate tree: `1ee24b750bec04a4488c94ca2e7cc54ec015530f`;
- runtime-source SHA-256: `dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`;
- rollback branch: `rollback/submission-candidate-dai-099-2026-09-24`;
- final refreshed demo video: 59.9 seconds;
- final video SHA-256: `deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7`.

DAI-090 unexpected-prompt verification passed 20/20 cases against that frozen public candidate without requiring a runtime fix.

The GitHub repository is still private and must be switched to Public before final submission. DAI-091 owns the final compliance/publication gate; DAI-092 owns the actual submission.

See [Submission Checklist](docs/submission/CHECKLIST.md).

## Team and license

**Team:** a few  
**Target:** AI Builder Hackathon 2026  
**License:** Apache-2.0
