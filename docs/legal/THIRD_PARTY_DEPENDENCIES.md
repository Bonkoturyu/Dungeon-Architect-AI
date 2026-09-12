# Third-Party Dependencies

Pre-production approvals do not automatically authorize production use. Production scope is reviewed separately.

| ID | Dependency | Version/Commit | Source | License | Provenance | NOTICE duties | Usage | Status | Review date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-DEP-001 | three | 0.185.1 / r185 | official three.js tag + npm publication | MIT | live upstream/package metadata rechecked; Pre evidence retained | preserve MIT copyright/license | M1 rendering benchmark and possible renderer candidate | Approved | 2026-09-12 | scoped approval; distribution requires license preservation |
| PROD-DEP-002 | @babylonjs/core | 9.18.0 | official Babylon.js tag + npm publication | Apache-2.0 | live upstream/version rechecked; Pre evidence retained | preserve Apache-2.0 and applicable NOTICE | M1 rendering benchmark and possible renderer candidate | Approved | 2026-09-12 | scoped approval; distribution requires NOTICE/license preservation |
| PROD-DEP-003 | vite | 8.1.5 | official Vite tag + npm publication | MIT + bundled dependency notices | exact version still published; Pre package/license evidence retained | preserve Vite/bundled notices as applicable | production benchmark/build/preview tooling | Approved | 2026-09-12 | tooling scope only until later distribution audit |
| PROD-DEP-004 | playwright-core | 1.62.0 | official Playwright tag + npm publication | Apache-2.0 | exact version still published; Pre package/license/NOTICE evidence retained | preserve Apache-2.0 + Playwright/Puppeteer NOTICE | production benchmark/smoke automation | Approved | 2026-09-12 | automation scope; no bundled browser package |
| PROD-CAND-005 | Unity | 6000.3.20f1 | official Unity release/toolchain | proprietary toolchain terms | official release confirmed; production terms/toolchain review incomplete | per current Unity terms | renderer benchmark candidate | Candidate | 2026-09-12 | selection not confirmed |

Allowed status values: Candidate / Pending Evidence / Approved / Rejected / Removed / Replaced.

Only `Approved` dependencies may be installed or used in production.

## Approval scope rule

`Approved` is scoped to the usage recorded in this table/review. New runtime, model, package, version, distribution purpose, or materially different use requires another review.
