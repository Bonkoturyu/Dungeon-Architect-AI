# Production Dependency Review — 2026-09-12

## Purpose

Pre-production approvals were scoped to experiments and do not authorize production use. This file records the first production re-review state.

## Rendering candidates

### `three`

- Pre reference version: 0.185.1 / r185
- Upstream project license: MIT
- Production status: Candidate
- Production install/use: Not yet Approved
- Required before approval: exact package/version source, archive/integrity/provenance, bundled license obligations, intended production usage.

### `@babylonjs/core`

- Pre reference version: 9.18.0
- Upstream project license: Apache-2.0
- Production status: Candidate
- Production install/use: Not yet Approved
- Required before approval: exact package/version source, archive/integrity/provenance, NOTICE obligations, intended production usage.

### Unity 6000.3.20f1

- Pre reference version: 6000.3.20f1
- Official release exists and includes current Web/WebGL fixes.
- Production status: Candidate toolchain
- Production selection: Not Confirmed
- Required: production benchmark under the frozen candidate protocol and current Unity licensing/toolchain review.

## Local LLM candidates

No local LLM runtime/model is Approved for production at this point.
Pre DEP-006/007/008 unresolved evidence remains unresolved for production and must not be installed or used merely because development has started.

## Cloud LLM

Provider remains Open. Production review must cover terms, API-key handling, privacy/security, cost, structured-output reliability, and fallback behavior.

## Rule

Candidate ≠ Approved. No package/model/runtime in this document may be installed or used in production until the production legal register records `Approved` with exact evidence.
