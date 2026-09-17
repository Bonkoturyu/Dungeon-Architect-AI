# DAI-072 Hosting

## Status

**DONE.** Cloudflare Pages + Pages Functions is confirmed as the production hosting target after repository-side production validation passed.

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

## Reviewed production evidence

Repository-side validation passed on 2026-09-18.

- generated: `2026-09-17T15:14:12.396Z`;
- Node.js: `v24.15.0`;
- Chrome: `152.0.7977.83`;
- JSON SHA-256: `71d6969f14c11acbea3c6b5d2ea30cc691ba41aef5d416d140a178bd2795e290`;
- PNG SHA-256: `55fd7fcae2e19e8bdd461b1222c115bbf78577abae011b4a94ab0ec06d959622`;
- `passed = true`;
- all 12 acceptance checks passed.

Observed build hashes:

- `dist/index.html`: `a9999eb3b237cd0726a2a128db968f77191b10c951dd0449969f92b8f8af37c3`;
- `dist/_headers`: `3f8e8e5b1233cdc43719ac9085b8c3c4c23b599ae420a5c3b6b2b591b15ebae0`;
- `dist/_routes.json`: `9ac04b0b988b70aa7a8aeef820ca5653cab83721b0df8013e54a4450f1d22040`;
- demo fixture: `fe1924ddcda87bfc8ede99f9aa6663e3f78339bdc92ab3963ba3a0d905807818`;
- emitted JS asset: `index-DuDz9imf.js`.

The evidence verifies:

1. production `dist/index.html` and hashed assets exist;
2. the frozen demo fixture is copied;
3. CSP and `X-Content-Type-Options` are emitted;
4. index caching is configured as `no-store`;
5. `_routes.json` restricts Functions invocation to `/api/*`;
6. Function source is not copied into static `dist/`;
7. the built editor starts valid and START-eligible;
8. onboarding initializes and closes successfully;
9. only production assets are requested rather than source `/apps/` or `/packages/` modules;
10. console/page/request/HTTP error collections are empty.

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

## Completion boundary

DAI-072 is complete because the deployable hosting shape, production build, Function boundary, routing restrictions, security headers, and built-surface browser behavior passed production validation.

The absence of a final `pages.dev` URL at DAI-072 completion is intentional; that URL, runtime secret setup, and deployed end-to-end acceptance belong to DAI-081.

## Explicit non-goals

- no custom domain requirement;
- no database/accounts/monetization backend;
- no browser-visible provider secret;
- no final hosted-demo URL acceptance before DAI-081;
- no claim that Cloudflare is generally superior to every other hosting provider.
