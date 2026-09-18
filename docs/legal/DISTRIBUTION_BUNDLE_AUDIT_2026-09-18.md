# Production Browser Distribution Audit — 2026-09-18

## Purpose

This audit separates packages present in the production development lockfile from software actually redistributed in the judge-facing browser build.

## Production build boundary

The production hosting build is created by:

```text
npm run build:hosting
```

The build uses Vite to bundle `apps/editor-slice` into `dist/`, copies the frozen demo `DungeonSpec`, emits Cloudflare Pages headers/routes, and copies `THIRD_PARTY_NOTICES.txt` into the public distribution.

DAI-072 production evidence passed on the built surface before this legal audit. DAI-073 adds the explicit distribution notice and legal-register consistency gates.

## Runtime external dependency

### three.js `0.185.1` / r185

- role: selected production browser renderer;
- license: MIT;
- selected by: ADR-001;
- package identity/integrity: recorded by the reviewed lockfile;
- redistribution: bundled into the browser JavaScript application;
- obligation handling: official r185 MIT copyright/license text is preserved in root `THIRD_PARTY_NOTICES.txt` and copied into `dist/THIRD_PARTY_NOTICES.txt`.

Official license source reviewed for r185:

`https://github.com/mrdoob/three.js/blob/r185/LICENSE`

## Installed but not browser-runtime redistribution

### Vite `8.1.5`

Used to create the production bundle and local preview. Vite is build tooling; the Vite package itself is not served as an application runtime module.

### Playwright Core `1.62.0`

Used only by production browser-smoke/benchmark scripts. It is not part of the distributed app and no Playwright browser package is bundled.

### Babylon.js Core `9.18.0`

Retained in the dependency graph for historical renderer benchmark evidence. ADR-001 rejected it for the selected browser runtime; it is not imported by the production editor/play surface.

### Lightning CSS `1.33.0` and optional platform bindings

Transitive through Vite and approved only for build/dev tooling. They are not treated as a direct browser runtime dependency.

### Unity `6000.3.23f1`

Renderer benchmark candidate only. No Unity WebGL output is part of the selected production browser distribution.

## Creative assets

The production browser candidate contains no third-party creative assets. UI and dungeon visuals use project-authored HTML/CSS and programmatic geometry/materials. No external image, texture, audio, font, 3D model, or animation is required by the production build.

See `docs/legal/THIRD_PARTY_ASSETS.md`.

## Hosted services

Runtime hosted services are not redistributed binaries and are tracked separately:

- Cloudflare Pages + Pages Functions;
- OpenAI Responses API / `gpt-5.6-luna`.

See `docs/legal/THIRD_PARTY_SERVICES.md` and `docs/legal/AI_USAGE.md`.

## Result

The current production browser distribution has one identified redistributed third-party runtime library: `three@0.185.1`. Its MIT notice is explicitly shipped with the public build. Other reviewed top-level/transitive packages are scoped to build, smoke, benchmark, or rejected-candidate use as recorded in `THIRD_PARTY_DEPENDENCIES.md`.
