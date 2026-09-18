# Privacy / Data Flow — Submission Candidate

## Scope

This document describes the current Dungeon Architect AI browser submission candidate and its production AI boundary.

## Browser-local data

The current editor keeps authoring/play state in memory for the active page session.

The production editor does not intentionally persist project state, prompts, credentials, or user identifiers through:

- `localStorage`;
- `sessionStorage`;
- IndexedDB;
- cookies.

There is no account, profile, analytics, advertising, telemetry, or database feature in the current MVP.

## Natural-language edit data flow

When the user presses **Apply AI edit**, the browser sends a same-origin `POST /api/natural-edit` request containing:

1. the natural-language edit request;
2. a bounded authoring context:
   - room IDs only;
   - entity ID, type, and room ID only.

The browser does not send renderer objects, full runtime state, credentials, account data, or arbitrary files.

The Cloudflare Pages Function forwards the normalized request to the configured OpenAI Responses API model through the existing backend transport.

The OpenAI request explicitly uses `store: false`. This is a response-storage control and is **not** represented as Zero Data Retention.

Provider processing and any provider-side retention remain governed by the provider's applicable API terms and controls.

## Response boundary

The browser receives only:

- one validated supported `EditCommand`;
- provider/model identifiers;
- bounded token-usage metadata when available.

The Pages Function does not intentionally echo the full prompt or provider credential in its response.

API responses use `Cache-Control: no-store`.

## Secrets

`OPENAI_API_KEY` exists only as a server-side runtime secret/binding.

It must not be placed in:

- browser source or `dist/`;
- Git-tracked `.env*` or `.dev.vars*` files;
- screenshots or evidence JSON;
- command-line arguments;
- documentation examples containing a real value.

## Cloud DesignIntent adapter

The repository also contains the production cloud DesignIntent adapter. Its OpenAI request likewise sets `store: false`.

The currently verified hosted editor surface exposes the natural-language edit path; any future browser surface that enables initial cloud DesignIntent generation must preserve the same server-side credential and privacy boundary.

## Re-audit conditions

DAI-074 must be reopened if the submission candidate adds any of the following:

- accounts or persistent user identifiers;
- analytics/telemetry;
- persistent prompt or dungeon storage;
- additional provider credentials;
- additional outbound data fields;
- a new AI/provider endpoint;
- cookies or browser storage;
- file upload.
