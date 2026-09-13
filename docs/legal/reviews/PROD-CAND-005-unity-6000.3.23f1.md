# Production Toolchain Review — Unity 6000.3.23f1

- Candidate: Unity Editor / Unity WebGL
- Version: 6000.3.23f1
- Status: Candidate / user tier-eligibility confirmation required
- Purpose: DAI-010 renderer comparison and, if selected by DAI-011, production Unity implementation baseline
- Third-party assets: none
- Pre-production implementation reused: No

## Version verification

Unity 6000.3.23f1 is an existing Unity 6.3 LTS patch version. Unity's official issue tracker records fixes targeting `6000.3.23f1`, and Unity currently identifies Unity 6.3 as an LTS release.

The user explicitly selected `6000.3.23f1` as the Unity version to use for this project. The benchmark therefore rejects other Unity Editor versions rather than silently changing the comparison environment.

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

If the eligibility gate is satisfied, this review permits Unity 6000.3.23f1 for:

- creating the fixed DAI-M1 Unity WebGL benchmark
- building the fixed WebGL benchmark
- collecting comparison evidence
- serving as the production Unity version if Unity is selected later by DAI-011

It does not select Unity as the production renderer by itself.

## No Asset Store dependency

Unity Asset Store assets are not used by this benchmark.
All benchmark geometry/materials are generated from Unity primitives/default engine capabilities.

## Re-review triggers

Re-review if:

- the Unity Editor version changes from `6000.3.23f1`
- the project's Unity plan/tier changes materially
- Unity licensing terms change materially
- Asset Store or third-party Unity packages are introduced
