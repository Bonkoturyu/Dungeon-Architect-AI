# ADR-004 — Final Focus Category: AI 3D Scene Generation

## Status

**Confirmed**

Decision date: 2026-09-19

## Context

AI Builder Hackathon 2026 requires a chosen focus category as part of the final submission.

The organizer's public build-period guidance describes projects such as prompt-to-world creation, AI-assisted 3D editing, procedural environments, browser-based AI editors, and other systems connecting natural language, 3D creation, and functional interaction.

The Kaggle competition page currently exposes the explicit track/category:

**AI 3D Scene Generation**

with the public description that the category covers tools transforming plain-language prompts into 3D environments, objects, layouts, or full interactive scenes directly in the browser.

## Production evidence

The current Dungeon Architect AI candidate directly demonstrates this category:

- natural-language dungeon request in the public browser UI;
- cloud AI transformation into validated `DesignIntent`;
- deterministic generation into a renderer-independent `DungeonSpec`;
- low-poly Three.js scene generation;
- generated Start / Goal / enemies / treasure / traps / recovery / supported event;
- manual edit and constrained natural-language edit;
- validation / START gate;
- playable browser loop and Result;
- public Cloudflare Pages deployment;
- DAI-081 public E2E acceptance;
- DAI-026 corrected corridor presentation;
- DAI-082 final demo-video acceptance.

## Decision

For the current submission:

**Final focus category: `AI 3D Scene Generation`**

This is the closest and most directly evidenced public category label for the production candidate.

## Source references

- https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract
- https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3

## Boundaries

This category decision does not broaden the product claims.

In particular, it does not imply:

- unrestricted world generation;
- arbitrary executable-code generation;
- final Perspective / Combat selection;
- mobile support;
- general-purpose DCC functionality.

## Reversal conditions

Reopen this ADR if:

1. the actual final submission form presents a different mandatory category list;
2. the organizer renames/removes the public category;
3. a materially different focus category becomes a closer description of the production candidate before submission.
