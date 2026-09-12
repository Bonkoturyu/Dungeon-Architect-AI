# Production Dependency Review — PROD-DEP-003

- Package: `vite`
- Version: `8.1.5`
- Provider: VoidZero Inc. / Vite contributors
- License: MIT plus published bundled-dependency notices
- Production review: 2026-09-12
- Intended use: production benchmark/build/preview tooling
- Status: Approved

## Evidence

- npm continues to list exact version 8.1.5;
- Pre archived evidence records the official `v8.1.5` tag, MIT core license, published-package bundled license text, package metadata and evidence hashes.

## Decision

Approve exact `vite@8.1.5` for production benchmark/build/preview tooling.

Conditions:

- exact version lock;
- preserve required bundled notices;
- post-install lockfile/integrity check;
- this approval does not automatically approve every transitive dependency for unrelated production use;
- version change requires review.
