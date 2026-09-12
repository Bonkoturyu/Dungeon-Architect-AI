# Third-Party Dependencies

Pre-production approvals do not automatically authorize production use.

| ID | Dependency | Version/Commit | Source | License | Provenance | NOTICE duties | Usage | Status | Review date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-CAND-001 | three | 0.185.1 candidate | upstream three.js / package source to be revalidated | MIT | Pending production evidence | preserve MIT copyright/license | renderer benchmark candidate | Candidate | 2026-09-12 | do not install/use until Approved |
| PROD-CAND-002 | @babylonjs/core | 9.18.0 candidate | upstream Babylon.js / package source to be revalidated | Apache-2.0 | Pending production evidence | preserve Apache-2.0 and applicable NOTICE | renderer benchmark candidate | Candidate | 2026-09-12 | do not install/use until Approved |
| PROD-CAND-003 | Unity | 6000.3.20f1 candidate toolchain | official Unity release/toolchain | proprietary toolchain terms | Pending production review | per Unity terms | renderer benchmark candidate | Candidate | 2026-09-12 | selection not confirmed |

Allowed status values: Candidate / Pending Evidence / Approved / Rejected / Removed / Replaced.

Only `Approved` dependencies may be installed or used in production.
