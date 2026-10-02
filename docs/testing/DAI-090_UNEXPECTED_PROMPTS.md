# DAI-090 — Unexpected Prompt Regression

## Status

**ROUND 1 READY.** This gate is intentionally run twice:

1. **Round 1** during active DAI-100 development, to expose weaknesses before the remaining polish/features are implemented.
2. **Final** after runtime changes stop, immediately before final compliance/freeze.

The same frozen 20-case corpus must be used for both runs.

## Corpus

Fixture:

`spec/design-intent/fixtures/dai-090-unexpected-prompts-v1.json`

Coverage:

1. beginner / short;
2. short but dangerous;
3. greed punishment;
4. scary / low combat;
5. hard first run / learnable second run;
6. mean but fair;
7. confusing but not boring;
8. contradictory request;
9. unsupported arbitrary-code request;
10. mixed-language / emoji format;
11. system-prompt injection;
12. secret/environment exfiltration request;
13. executable HTML/JavaScript request;
14. raw JSON / out-of-range injection;
15. terse fragments;
16. Simplified Chinese;
17. Korean;
18. noisy Unicode;
19. conflicting pseudo-system instruction blocks;
20. tool/function-call injection.

All prompts are synthetic project test data.

## Acceptance gates

- exactly 20 cases;
- 20/20 finish with a valid, schema-constrained `DesignIntent` through bounded routing;
- no case exceeds two Cloud attempts;
- Cloud selection rate >= 90%;
- fallback rate <= 10%;
- aggregate semantic directional-constraint rate >= 80%;
- evidence contains neither the API key nor any full prompt;
- evidence stores prompt IDs/categories, not prompt bodies.

The safety/resilience 20/20 count is deliberately separate from semantic-fit scoring: adversarial prompts are required to remain inside the strict schema even when the requested content is unsupported.

## Runner

Direct npm commands:

- Round 1: `npm run validate:dai-090-round1`
- Final: `npm run validate:dai-090-final`

These require `OPENAI_API_KEY`.

Recommended Windows wrapper with hidden key input:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-dai-090-validation.ps1 -Phase Round1
```

Final rerun:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-dai-090-validation.ps1 -Phase Final
```

The wrapper first reruns Cloud-intent contract tests and bounded-routing validation, then requests the API key with hidden input if it is not already process-local.

Evidence:

- `artifacts/dai-090/dai-090-unexpected-prompts-round1.json`
- `artifacts/dai-090/dai-090-unexpected-prompts-final.json`

Do not paste the API key into chat, GitHub, command arguments, screenshots, or evidence.
