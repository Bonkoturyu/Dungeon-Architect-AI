# Third-Party Dependencies

Pre-production approvals do not automatically authorize production use. Production scope is reviewed separately.

| ID | Dependency | Version/Commit | Source | License | Provenance | NOTICE duties | Usage | Status | Review date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-DEP-001 | three | 0.185.1 / r185 | official three.js tag + npm publication | MIT | live upstream/package metadata rechecked; exact package identity/integrity recorded in reviewed lockfile | preserve MIT copyright/license | production browser renderer/runtime, DAI-014, later Edit/Play rendering, hosted demo | Approved | 2026-09-13 | ADR-001 selected renderer; exact version remains pinned |
| PROD-DEP-002 | @babylonjs/core | 9.18.0 | official Babylon.js tag + npm publication | Apache-2.0 | live upstream/version rechecked; Pre evidence retained | preserve Apache-2.0 and applicable NOTICE | M1 rendering benchmark only | Approved | 2026-09-12 | evaluated but not selected by ADR-001; new use requires scope review |
| PROD-DEP-003 | vite | 8.1.5 | official Vite tag + npm publication | MIT + bundled dependency notices | exact version and integrity recorded in reviewed lockfile | preserve Vite/bundled notices as applicable | production benchmark/build/preview tooling | Approved | 2026-09-12 | tooling scope; final distribution bundle audit still required |
| PROD-DEP-004 | playwright-core | 1.62.0 | official Playwright tag + npm publication | Apache-2.0 | exact version and integrity recorded in reviewed lockfile | preserve Apache-2.0 + Playwright/Puppeteer NOTICE | production benchmark/smoke automation | Approved | 2026-09-12 | automation scope; no bundled browser package |
| PROD-DEP-005 | lightningcss + platform bindings | 1.33.0 | npm packages resolved through Vite 8.1.5 | MPL-2.0 | reviewed lockfile records exact versions/integrity; transitive through Vite | MPL source/notice obligations if covered executable/library material is redistributed | build/dev tooling only | Approved | 2026-09-12 | no direct runtime/vendored/redistributed use without re-review |
| PROD-CAND-005 | Unity Editor / WebGL | 6000.3.23f1 | official Unity toolchain | proprietary toolchain terms | user-executed production benchmark completed with 5/5 clean runs | per current Unity terms | DAI-010 renderer benchmark candidate only | Rejected | 2026-09-13 | not selected for browser MVP by ADR-001; no claim that Unity is generally unsuitable |

Allowed status values: Candidate / Pending Evidence / Approved / Rejected / Removed / Replaced.

Only `Approved` dependencies may be installed or used in production. A `Rejected` candidate may remain as historical evidence but is not authorized for new production scope.

## Approval scope rule

`Approved` is scoped to the usage recorded in this table/review. New runtime, model, package, version, distribution purpose, or materially different use requires another review.
