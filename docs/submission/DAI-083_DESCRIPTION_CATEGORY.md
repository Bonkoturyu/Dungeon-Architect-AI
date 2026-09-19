# DAI-083 Submission Description / Focus Category

## Status

**CONFIRMED candidate metadata.** The short description and final focus category are frozen for the current submission candidate, subject only to reopening if the actual submission form exposes a materially different category list or a stricter description-length limit.

## Official submission requirement

The organizer asks for:

- a short-written description explaining what was built;
- the problem or opportunity explored;
- how AI is used;
- a chosen focus category.

Current public sources do not state a character or word limit for the short description.

## Focus category

**AI 3D Scene Generation**

Public category source:

- Kaggle competition track: https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract
- Victoria VR build-period guidance: https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3

The public Kaggle track describes this category as tools that transform plain-language prompts into 3D environments, objects, layouts, or full interactive scenes directly in the browser.

Dungeon Architect AI matches that definition through verified production behavior:

- plain-language dungeon request;
- cloud AI → validated `DesignIntent`;
- deterministic `DesignIntent → DungeonSpec`;
- rendered low-poly 3D dungeon in the browser;
- manual and constrained natural-language editing;
- validation;
- immediate browser Play / Result loop.

## Primary short description

Use this text when the form accepts approximately 500 characters or more:

> Dungeon Architect AI is a browser-based tool that turns plain-language game-design intent into a validated, editable, playable low-poly 3D dungeon. It addresses the gap between describing a level and building a functional prototype: an LLM converts the prompt into structured DesignIntent, deterministic generation produces a DungeonSpec, and the same browser experience lets users edit, validate, and play the result. AI also supports constrained natural-language edits without generating arbitrary runtime code.

Measured length:

- 513 characters;
- 70 whitespace-delimited words.

## Compact fallback

Use this only if the final form exposes a tighter limit:

> Dungeon Architect AI turns plain-language design intent into validated, editable, playable low-poly 3D dungeons in the browser, using AI for structured DesignIntent generation and constrained natural-language edits.

Measured length:

- 215 characters;
- 27 whitespace-delimited words.

## Claim boundaries

The submission text intentionally does **not** claim:

- arbitrary free-form runtime-code generation;
- unrestricted multi-command natural-language editing;
- physics-character locomotion;
- final Perspective / Combat selection;
- mobile support;
- persistent accounts or cloud project storage.

## Production evidence basis

The chosen metadata is grounded in the current production candidate:

- DAI-081 public hosted flow: DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT;
- DAI-026 corrected continuous orthogonal corridor presentation;
- DAI-082 final public-demo video;
- current production README / Judge Quick Start / Known Limitations.

## Reopen conditions

Reopen DAI-083 if:

1. the final submission form exposes a focus-category list that does not contain `AI 3D Scene Generation`;
2. the final form imposes a description limit below 513 characters and the compact fallback is still too long;
3. production behavior changes enough that the wording becomes inaccurate;
4. organizer guidance changes the required submission metadata.
