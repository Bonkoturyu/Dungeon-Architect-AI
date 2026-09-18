# ADR-003 — Submission Mobile Scope: Desktop Chrome Only

## Status

**Confirmed**

Decision work started: 2026-09-18

## Context

AI Builder Hackathon 2026 requires a hosted browser demo, but the production requirements do not require mobile support.

The current Dungeon Architect AI implementation and completed performance evidence are desktop-oriented:

- DAI-071 production performance target: desktop Google Chrome on Windows at 1440 × 900;
- editor/play controls are currently optimized for mouse/keyboard plus pointer input;
- mobile editor UX was explicitly left to later scope in earlier M5 validation;
- the frozen PCE-1.0 protocol already defines mobile work as applicable only when mobile is in scope and provides a Mobile-N/A score path.

Claiming production mobile support would therefore require evidence that does not yet exist: real mobile-device/browser acceptance, frozen mobile tap targets, mobile-specific usability evidence, and broader responsive/editor testing.

## Decision candidate

For the current hackathon submission:

- **supported judging target:** desktop Google Chrome on Windows;
- **recommended evaluation viewport:** 1440 × 900 or comparable desktop size;
- **mobile/narrow viewports:** best-effort presentation only;
- mobile is **not** part of the submission acceptance/support claim;
- the UI explicitly discloses this limitation at narrow widths.

This is a scope boundary, not a claim that the architecture cannot support mobile later.

## PCE-1.0 consequence

The frozen PCE-1.0 protocol states that mobile tap tasks apply where mobile is in scope and defines a Mobile-N/A scoring path.

If DAI-075 is confirmed as desktop-only:

- the ten mobile tap target IDs are N/A for the current submission;
- mobile tap success and the mobile gate are not part of the PCE denominator;
- this does **not** unblock PCE-1.0 by itself;
- the three perspective candidates, candidate-equivalent task controls, route-judgment tasks, combat trials, and P01–P12 participant sessions remain required.

No frozen PCE task, candidate order, denominator rule, or score formula is modified.

## Production validation

DAI-075 must verify both boundaries:

### Desktop acceptance

At 1440 × 900:

- production build loads in Chrome;
- editor is valid and START-eligible;
- onboarding is ready;
- the mobile-scope notice is not visible;
- no horizontal overflow or browser/network error occurs.

### Narrow-view limitation evidence

At 390 × 844 with touch emulation:

- the same production build initializes;
- the desktop-only scope notice is visible and contains the limitation text;
- no horizontal overflow occurs;
- onboarding can be dismissed;
- START remains visible and enabled for the valid sample;
- no browser/network error occurs.

The narrow-view probe demonstrates graceful limitation disclosure only. It must not be described as mobile acceptance.

## Production evidence

DAI-075 production validation passed on 2026-09-18.

- generated: `2026-09-18T08:29:19.869Z`;
- Node.js: `v24.15.0`;
- Chrome: `153.0.8010.50`;
- evidence JSON SHA-256: `041f1d964ab342bf49d5972af9dfed73fa6575780178635487525da2c0a0616b`;
- desktop screenshot SHA-256: `22fd5b67df8493bdd3764c1cd5d24960e1550b5b7a7108f1e957f3995fd1d392`;
- narrow screenshot SHA-256: `d9ac4a543d7d1fbb571041169a995ea8419505e81470ced832d689eae46a2796`;
- `passed = true`;
- all 13 desktop/narrow scope checks passed;
- desktop 1440 × 900: valid/START-eligible, onboarding ready, scope notice hidden, horizontal overflow 0, browser/network errors 0;
- narrow 390 × 844 with touch emulation: valid/START-eligible, explicit best-effort limitation visible, horizontal overflow 0, onboarding close passed, START visible/enabled, browser/network errors 0.

This evidence confirms the **scope boundary**, not mobile product support.

## Reversal conditions

Re-open this ADR if:

1. submission rules begin requiring mobile support;
2. the project chooses to advertise mobile support;
3. a production mobile-device acceptance matrix is completed;
4. mobile PCE tasks are explicitly placed back in scope;
5. final judging guidance materially changes.

## Completion gate

DAI-075 is complete because production validation passed and the limitation remains visible in the production bundle at narrow width.
