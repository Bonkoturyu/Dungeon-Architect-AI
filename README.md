# Dungeon Architect AI

**Team:** a few  
**Tagline:** Describe. Edit. Play.  
**Target:** AI Builder Hackathon 2026  
**License:** Apache-2.0

Dungeon Architect AI is a browser-native AI dungeon design tool that transforms natural-language game-design intent into validated, editable, and immediately playable low-poly 3D dungeons.

## Core flow

```text
DESCRIBE
  ↓
GENERATE
  ↓
EDIT
  ↓
VALIDATE
  ↓
START
  ↓
PLAY
  ↓
RESULT / REVEAL
```

## Production status

Production implementation started after the official Build Period began. This repository is a clean production repository and does not copy implementation source from the pre-production experiments.

Pre-production knowledge source:

- Repository: `Bonkoturyu/Dungeon-Architect-AI-Preproduction`
- Handoff baseline: `11f9ee883abf282bdbd306848d56673d1e8117e7`

The pre-production repository is used only as a source of specifications, interfaces, pseudocode, benchmark results, known issues, test cases, decisions, and license evidence. Experiment implementation source is not copied into this repository.

## MVP

The MVP must allow a judge to:

1. Describe a dungeon in natural language.
2. Generate a low-poly 3D dungeon and working game logic.
3. Edit part of the dungeon manually and through at least one natural-language edit path.
4. Validate reachability and critical rules.
5. Press `START` and play the generated dungeon in the same browser experience.
6. Reach a Result / Reveal screen that explains the outcome and generated design intent.

## Repository rules

- Original project code: Apache-2.0.
- Third-party creative assets: CC0 1.0 Universal only.
- Third-party software dependencies: only after license/provenance review and explicit approval.
- No API keys, tokens, credentials, registration evidence, or other private information in the public repository.
- `DungeonSpec` remains renderer-independent.
- LLM output must be schema-validated before use.
- Critical validation errors block `START`.

See `AGENTS.md` and `docs/` for production governance and requirements.
