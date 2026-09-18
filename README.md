# Dungeon Architect AI

**Describe. Edit. Play.**

Dungeon Architect AI is a browser-first dungeon-design project for **AI Builder Hackathon 2026**. The product goal is to turn natural-language design intent into a validated, editable, playable low-poly 3D dungeon while keeping generated behavior inside explicit schemas and a fixed gameplay vocabulary.

> **Current verified browser build:** the integrated editor/play surface starts from a valid sample dungeon and supports manual editing, one constrained natural-language edit path, validation/START gating, play-to-Goal, Result, onboarding, and the production hosting/security boundary.
>
> **Not yet submission-complete:** the initial full-dungeon **DESCRIBE → GENERATE** prompt surface is not exposed in this editor screen yet. The backend DesignIntent pipeline and procedural generator exist and are separately production-tested, but that first-generation UI wiring remains a required integration before final submission.

## Current browser workflow

```text
VALID SAMPLE
   ↓
EDIT
   ↓
VALIDATE
   ↓
START
   ↓
PLAY
   ↓
RESULT
```

The final product target remains:

```text
DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT / REVEAL
```

The distinction is intentional: public documentation describes what the current verified build actually does instead of presenting the full target flow as already integrated.

## Judge quick start

See **[Judge Quick Start](docs/submission/JUDGE_QUICKSTART.md)**.

For the current verified editor/play build:

1. Use **desktop Google Chrome on Windows**. The production reference viewport is 1440 × 900.
2. Follow or close the four-step first-run Guide.
3. Click rooms and use the Entity inspector to make a manual edit.
4. For the verified AI edit path, enter:
   - `Move the treasure to the room that contains the goal.`
5. Confirm `Validation: PASS`, then press `START`.
6. In Play mode, click an adjacent room until the Goal is reached.
7. Review the Result, then use **Return to Edit**.

Mobile/narrow layouts are best-effort only and are **not** a supported judging target for this submission scope.

## What is production-backed today

| Area | Current status |
|---|---|
| Renderer | Three.js `0.185.1`, selected by production benchmark / ADR-001 |
| DungeonSpec | Renderer-independent schema, parser, validation, deterministic generation |
| Procedural core | Deterministic graph/layout, corridors, Start/Goal, route-choice controls, Seed reproducibility |
| Play core | Session snapshot, room movement, enemy/treasure/trap/recovery/event logic, clear/failure Result |
| DesignIntent | Schema + deterministic fallback + production OpenAI Responses path |
| Natural-language edit | Live-tested constrained `move-entity` translation through server-side OpenAI path |
| Edit mode | Room selection/movement, entity add/move/remove, Undo/Redo |
| Validation | Critical START gate with structural/reachability checks |
| Simulation | Deterministic simulator, shortest/greedy/cautious agents, metrics, intent-fit and explainable summary |
| Hosting target | Cloudflare Pages + Pages Functions / ADR-002 |
| Legal/security | Dependency/AI/service registers, third-party notice, secret/privacy audit |
| Submission device scope | Desktop Chrome on Windows; mobile/narrow best-effort only / ADR-003 |

## Important current limitations

See **[Known Limitations](docs/submission/KNOWN_LIMITATIONS.md)** for the full list.

The most important ones are:

- the initial full-dungeon DESCRIBE → GENERATE UI is not yet wired into the judge-facing editor;
- the current browser demo opens a small valid sample dungeon;
- the current natural-language edit surface supports one safe edit command per request and is presently constrained to entity relocation;
- Play perspective and combat-model selection remain pending the frozen PCE-1.0 evaluation;
- mobile is outside the supported submission acceptance scope;
- no Safari/Firefox acceptance claim has been made;
- the final public hosted URL, video, description/focus category, and frozen submission hash belong to later M8 tasks.

## Sample prompts

See **[Sample Prompts](docs/submission/SAMPLE_PROMPTS.md)**.

The only judge-facing prompt currently verified end-to-end in the integrated browser UI is the natural-language edit example:

```text
Move the treasure to the room that contains the goal.
```

The repository also contains a ten-case DesignIntent regression corpus for the backend intent pipeline. Those generation-intent prompts are **not** presented as current editor-screen judge instructions until the initial generation surface is integrated.

## Architecture

The production architecture keeps authoring, simulation, renderer, and provider boundaries separate:

- `DesignIntent` represents normalized game-design intent.
- `DungeonSpec` is renderer-independent serialized dungeon data.
- Generator/Core produces deterministic dungeon structure.
- Editor mutations go through explicit `EditCommand` operations.
- `START` creates a fixed execution snapshot.
- Play Core runs without mutating authoring state directly.
- Three.js consumes the spec/snapshot through a disposable renderer adapter.
- AI provider credentials stay server-side behind Cloudflare Pages Functions.
- Model output is schema-constrained and independently validated before application.

Relevant ADRs:

- [ADR-001 — Three.js production renderer](docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md)
- [ADR-002 — Cloudflare Pages hosting](docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md)
- [ADR-003 — Desktop-only submission mobile scope](docs/architecture/adr/ADR-003-MOBILE-SCOPE-DESKTOP-ONLY.md)

## Run locally

Requirements:

- Node.js `24.15.0`
- desktop Google Chrome for the production browser smokes

Install the reviewed dependency graph:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

Run the development surface:

```powershell
npx vite --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/apps/editor-slice/index.html
```

The natural-language edit button requires the server-side `/api/natural-edit` boundary; the static Vite dev surface alone does not provide a live provider secret.

Build the production Pages output:

```powershell
npm run build:hosting
```

For the Cloudflare configuration, see [Cloudflare Pages deployment](docs/deployment/CLOUDFLARE_PAGES.md).

## Verification

Run the complete Node suite:

```powershell
npm test
```

Major production evidence is recorded under `docs/testing/`. Task-specific validation scripts live under `scripts/` and intentionally fail closed when required evidence is absent.

## Privacy and AI boundary

- no accounts, analytics, ads, telemetry, or database are part of the current MVP;
- browser authoring/play state is in-memory;
- the natural-language edit request sends only the request text plus bounded room/entity identifiers;
- `OPENAI_API_KEY` remains server-side;
- OpenAI requests explicitly use `store: false`;
- `store: false` is **not** claimed to be Zero Data Retention;
- secret/privacy production audit is complete for the current candidate.

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

The repository is still being assembled into the final hackathon candidate.

Remaining M8 work includes:

- DAI-081 — final hosted `pages.dev` demo and public end-to-end smoke;
- DAI-082 — demo video under 3 minutes;
- DAI-083 — short description and focus category;
- DAI-084 — candidate hash / rollback point.

The final public-repository visibility switch is also still pending and must happen before submission.

See [Submission Checklist](docs/submission/CHECKLIST.md).

## Team and license

**Team:** a few  
**Target:** AI Builder Hackathon 2026  
**License:** Apache-2.0
