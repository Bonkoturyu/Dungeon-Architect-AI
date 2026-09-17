# ADR-002 — Hosting Target: Cloudflare Pages + Pages Functions

## Status

**Pending production validation**

Decision work started: 2026-09-17

## Context

Dungeon Architect AI is a browser-first MVP with two deployment concerns:

1. serve the bundled Three.js editor/play application and frozen public fixtures;
2. keep provider credentials server-side while exposing the constrained `/api/natural-edit` path.

The browser must never receive `OPENAI_API_KEY`. The hosting target should also keep deployment overhead low for a hackathon submission and support preview deployments from Git branches.

## Candidate shape selected for validation

Use **Cloudflare Pages + Pages Functions**:

- Pages serves the Vite-built `dist/` static application;
- `functions/api/natural-edit.js` exposes the same-origin server route;
- the Function reuses the existing production `createOpenAIHttpTransport()` and `generateOpenAIEditCommand()` boundaries;
- `OPENAI_API_KEY` is injected as a Cloudflare Secret/runtime binding;
- GitHub integration provides automatic production/preview deployments.

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

## Repository implementation

DAI-072 adds:

- `.node-version` pinned to the production-tested Node version;
- `scripts/build-hosting.mjs` to produce the deployable `dist/` tree;
- security/cache rules in `dist/_headers`;
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

## Completion gate

Do not mark this ADR Confirmed until the DAI-072 repository-side production validation passes. Actual public URL deployment and end-to-end hosted smoke are intentionally owned by DAI-081, which may reopen this ADR if the Pages deployment itself fails.

## Reversal conditions

Re-open this decision if:

1. the production bundle cannot be served correctly by Pages;
2. the Pages Function cannot execute the existing server-side OpenAI transport/adapter without weakening the security boundary;
3. build/runtime limits materially block the submission workload;
4. the final hosted smoke fails on Cloudflare while another already-reviewed target works without architectural compromise;
5. pricing, platform policy, or deployment requirements materially change before submission.
