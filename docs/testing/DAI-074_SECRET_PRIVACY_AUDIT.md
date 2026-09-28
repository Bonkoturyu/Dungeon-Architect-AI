# DAI-074 Secret / Privacy Audit

## Status

**DONE.** The DAI-081 post-integration secret/privacy re-audit passed on 2026-09-19.

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
- natural-edit provider input contains only the request text plus normalized Room/Entity/Corridor authoring context;
- normalized Room context contains only `id`, `x`, `z`, `width`, and `depth`;
- normalized Entity context contains only `id`, `type`, and `roomId`;
- normalized Corridor context contains only `id`, `fromRoomId`, `toRoomId`, `width`, `kind`, `fromSide`, and `toSide`;
- the Pages Function response does not echo the full request text or server secret;
- the Pages Function returns `Cache-Control: no-store`;
- the Pages Function source has no console logging;
- the browser production surface does not use localStorage/sessionStorage/IndexedDB/cookies;
- the browser natural-edit request uses the documented bounded context;
- the browser generation request sends prompt only;
- the hosted DesignIntent Function does not echo the generation prompt or secret;
- the hosted DesignIntent Function returns `Cache-Control: no-store`;
- both Pages Function sources contain no console logging.

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

## Production evidence

Reviewed evidence generated at `2026-09-18T08:09:11.864Z` with Node.js `v24.15.0`.

- evidence JSON SHA-256: `c223f7c2b9041751708781782158497ce353c11edcd3f23fe69992eed5238f39`;
- `passed = true`;
- all 14 secret/privacy checks passed;
- forbidden tracked secret paths: none;
- current high-confidence secret findings: none;
- Git patch-history high-confidence secret findings: none after explicit synthetic-sentinel filtering;
- production `dist/` provider-secret-boundary findings: none;
- persistent browser-storage findings: none;
- DesignIntent and natural-edit OpenAI requests both preserved `store: false`;
- natural-edit outbound shape remained exactly request + room IDs + entity ID/type/roomId;
- Function response echoed neither full prompt nor secret and used `Cache-Control: no-store`;
- evidence itself contained neither full prompt nor secret.

## DAI-081 re-audit scope

DAI-081 added the public `/api/design-intent` endpoint and live DESCRIBE → GENERATE flow. The audit has been extended to verify that endpoint in addition to the existing natural-edit path.

The 2026-09-18 evidence below remains valid for the earlier candidate snapshot, but it does not close the DAI-081 change. A new evidence JSON is required before PR #35 merges.

## DAI-081 post-integration evidence

Reviewed evidence generated at `2026-09-18T16:08:17.667Z` with Node.js `v24.15.0`.

- evidence JSON SHA-256: `087af17acc04f4a46b7522e18e97d45de503ea9a9ba74bdcb9eeff726cfb2d18`;
- `passed = true`;
- all 18 checks passed;
- forbidden tracked secret paths: none;
- current high-confidence secret findings: none;
- Git patch-history high-confidence secret findings: none;
- production `dist/` provider-secret findings: none;
- persistent browser-storage findings: none;
- both OpenAI request paths kept `store: false`;
- natural-edit outbound context remained bounded to request + room IDs + entity ID/type/roomId;
- hosted DesignIntent response echoed neither generation prompt nor secret and used `Cache-Control: no-store`;
- natural-edit response echoed neither prompt nor secret and used `Cache-Control: no-store`;
- both Pages Function sources had no console logging;
- browser generation request sent prompt only;
- browser natural-edit request used the bounded context;
- evidence contained neither full prompt nor secret.

This closes the DAI-081 new-endpoint re-audit condition.

## Build boundary

DAI-074 runs after `npm run build:hosting` so the actual production `dist/` output is scanned rather than assuming source boundaries imply bundle safety.

## Required validation

```powershell
git fetch origin
git switch feat/dai-081-public-gate
git pull --ff-only origin feat/dai-081-public-gate
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


## DAI-100 AI Edit V3 re-audit scope

DAI-100 AI Edit V3 adds bounded Corridor authoring topology to the natural-edit provider context so the single-command translator can identify, add, remove, reconnect, and set cardinal doorway sides on Corridors.

The re-audit requires the outbound context to contain exactly:

- Rooms: `id/x/z/width/depth`;
- Entities: `id/type/roomId`;
- Corridors: `id/fromRoomId/toRoomId/width/kind/fromSide/toSide`.

Events, Play/Run state, renderer objects and route meshes, browser persistence, files, account identifiers, and credentials remain excluded.

The existing `store:false`, server-side secret, prompt/secret non-echo, `Cache-Control:no-store`, no-console-logging, dist secret scan, and browser-persistence checks remain unchanged.

This change is not accepted until the DAI-100 structural AI Edit gate reruns `validate:secret-privacy` successfully.
