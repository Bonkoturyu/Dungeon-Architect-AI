# Judge Quick Start

## Live demo

https://dungeon-architect-ai.pages.dev/

## Supported judging environment

- desktop Google Chrome on Windows;
- 1440 × 900 or comparable desktop viewport;
- mobile/narrow is best-effort only and is not a supported submission target.

## Walkthrough

1. Open the live demo. The five-step Guide opens at Welcome and includes Describe, Edit, Validate and Play.
2. In **Create**, enter:
   ```text
   Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.
   ```
3. Click **Generate dungeon**. The production cloud path returns validated DesignIntent and the browser builds a deterministic DungeonSpec.
4. Confirm the validation pill shows `✓ Valid`.
5. Select **Edit**. Use the Entity inspector for a manual authoring change if desired.
6. In **Natural-language edit**, enter:
   ```text
   Move the treasure to the room that contains the goal.
   ```
7. Confirm the AI edit applies one constrained `move-entity` command.
8. Select **Play**, then press **▶ Test** to play the current authored dungeon. **🎲 Mystery** instead uses a fresh Seed to reroll routes/content without exposing the authored map. Generator V1 can still produce a similar room layout because its spatial embedding is fixed for a given room count.
9. Play begins with Fog of War. If a Room Event blocks exits, resolve it first (for example **CLEAR** an Enemy or **AVOID / RISK** a Trap).
10. Move using the directional **CHOOSE EXIT** pad. Explored rooms and traversed corridors remain mapped; hidden topology and the Goal stay concealed until discovered.
11. Reach the Goal and confirm Result shows `✓ CLEARED` with compact run metrics.
12. Use **Return to Edit**; the generated authoring spec remains available.

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
