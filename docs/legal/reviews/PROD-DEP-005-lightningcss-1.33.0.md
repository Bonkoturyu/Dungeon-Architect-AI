# Production Dependency Review — Lightning CSS 1.33.0

- Date: 2026-09-12
- Package: `lightningcss`
- Version: `1.33.0`
- License: MPL-2.0
- Entry path: transitive dependency of `vite@8.1.5`
- Production scope: build/dev tooling only
- Status: **Approved — scoped tooling use**

## Trigger

The reviewed production `package-lock.json` resolves Vite 8.1.5 with `lightningcss@1.33.0` and its platform-specific optional bindings. The lockfile records those packages as MPL-2.0 and development dependencies.

## License interpretation

Mozilla describes MPL 2.0 as file-level copyleft: MPL-covered files may be combined with differently licensed code in a larger work without forcing unrelated files under MPL. Distribution of MPL-covered executable/library material requires the distributor to preserve the recipient's access to the corresponding MPL source and applicable notices.

Official reference:

- https://www.mozilla.org/en-US/MPL/2.0/FAQ/

This project does not modify or vendor Lightning CSS source and does not intend to ship Lightning CSS as application runtime code. It is used only through the Vite build/dev toolchain.

## Approval conditions

`lightningcss@1.33.0` and the exact platform bindings resolved by the reviewed lockfile are Approved only while all of the following remain true:

1. They remain build/dev tooling, not a browser runtime dependency.
2. `node_modules/` is not committed or distributed as part of the submitted application.
3. Lightning CSS source/binary files are not copied into Dungeon Architect AI.
4. Lightning CSS source is not modified.
5. The final production browser bundle is audited to confirm Lightning CSS covered code is not embedded as runtime code.
6. If future packaging redistributes Lightning CSS executable/library material, a separate distribution-compliance review is required, including MPL source-availability and notice obligations.
7. A version change requires a new review.

## Decision

**Approved for exact-version build/dev-tooling scope only.**

This is an explicit exception review under the project's non-default-license policy. It does not approve direct runtime use, source modification, vendoring, or redistribution.
