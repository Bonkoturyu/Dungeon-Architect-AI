# Production Dependency Review — PROD-DEP-004

- Package: `playwright-core`
- Version: `1.62.0`
- Provider: Microsoft Corporation
- License: Apache-2.0
- Production review: 2026-09-12
- Intended use: production benchmark/smoke automation
- Status: Approved

## Evidence

- npm continues to list exact version 1.62.0;
- Pre archived evidence records official `v1.62.0`, Apache-2.0 license, NOTICE, package metadata and evidence hashes.

## Decision

Approve exact `playwright-core@1.62.0` for production benchmark/smoke automation.

Conditions:

- use the no-browser core package with an existing compatible browser where possible;
- exact version lock;
- preserve Apache-2.0 / applicable NOTICE obligations;
- record production lockfile/integrity after install;
- version change requires review.
