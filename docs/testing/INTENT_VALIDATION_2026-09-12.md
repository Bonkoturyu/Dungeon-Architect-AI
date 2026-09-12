# DesignIntent / Fallback Validation — 2026-09-12

## Scope

DAI-040 production DesignIntent contract and DAI-041 deterministic fallback parser.

## Environment

- Node.js v22.16.0
- built-in `node:test`
- third-party runtime dependency: none

## Command

```bash
npm test
```

## Result

- Core tests: 7/7 pass
- Generator tests: 7/7 pass
- Intent tests: 6/6 pass
- Total: 20/20 pass

Intent coverage includes:

- complete normalized intent
- axis/duration clamping
- forced `instantDeathAllowed=false`
- rejection of unsupported instant-death intent
- Japanese greed/fairness prompt fallback
- scary + low-combat + exploration fallback

## Limitations

- not an LLM evaluation
- not a semantic-quality benchmark
- keyword precedence remains deterministic and intentionally limited
- no cloud/local provider is selected or used
