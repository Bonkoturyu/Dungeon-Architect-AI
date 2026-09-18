# DAI-074 Secret / Privacy Audit

## Status

**IN PROGRESS.** Secret scanning, browser-bundle checks, privacy-contract checks, and one-command validation are implemented; production evidence is pending.

## Purpose

DAI-074 verifies the current submission candidate against two separate risks:

1. provider credentials or other secrets leaking into Git, browser output, or evidence;
2. the product sending, storing, or returning more user data than the documented MVP boundary.

## Secret audit gates

The audit must verify:

- no forbidden secret-bearing path is Git-tracked:
  - `.env` / non-example `.env.*`;
  - `.dev.vars*`;
  - private key/certificate containers;
  - private evidence directories;
- current tracked text contains no high-confidence provider/private-key credential pattern;
- Git patch history contains no high-confidence OpenAI/GitHub/AWS/Google/private-key credential pattern;
- `.gitignore` protects the expected local secret/private paths;
- production `dist/` contains no `OPENAI_API_KEY`, provider authorization header, OpenAI endpoint, private-key marker, or high-confidence secret pattern.

The scanner never writes a matched credential value into evidence. Findings are reported only by pattern/category.

## Privacy contract gates

The audit must verify:

- cloud DesignIntent requests set `store: false`;
- natural-edit requests set `store: false`;
- natural-edit provider input contains only the request text plus normalized room/entity context;
- normalized room context contains only `id`;
- normalized entity context contains only `id`, `type`, and `roomId`;
- the Pages Function response does not echo the full request text or server secret;
- the Pages Function returns `Cache-Control: no-store`;
- the Pages Function source has no console logging;
- the browser production surface does not use localStorage/sessionStorage/IndexedDB/cookies;
- the browser natural-edit request uses the documented bounded context.

## First production attempt finding

The first DAI-074 run failed only:

- `noHighConfidenceCurrentSecrets`;
- `noHighConfidenceSecretsInGitPatchHistory`.

Review identified a synthetic DAI-043 leakage-test sentinel, `sk-dai-043-test-secret-never-log`, as the cause. It is intentionally committed test data used to prove that evidence sanitization detects/avoids secret-like material; it is not a provider credential.

The scanner was corrected rather than disabling history scanning:

- obvious synthetic markers such as `test-secret`, `never-log`, and `do-not-leak` are excluded from credential findings;
- the generic literal-assignment scanner still rejects non-placeholder secret values;
- current tracked files, Git patch history, and production `dist/` remain scanned;
- matched credential values are still never written to evidence.

A corrected production rerun is required before DAI-074 can be marked DONE.

## Build boundary

DAI-074 runs after `npm run build:hosting` so the actual production `dist/` output is scanned rather than assuming source boundaries imply bundle safety.

## Required validation

```powershell
git fetch origin
git switch feat/dai-074-secret-privacy-audit
git pull --ff-only origin feat/dai-074-secret-privacy-audit
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-074-validation.ps1
```

Expected evidence:

`artifacts/privacy/dai-074-secret-privacy.json`

## Boundaries

- high-confidence automated scanning reduces risk but cannot prove that no secret of every possible format has ever existed;
- this audit does not replace provider/cloud access-control configuration;
- this audit does not claim Zero Data Retention;
- public hosted deployment configuration is rechecked again in DAI-081;
- later analytics, accounts, storage, provider, or outbound-data changes reopen this audit.
