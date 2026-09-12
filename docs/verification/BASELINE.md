# Production Verification Baseline

## Status

Stack-neutral baseline established. Stack-specific commands remain Open until the production 3D stack is selected.

## Rules

- Do not claim a formatter/typecheck/test/build result unless that command was actually run.
- Do not add a third-party verification tool before dependency review/approval.
- Secret/privacy checks are mandatory before public release.
- Production benchmarks must use production code; Pre benchmark harness/source cannot be copied.
- Fresh-browser verification is required for MVP and submission candidates.

## Required command classes after stack selection

The selected stack must provide documented commands for:

1. format/check formatting
2. type/static analysis where applicable
3. unit tests
4. production build
5. secret/privacy scan
6. browser smoke test

Until those commands exist, DAI-005 remains Open.

## Stack-neutral checks already applicable

- repository contains Apache-2.0 LICENSE
- legal registers exist
- `.gitignore` excludes common secret/private/cache paths
- Open decisions are not marked Confirmed without evidence
- Pending Evidence dependencies are not installed/used
