# ADR-002 — Hosting Target: Cloudflare Pages + Pages Functions

## Status

**Confirmed**

Decision date: 2026-09-18

## Context

Dungeon Architect AI is a browser-first MVP with two deployment concerns:

1. serve the bundled Three.js editor/play application and frozen public fixtures;
2. keep provider credentials server-side while exposing the constrained `/api/natural-edit` path.

The browser must never receive `OPENAI_API_KEY`. The hosting target should also keep deployment overhead low for a hackathon submission and support preview deployments from Git branches.

## Decision

Use **Cloudflare Pages + Pages Functions** as the production hosting target for the browser MVP.

- Pages serves the Vite-built `dist/` static application;
- `functions/api/natural-edit.js` exposes the same-origin server route;
- the Function reuses the existing production `createOpenAIHttpTransport()` and `generateOpenAIEditCommand()` boundaries;
- `OPENAI_API_KEY` is injected as a Cloudflare Secret/runtime binding;
- GitHub integration provides automatic production/preview deployments.

Final public `pages.dev` URL acceptance remains DAI-081. This ADR confirms the hosting architecture and deployment target; it does not claim that a final judge URL has already passed public end-to-end validation.

## Why this fits the current architecture

The existing product is already a static browser application except for the provider-secret boundary. Pages therefore does not require a dedicated application server or database.

The Functions route also preserves the DAI-043/053 security architecture:

- browser sends only prompt + bounded authoring context;
- provider secret exists only on the server side;
- provider output remains schema-constrained and independently validated;
- browser applies only the returned supported EditCommand.

The selected target adds no new npm runtime dependency to the repository.

## Platform evidence reviewed

Cloudflare official documentation reviewed on 2026-09-17 confirms:

- Git integration supports GitHub repositories and preview deployments;
- Pages Functions are routed from a root `/functions` directory;
- Functions can access runtime variables/secrets through `context.env`;
- static asset requests are free/unlimited on Pages;
- Pages Functions share Workers quotas, including the current Workers Free 100,000 requests/day allowance;
- Pages Free currently supports 500 builds/month and 20,000 static files/site;
- Pages build images support explicit Node version pinning.

See `docs/deployment/CLOUDFLARE_PAGES.md` for the exact deployment settings and source links.

## Production validation evidence

Repository-side DAI-072 validation passed on 2026-09-18 using Node.js `v24.15.0` and Chrome `152.0.7977.83`.

Reviewed external evidence:

- generated: `2026-09-17T15:14:12.396Z`;
- JSON SHA-256: `71d6969f14c11acbea3c6b5d2ea30cc691ba41aef5d416d140a178bd2795e290`;
- PNG SHA-256: `55fd7fcae2e19e8bdd461b1222c115bbf78577abae011b4a94ab0ec06d959622`;
- `passed = true`;
- all 12 DAI-072 repository-side gates passed;
- production HTML and hashed JS asset were generated;
- frozen demo fixture was copied;
- CSP and `X-Content-Type-Options` were emitted;
- index `no-store` caching was configured;
- `_routes.json` restricted Functions invocation to `/api/*`;
- Function source was absent from static `dist/`;
- built editor was valid / START-eligible;
- onboarding loaded and closed successfully;
- built browser surface used production assets rather than source modules;
- console/page/request/HTTP error collections were empty.

Reviewed build artifact hashes:

- `dist/index.html`: `a9999eb3b237cd0726a2a128db968f77191b10c951dd0449969f92b8f8af37c3`;
- `dist/_headers`: `3f8e8e5b1233cdc43719ac9085b8c3c4c23b599ae420a5c3b6b2b591b15ebae0`;
- `dist/_routes.json`: `9ac04b0b988b70aa7a8aeef820ca5653cab83721b0df8013e54a4450f1d22040`;
- demo fixture: `fe1924ddcda87bfc8ede99f9aa6663e3f78339bdc92ab3963ba3a0d905807818`.

## Repository implementation

DAI-072 adds:

- `.node-version` pinned to the production-tested Node version;
- `scripts/build-hosting.mjs` to produce the deployable `dist/` tree;
- security/cache rules in `dist/_headers`;
- API-only Function routing in `dist/_routes.json`;
- `functions/api/natural-edit.js` for the same-origin provider proxy;
- server-function contract tests outside `/functions` so tests cannot become deployed routes;
- built-output visible-Chrome smoke evidence;
- a public deployed smoke reusable by DAI-081.

## Security boundaries

- `OPENAI_API_KEY` is never bundled into `dist/`.
- local Cloudflare `.dev.vars*` files are ignored.
- API responses contain only the supported command and sanitized provider metadata.
- evidence must not contain the provider secret or the full natural-language prompt.
- CSP restricts default, script, connect, object, base and frame sources for the static build.

## Cost / quota boundary

The expected hackathon traffic is compatible with the documented Free-plan envelope, but this ADR does not promise permanent zero cost. Pages Functions use Workers quotas and the external OpenAI request remains separately billable under the provider account.

## Rejected / deferred alternatives

### Dedicated server / VM

Deferred because the current MVP does not require persistent server state and a dedicated server would add operational work without solving an unmet product requirement.

### Static-only hosting

Rejected because it would force the provider key into the browser or remove the verified natural-language edit path.

### Other serverless static hosts

Not rejected as generally unsuitable. They remain reversal options if Cloudflare deployment, compatibility, policy, or reliability evidence fails. DAI-072 is selecting a project-specific target rather than ranking hosting providers generally.

## Completion boundary

ADR-002 is Confirmed by the repository-side DAI-072 production evidence above. Actual public URL deployment, secret configuration, and end-to-end hosted smoke remain DAI-081 acceptance work.

## Reversal conditions

Re-open this decision if:

1. the production bundle cannot be served correctly by Pages;
2. the Pages Function cannot execute the existing server-side OpenAI transport/adapter without weakening the security boundary;
3. build/runtime limits materially block the submission workload;
4. the final hosted smoke fails on Cloudflare while another already-reviewed target works without architectural compromise;
5. pricing, platform policy, or deployment requirements materially change before submission.
