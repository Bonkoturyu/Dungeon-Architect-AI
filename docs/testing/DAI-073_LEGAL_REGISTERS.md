# DAI-073 Legal Registers

## Status

**DONE.** Production legal registers, distribution notices, and deterministic audit gates passed production validation on 2026-09-18.

## Purpose

DAI-073 closes the legal/provenance bookkeeping required before the public submission candidate is frozen.

The task separates four categories that must not be conflated:

1. third-party software packages installed for production/tooling;
2. third-party software actually redistributed in the browser build;
3. third-party creative assets;
4. external AI/hosting services.

## Registers

- `docs/legal/THIRD_PARTY_DEPENDENCIES.md`
- `docs/legal/THIRD_PARTY_ASSETS.md`
- `docs/legal/AI_USAGE.md`
- `docs/legal/THIRD_PARTY_SERVICES.md`
- `docs/legal/DISTRIBUTION_BUNDLE_AUDIT_2026-09-18.md`
- root `THIRD_PARTY_NOTICES.txt`

## Current candidate findings

### Distributed runtime software

The selected browser application redistributes `three@0.185.1` / r185. Its official MIT notice is preserved in root `THIRD_PARTY_NOTICES.txt` and copied into the public `dist/` build.

### Tooling / benchmark packages

Vite, Playwright Core, Babylon.js Core, Lightning CSS/platform bindings, and the Unity benchmark candidate are not classified as selected browser-runtime redistribution. Their approved/rejected usage scopes remain recorded in the dependency register.

### Creative assets

The current browser submission candidate contains no third-party creative assets and no AI-generated creative assets. The production UI and dungeon visuals are project-authored code plus programmatic geometry/materials.

### AI / hosted services

Development-assistant use and production OpenAI runtime use are recorded separately. Cloudflare Pages/Functions and OpenAI Responses API are recorded as production hosted services. No provider secret is stored in legal registers.

## Production audit gates

The DAI-073 audit must verify:

- audited `package-lock.json` SHA-256 is unchanged;
- exact top-level reviewed package versions remain pinned;
- production entrypoint import closure has exactly one external runtime package: `three`;
- no external creative-asset file extension is present in the tracked working source after excluding build/cache/evidence directories;
- development AI use and runtime AI use are both recorded;
- dependency/tooling scopes are recorded;
- zero external creative assets is recorded explicitly;
- Cloudflare and OpenAI production services are recorded;
- root NOTICE references the distribution notice and legal registers;
- Three.js r185 MIT text is present;
- `dist/THIRD_PARTY_NOTICES.txt` is byte-identical to the root notice file;
- the production build and built-surface Chrome smoke still pass after notice integration.

## Required validation

```powershell
git fetch origin
git switch feat/dai-073-legal-registers
git pull --ff-only origin feat/dai-073-legal-registers
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-073-validation.ps1
```

Expected evidence:

`artifacts/legal/dai-073-legal-registers.json`

The validation also regenerates DAI-072 built-surface smoke evidence as a regression guard after adding the distributed notice file.

## Production evidence

Reviewed evidence generated at `2026-09-18T04:24:51.531Z` with Node.js `v24.15.0`.

- evidence JSON SHA-256: `547c436bdf4991c2ce08e2589a97ebc8dd376afadac8afd455e31e3a376ed745`;
- `passed = true`;
- all 13 deterministic legal-register checks passed;
- audited package-lock SHA-256 remained `ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc`;
- exact top-level reviewed package versions remained pinned;
- production import closure resolved exactly one external runtime package: `three`;
- creative-asset candidate scan returned an empty set;
- development AI usage and runtime AI usage were both recorded;
- dependency/tooling scopes and production services were recorded;
- root and distribution third-party notice SHA-256 values matched at `4b0ff0f15ee4eb5bfbc56f1ebafcd6197c2bf96739109a6329c2a10f7f126ecc`;
- official Three.js r185 MIT notice and distribution copy gates passed.

## Completion gate

DAI-073 is complete because the full production Node suite, hosting production build/smoke, and every deterministic legal audit invariant passed.

## Boundaries

- this is project compliance/provenance bookkeeping, not legal advice;
- no claim is made that external service terms can never change;
- any later package/version/runtime/asset/service addition must reopen the relevant register review;
- public secret/privacy scanning remains DAI-074 rather than being silently folded into this task.
