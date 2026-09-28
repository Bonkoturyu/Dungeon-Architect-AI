# Privacy / Data Flow — Submission Candidate

## Scope

This document describes the current Dungeon Architect AI public browser candidate and its production AI boundary.

## Browser-local data

The editor keeps authoring/play state in memory for the active page session.

It does not intentionally persist project state, prompts, credentials, or user identifiers through:

- `localStorage`;
- `sessionStorage`;
- IndexedDB;
- cookies.

There is no account, profile, analytics, advertising, telemetry, or database feature in the current MVP.

## Initial generation data flow

When the user presses **Generate dungeon**, the browser sends a same-origin `POST /api/design-intent` request containing only:

- the natural-language generation request.

The Pages Function routes the request through the production Cloud → deterministic fallback intent router.

When cloud is configured, the server-side OpenAI path transforms the prompt into schema-constrained `DesignIntent`. OpenAI requests explicitly use `store: false`.

The browser receives validated DesignIntent plus bounded provider/model/usage metadata. It then performs deterministic `DesignIntent → DungeonSpec` generation locally.

The Function does not intentionally echo the full prompt or provider credential and uses `Cache-Control: no-store`.

## Natural-language edit data flow

When the user presses **Apply AI edit**, the browser sends same-origin `POST /api/natural-edit` containing:

1. the edit request;
2. bounded authoring context:
   - room ID plus authoring geometry only: `x`, `z`, `width`, and `depth`;
   - entity ID, type, and room ID only;
   - corridor ID, endpoint Room IDs, width, kind, and optional cardinal endpoint sides only.

The browser does not send renderer objects, Events, Play/Run state, credentials, account data, arbitrary files, or corridor mesh/routing geometry. Room geometry is included so the natural-edit translator can express bounded Room movement/resizing/creation. Corridor topology is included only so AI Edit V3 can identify, create, remove, reconnect, or set cardinal door sides on existing authoring Corridors.

The Pages Function forwards the normalized request through the production OpenAI edit adapter. The OpenAI request explicitly uses `store: false`.

## Response boundary

The generation endpoint returns validated DesignIntent and bounded provider/model/usage metadata.

The edit endpoint returns:

- one validated supported `EditCommand` in the DAI-100 AI Edit V3 single-command set: `move-entity`, `move-room`, `resize-room`, `add-entity`, `remove-entity`, `add-room`, `remove-room`, `add-corridor`, `remove-corridor`, `reconnect-corridor`, or `set-corridor-doors`;
- provider/model identifiers;
- bounded token-usage metadata when available.

Both APIs use `Cache-Control: no-store` and must not intentionally echo provider credentials.

`store: false` is a response-storage control and is **not** represented as Zero Data Retention. Provider processing/retention remains governed by applicable API terms and controls.

## Secrets

`OPENAI_API_KEY` exists only as a server-side runtime secret/binding.

It must not be placed in:

- browser source or `dist/`;
- Git-tracked `.env*` or `.dev.vars*` files;
- screenshots or evidence JSON;
- command-line arguments;
- documentation examples containing a real value.

## Re-audit conditions

DAI-074 must be reopened if the candidate adds:

- accounts or persistent user identifiers;
- analytics/telemetry;
- persistent prompt or dungeon storage;
- additional provider credentials;
- additional outbound data fields;
- a new AI/provider endpoint;
- cookies or browser storage;
- file upload.

DAI-081 added `/api/design-intent`, so the privacy audit is explicitly rerun before the hosted-demo PR merges.

DAI-100 AI Edit V2 expanded the bounded Room context from ID-only to ID + `x/z/width/depth`.

DAI-100 AI Edit V3 additionally exposes bounded Corridor authoring topology: `id/fromRoomId/toRoomId/width/kind/fromSide/toSide`. It still excludes Events, renderer/runtime state, files, persistence, and credentials. This is another documented outbound-data-field change, so DAI-074 must pass again before any DAI-100 replacement candidate is published.
