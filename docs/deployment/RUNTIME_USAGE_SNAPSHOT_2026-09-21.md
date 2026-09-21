# Runtime usage snapshot — 2026-09-21

This document records the owner-verified runtime usage / quota state for **Dungeon Architect AI** as observed in the OpenAI Platform and Cloudflare dashboards on 2026-09-21 (JST).

The values below are operational snapshots, not long-term guarantees. Provider quotas and dashboard aggregation behavior can change independently of the repository.

## OpenAI Platform

Scope shown in the dashboard:

- Project: `DungeonArchitectAI`
- API capability: Responses and Chat Completions
- Time range: Last 7 days
- API key filter: All API keys
- Runtime model observed: `gpt-5.6-luna`
- **OpenAI API Organization Usage Tier: Tier 1**

Observed usage:

| Metric | Observed value |
|---|---:|
| Requests | 35 |
| Input tokens | 12,358 |
| Displayed spend | $0.00 |
| Images | 0 requests |
| Web Searches | 0 requests |
| File Searches | 0 requests |
| Moderation | 0 requests |
| Embeddings | 0 requests |
| Audio Speeches | 0 requests |
| Audio Transcriptions | 0 requests |
| Vector Stores | 0 bytes |
| Code Interpreter Sessions | 0 |

Attribution visible in the dashboard:

- model breakdown: all observed input-token usage was attributed to `gpt-5.6-luna`;
- project breakdown: all observed usage was attributed to `DungeonArchitectAI`;
- API-key breakdown: the visible runtime key was `dungeon-architect-ai-dev`;
- user breakdown: 35 requests were attributed to the single visible project user.

Billing / limit state:

- **Organization Usage Tier: Tier 1**
- Organization spend limit: **$100.00**
- Displayed current spend: **$0.00**
- Spend alerts configured at **80% ($80)** and **100% ($100)**
- Dashboard indicated the spend-limit cycle would reset in 9 days at capture time.

Rate limits shown for `gpt-5.6-luna` at Tier 1:

- **500,000 TPM**
- **500 RPM**
- **5,000,000 TPD** batch queue limit

### Interpretation

The displayed `$0.00` should be treated as dashboard rounding / presentation for a very small current spend, not as evidence that provider usage has literally incurred zero cost. Token usage and requests are non-zero.

The dashboard snapshot does not show peak per-minute request/token consumption, so a precise percentage utilization of the 500 RPM / 500,000 TPM burst limits cannot be calculated from the seven-day aggregate. The observed total volume is nevertheless very small relative to the available rate-limit envelope.

## Cloudflare

### Dungeon Architect AI project

Project: `dungeon-architect-ai`

Production metrics, **Last 24 hours**:

| Metric | Observed value |
|---|---:|
| Successful requests | 8 |
| Errors | 0 |
| Subrequests | 8 |
| Internal errors | 0 |
| Script Throw Exception | 0 |
| Exceeded CPU Time Limits | 0 |
| Exceeded Memory | 0 |
| Client Disconnected | 0 |

Cloudflare Web Analytics was **disabled** for this Pages project at capture time.

### Cloudflare account-wide usage

The Workers & Pages account view included more than one application, including `dungeon-architect-ai` and `agent-dev-preflight-api`. Therefore the following totals are **account-wide**, not Dungeon Architect AI-only.

Observed period: **September 1–September 21, 2026**

| Metric | Observed value |
|---|---:|
| Requests | 22.79k |
| CPU time | 37,016 ms |
| Workers build minutes | 154 |
| Observability events | 0 |

Current visible quota counters:

| Feature | Usage | Limit | Utilization |
|---|---:|---:|---:|
| Requests today | 137 | 100,000 | **0.137%** |
| Observability events today | 0 | 200,000 | **0%** |
| Workers build minutes this month | 154 | 3,000 | **5.13%** |

### Interpretation

The account-wide request count must not be confused with Dungeon Architect AI traffic. The project-specific Production view showed only 8 successful requests / 0 errors for the last 24 hours, while the Workers & Pages account view aggregated activity from multiple applications.

At capture time, the visible Cloudflare request and build-minute quotas had substantial remaining headroom.

The screenshots expose the quota values but do not explicitly display the Cloudflare billing plan name. Exact plan identification is therefore intentionally not inferred here.

## Operational conclusion

As of this snapshot, neither OpenAI API usage nor Cloudflare usage indicated a capacity or quota constraint for ongoing development, validation, hosted-demo access, or expected hackathon judging traffic.

Continue to re-check provider dashboards before the final public submission freeze, because these counters and quotas are external runtime state rather than repository-controlled configuration.
