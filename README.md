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

The current repository flow above is locally regression-tested. The existing Cloudflare Pages deployment has historical production public-E2E evidence from the earlier M8 candidate; DAI-099 must redeploy and rerun public E2E after the later DAI-085–096 / Play-UI changes before final submission.

## Judge quick start

See **[Judge Quick Start](docs/submission/JUDGE_QUICKSTART.md)**.

Recommended judging environment:

- desktop Google Chrome on Windows;
- 1440 × 900 or comparable desktop viewport;
- mobile/narrow layouts are best-effort only.

Suggested generation prompt:

```text
Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.
```

Suggested natural-language edit:

```text
Move the treasure to the room that contains the goal.
```

Then confirm `✓ Valid`, open **Play**, choose **▶ Test** (current authored dungeon) or **🎲 Mystery** (fresh Seed that rerolls routes/content without revealing the authored map), resolve any blocking Room Events, navigate with the directional **CHOOSE EXIT** pad until Goal, inspect `✓ CLEARED`, and use **← Edit**. Generator V1 may still produce a similar room layout because its spatial embedding is fixed for a given room count.

## What is production-backed today

| Area | Current status |
|---|---|
| Public demo | Historical Cloudflare Pages HTTPS candidate exists; refreshed deployment + public E2E for the current runtime is pending DAI-099 |
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
- the historical public candidate/video/freeze predate later DAI-085–096 and Play-UI work; DAI-097 Audio, DAI-098 multi-floor simulation/balance, and DAI-099 refreshed deployment/public-E2E/video/freeze remain before final submission.

## Sample prompts

See **[Sample Prompts](docs/submission/SAMPLE_PROMPTS.md)**.

The public candidate has live E2E evidence for both the generation prompt and the natural-language edit prompt shown above.

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

Historical DAI-081 hosted-demo evidence exists at:

https://dungeon-architect-ai.pages.dev/

Submission metadata:

- Focus category: **AI 3D Scene Generation**
- Short description: frozen in [DAI-083 Submission Description / Focus Category](docs/submission/DAI-083_DESCRIPTION_CATEGORY.md)

Historical DAI-084 rollback point:

- candidate commit: `cacba2a1f8f079ab6401768b97f9fc91fff8f3b9`;
- candidate tree: `e2938bb46e1cf2eedc3a90e2b7603bd6050486ad`;
- rollback branch: `rollback/submission-candidate-m8-2026-09-19`;
- dist manifest SHA-256: `387287bfba2aaad91a7ef4c9d98ebb522e8ce8e1e0768825d39d33d949d8ea6d`.

See [DAI-084 Candidate Freeze / Rollback Point](docs/submission/DAI-084_CANDIDATE_FREEZE.md). A new final freeze will be created after the refreshed public-demo and video gates.

The previous DAI-082 capture remains historical evidence for the earlier M8 candidate. A refreshed demo video is required under DAI-099 after the current DAI-085–098 runtime is finalized, redeployed, and public-E2E revalidated.

The GitHub repository is still private and must be switched to Public before submission.

See [Submission Checklist](docs/submission/CHECKLIST.md).

## Team and license

**Team:** a few  
**Target:** AI Builder Hackathon 2026  
**License:** Apache-2.0
