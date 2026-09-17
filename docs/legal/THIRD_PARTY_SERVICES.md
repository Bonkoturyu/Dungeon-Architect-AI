# Third-Party Services

This register covers external hosted services used by the production submission candidate. It is separate from npm/software dependency licensing and from creative-asset provenance.

| ID | Service | Provider | Purpose | Data / secret boundary | Evidence | Status | Review date |
|---|---|---|---|---|---|---|---|
| PROD-SVC-001 | Cloudflare Pages + Pages Functions | Cloudflare | Static hosting, preview/production deployment, same-origin backend Function for `/api/natural-edit` | Browser receives static app only; `OPENAI_API_KEY` is configured as a server-side runtime Secret; `/api/*` is the only Function route | ADR-002, `docs/deployment/CLOUDFLARE_PAGES.md`, DAI-072 production build/browser evidence | Approved | 2026-09-18 |
| PROD-SVC-002 | OpenAI Responses API / `gpt-5.6-luna` | OpenAI | Runtime DesignIntent generation and constrained natural-language edit translation | Provider credential is server-side only; requests use `store:false`; runtime output is schema/semantic validated before use | `docs/legal/AI_USAGE.md`, DAI-042 provider review, DAI-043/044/045/053 evidence | Approved | 2026-09-18 |

## Boundaries

- No external database, account system, analytics SDK, ad network, payment processor, or telemetry service is part of the current submission candidate.
- GitHub is used for source control and may be connected to Cloudflare for deployment, but it is not a runtime dependency of the judge-facing application.
- Service approval is scoped to the usage above. Adding telemetry, authentication, storage, or another provider requires an explicit review.
- This file contains no account identifiers, API keys, or private configuration values.
