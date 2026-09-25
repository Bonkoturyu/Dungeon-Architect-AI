# Judge Quick Start

## Live demo

https://dungeon-architect-ai.pages.dev/


> **Current-status note (2026-09-25):** this URL is the refreshed DAI-099 production candidate. Public E2E passed against the frozen candidate commit/runtime-source fingerprint, and DAI-090 unexpected-prompt verification passed 20/20 cases without a runtime fix.

## Supported judging environment

- desktop Google Chrome on Windows;
- 1440 × 900 or comparable desktop viewport;
- mobile/narrow is best-effort only and is not a supported submission target.

## Current production walkthrough

The steps below describe the refreshed production UI verified by DAI-099.

## Walkthrough

1. Open the live demo. The five-step Guide opens at Welcome and includes Describe, Edit, Validate and Play.
2. In **Create**, enter:
   ```text
   Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.
   ```
   Set **Floors** to `2`.
3. Click **Generate**. The production cloud path returns validated DesignIntent and the browser builds a deterministic two-floor DungeonRunSpec.
4. Confirm the validation pill shows `✓ Valid`.
5. Select **Edit**. Use the Entity inspector for a manual authoring change if desired.
6. In **Natural-language edit**, enter:
   ```text
   Move the treasure to the room that contains the goal.
   ```
7. Confirm the AI edit applies one constrained `move-entity` command.
8. Select **Play**, then press **▶ Test** to play the current authored dungeon. **🎲 Mystery** instead uses a fresh Seed to reroll routes/content without exposing the authored map. Generator V1 can still produce a similar room layout because its spatial embedding is fixed for a given room count.
9. Play begins with Fog of War and the lower **LV / HP / EXP / G** HUD. If a centered Room Event blocks exits, resolve it first (for example **CLEAR** an Enemy or **AVOID / RISK** a Trap).
10. Move using the directional **CHOOSE EXIT** pad. Explored rooms and traversed corridors remain mapped; hidden topology and the Goal stay concealed until discovered.
11. Clear Floor 1, continue into Floor 2 with PlayerState carried forward, then reach the final Goal.
12. Confirm Result shows the cleared **Floor 2/2** run state and compact metrics.
13. Use **Return to Edit**; the generated authoring run remains available.

## AI/data boundary

Generation sends the generation request text to same-origin `/api/design-intent`.

Natural-language edit sends:

- request text;
- room IDs;
- entity ID / type / room ID.

The server-side Pages Functions hold `OPENAI_API_KEY`; the browser never receives it.

## Current boundaries

This demo does not claim:

- arbitrary free-form runtime code generation;
- general multi-command natural-language editing;
- mobile support;
- a final Perspective or Combat selection;
- persistent saves/accounts;
- Safari or Firefox acceptance.

See [Known Limitations](KNOWN_LIMITATIONS.md).
