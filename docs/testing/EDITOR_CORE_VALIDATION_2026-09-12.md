# Editor Core Validation — 2026-09-12

## Scope

DAI-050 EditCommand contract and DAI-052 undo/redo core.

## Environment

- Node.js v22.16.0
- built-in `node:test`
- no third-party runtime dependency

## Command

```bash
npm test
```

## Result

- Core: 7/7
- Generator: 7/7
- Intent: 6/6
- Editor core: 5/5
- Total: 25/25 pass

Editor coverage:

- move-room produces new Spec and inverse
- source Spec remains unchanged
- move-entity rejects unknown room
- add/remove non-protected entity round trip
- Start/Goal protection
- deterministic undo/redo session

## Limitations

- no browser UI
- no pointer/drag interaction
- no room/corridor add/remove yet
- no natural-language EditCommand translation yet
