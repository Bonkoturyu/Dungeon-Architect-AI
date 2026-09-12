# Production Dependency Review — 2026-09-12

## Result

Approved for scoped production M1 use:

- `three@0.185.1` — renderer benchmark/candidate
- `@babylonjs/core@9.18.0` — renderer benchmark/candidate
- `vite@8.1.5` — benchmark/build/preview tooling
- `playwright-core@1.62.0` — benchmark/smoke automation

Still not Approved:

- Unity production selection (candidate toolchain; current terms/toolchain and production measurement still required)
- all browser-local LLM runtimes/models
- cloud LLM provider/runtime
- any third-party creative asset not individually recorded as CC0 Approved

## Important distinction

The approval above authorizes installing/using the exact versions for their recorded production scope. It does not choose the final renderer. Renderer selection still requires DAI-010 production measurement and DAI-011 ADR.

After installation, the production lockfile and resolved integrity/provenance must be checked and the legal register updated if it differs from the reviewed package identity.
