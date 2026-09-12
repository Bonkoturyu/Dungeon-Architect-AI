# Production Toolchain Review — Unity 6000.3.20f1

- Candidate: Unity Editor / Unity WebGL
- Version: 6000.3.20f1
- Status: Candidate / user tier-eligibility confirmation required
- Purpose: DAI-010 renderer comparison only
- Third-party assets: none
- Pre-production implementation reused: No

## Current public licensing facts checked

Unity's current public licensing guidance states:

- Unity Personal tier eligibility is subject to a financial threshold.
- The currently stated Unity Personal threshold is USD 200,000 for the most recent 12 months.
- Unity's legal information was updated effective 2026-06-30.
- Unity states that AI/automated tools may interact with Unity through an authorized framework and users remain responsible for tools acting on their behalf.
- Unity Runtime Fee language was removed from the current Unity plan model.

## Project rule

The project must not infer the user's plan eligibility.

Before using the Unity Editor candidate, the operator must confirm that the installed Unity plan is valid for their current circumstances and that any automated interaction used is permitted under the current Unity terms.

## Scope

If the eligibility gate is satisfied, this review permits Unity 6000.3.20f1 only for:

- creating the fixed DAI-M1 Unity WebGL benchmark
- building the fixed WebGL benchmark
- collecting comparison evidence

It does not select Unity as the production renderer.

## No Asset Store dependency

Unity Asset Store assets are not used by this benchmark.
All benchmark geometry/materials are generated from Unity primitives/default engine capabilities.
