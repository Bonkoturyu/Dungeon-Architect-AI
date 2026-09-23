# Cloudflare Pages deployment

This is the deployment runbook for the Dungeon Architect AI browser MVP.

## Selected deployment shape

- static browser application: Cloudflare Pages
- same-origin backend route: Pages Function at `/api/natural-edit`
- production build output: `dist/`
- provider secret: `OPENAI_API_KEY` stored as a Cloudflare Secret / runtime binding
- production branch after DAI-081 cutover: `main`

The browser never receives `OPENAI_API_KEY`. The Pages Function reads it from `context.env` and uses the existing production OpenAI transport and natural-edit adapter.

## Repository build

Cloudflare Pages settings:

- Root directory: repository root
- Build command: `npm run build:hosting`
- Build output directory: `dist`
- Node.js: pinned by `.node-version` to `24.15.0`
- Functions directory: repository-root `functions/` (auto-discovered by Pages)

`npm run build:hosting` uses the reviewed Vite dependency to bundle `apps/editor-slice` into `dist/`, copies the frozen demo DungeonSpec fixture, and writes the Pages `_headers` security/cache configuration.

## Runtime secret

In the Pages project dashboard, add `OPENAI_API_KEY` as a Secret for the production environment. Add the same secret to Preview only when preview-branch natural-edit validation is required.

Do not store the key in:

- repository files;
- Pages build command;
- browser JavaScript;
- plain-text build-time environment committed to source;
- screenshots or evidence JSON.

Local Cloudflare secret files such as `.dev.vars*` are ignored by Git.

## Git integration

Cloudflare Pages can connect directly to GitHub and automatically deploy branch pushes. Preview deployments are suitable for pre-merge review; production should ultimately track `main`.

For this repository, the public deployment is intentionally deferred to DAI-081 so the submission URL is created from a reviewed main candidate rather than an intermediate implementation branch.

## DAI-099 refreshed-candidate fingerprint

The production build now emits `dist/build-info.json`.

It contains the source commit SHA and a runtime-bundle SHA-256 calculated from the deployed static bundle. The file is served with `Cache-Control: no-store`.

DAI-099 refreshed public acceptance rebuilds the candidate locally and refuses to accept the public URL unless both the public commit SHA and runtime-bundle SHA-256 match the local candidate.

This check is specifically intended to catch a stale Cloudflare Pages production deployment.

## Public deployment validation

After a Pages URL exists, run:

```powershell
$env:DAI_PUBLIC_URL = 'https://<project>.pages.dev'
node scripts/run-dai-072-public-smoke.mjs
```

The public smoke verifies HTTPS, browser startup, the deployed same-origin `/api/natural-edit` Function, one real natural-language edit, Undo/Redo, and browser/network errors. It does not require `OPENAI_API_KEY` on the local machine because the secret belongs to the deployed Function.

Expected evidence:

- `artifacts/hosting-public/dai-072-public.json`
- `artifacts/hosting-public/dai-072-public.png`

This public smoke is reusable by DAI-081 when the final hosted-demo candidate is deployed.

## Operational usage snapshots

Owner-verified provider usage / quota snapshots are recorded separately from static platform facts:

- [2026-09-21 OpenAI + Cloudflare runtime usage snapshot](RUNTIME_USAGE_SNAPSHOT_2026-09-21.md)

These snapshots are point-in-time operational evidence and should be refreshed before the final submission freeze.

## Current Cloudflare platform facts used by DAI-072

Reviewed against Cloudflare documentation on 2026-09-17:

- Pages Git integration supports GitHub repositories, automatic deployments, and preview deployments.
- Pages Functions use file-based routing from a root `/functions` directory.
- Pages Functions receive environment variables and secrets through `context.env`.
- static asset requests are free and unlimited on both free and paid Pages plans.
- Pages Functions count against Workers quotas; the Workers Free plan currently includes 100,000 requests/day shared with Workers usage.
- the Pages Free plan currently allows 500 builds/month and 20,000 static files per site.
- the current Pages v3 build image provides Node.js 22 by default and supports pinning another Node.js version with `.node-version` or `NODE_VERSION`.

Primary references:

- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/api-reference/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/configuration/build-image/
