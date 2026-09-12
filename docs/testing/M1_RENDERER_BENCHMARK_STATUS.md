# M1 Renderer Benchmark Status — 2026-09-12

## Status

DAI-010: Blocked in the current execution environment; not failed and not completed.

## What is ready

Scoped production review approved exact candidate packages for benchmark use:

- `three@0.185.1`
- `@babylonjs/core@9.18.0`
- `vite@8.1.5`
- `playwright-core@1.62.0`

Unity 6000.3.20f1 remains a Candidate toolchain and is not selected.

## Execution environment limitation

Attempting to query/install npm packages in the current container failed with DNS resolution error:

`getaddrinfo EAI_AGAIN registry.npmjs.org`

Therefore no npm package was installed, no renderer benchmark was executed, and no renderer candidate is selected from this environment.

## Rule

Do not substitute Pre benchmark results for the required production re-measurement.
Do not mark DAI-010/DAI-011 complete until a production benchmark is run in an environment that can install/use the Approved exact packages (and handles the Unity candidate according to the frozen decision protocol).
