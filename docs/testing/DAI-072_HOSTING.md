# DAI-072 Hosting

## Status

**IN PROGRESS.** Cloudflare Pages + Pages Functions is the selected hosting target for validation. Repository-side build, Function, security, and smoke infrastructure are implemented; production validation evidence is pending.

## Scope

DAI-072 decides and validates the deployable hosting shape for the current browser MVP.

It does not create the final judge-facing URL. DAI-081 owns the final hosted-demo deployment and public URL acceptance after the submission candidate is assembled.

## Hosting shape

- Cloudflare Pages serves the static Vite bundle from `dist/`.
- Cloudflare Pages Functions exposes `/api/natural-edit`.
- `OPENAI_API_KEY` is a runtime Secret and never enters the browser bundle.
- production/preview deployment is intended to use Cloudflare's GitHub integration.
- `.node-version` pins Node.js `24.15.0` for build reproducibility.

See:

- `docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md`
- `docs/deployment/CLOUDFLARE_PAGES.md`

## Repository-side production evidence contract

The one-command validation must verify:

1. audited `package-lock.json` is unchanged;
2. complete production Node suite passes, including Pages Function contract tests;
3. `npm run build:hosting` creates `dist/index.html`, production assets, the demo fixture, and `_headers`;
4. the built HTML references bundled `/assets/` files rather than source `/apps/` or `/packages/` modules;
5. the built surface starts in visible Chrome with valid START state and onboarding;
6. security headers include CSP and `X-Content-Type-Options`;
7. index caching is configured as `no-store`;
8. browser console/page/request/HTTP error collections are empty.

Expected local evidence:

- `artifacts/hosting/dai-072-hosting.json`
- `artifacts/hosting/dai-072-hosting.png`

## Pages Function contract

`functions/api/natural-edit.js` must:

- fail closed when `OPENAI_API_KEY` is absent;
- reject invalid JSON before provider invocation;
- cap request body size at 64 KiB;
- use the existing backend OpenAI transport and natural-edit adapter;
- return only one sanitized supported EditCommand + bounded metadata;
- avoid echoing the provider secret or full prompt;
- reject unsupported HTTP methods.

The unit tests live under `tests/hosting/`, not under `functions/`, so Cloudflare's file-based routing cannot accidentally publish test files as Functions.

## Public deployment evidence

DAI-081 may reuse:

```powershell
$env:DAI_PUBLIC_URL = 'https://<project>.pages.dev'
node scripts/run-dai-072-public-smoke.mjs
```

That smoke exercises the deployed same-origin `/api/natural-edit` path through the public browser UI and verifies Undo/Redo and network/browser cleanliness.

## Required repository-side validation

```powershell
git fetch origin
git switch feat/dai-072-cloudflare-hosting
git pull --ff-only origin feat/dai-072-cloudflare-hosting
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-072-validation.ps1
```

## Completion boundary

DAI-072 may be marked DONE when repository-side production validation passes and ADR-002 is updated from Pending production validation to Confirmed as the deployment target.

The absence of a final `pages.dev` URL at DAI-072 completion is intentional; that URL and deployed end-to-end acceptance belong to DAI-081.

## Explicit non-goals

- no custom domain requirement;
- no database/accounts/monetization backend;
- no browser-visible provider secret;
- no final hosted-demo URL acceptance before DAI-081;
- no claim that Cloudflare is generally superior to every other hosting provider.
