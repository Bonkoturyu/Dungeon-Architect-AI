# Judge Quick Start

## Live demo

https://dungeon-architect-ai.pages.dev/


> Verification status for the current candidate, including the boundary of the owner live check, is summarized in Japanese under **Verification status** at the end of this page.

## Supported judging environment

- desktop Google Chrome on Windows;
- 1440 × 900 or comparable desktop viewport;
- mobile/narrow is best-effort only and is not a supported submission target.

## Current repository walkthrough

The steps below describe the current repository UI. The browser Recommended selection is V3; 11 generator strategies are available. Check the linked candidate record before treating any example as evidence for a specific deployment.

## Walkthrough

1. Open the live demo. The five-step Guide opens at Welcome and includes Describe, Edit, Validate and Play.
2. In **Create**, enter:
   ```text
   Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.
   ```
   Set **Floors** to `2`.
3. Choose difficulty beside **Generate**, and select Automatic (Auto) or Manual generation settings. Click **Generate**. Auto applies valid interpreted settings; ambiguous or unsupported settings can be rejected without replacing the current dungeon. Manual opens a confirmation screen where **Generate** commits the settings and **Cancel** leaves authoring unchanged. Unspecified random choices are revealed after generation. The cloud path or bounded fallback returns validated input for the local two-floor generator.
4. Confirm the validation pill shows `✓ Valid`.
5. Select **Edit**. Use the Entity inspector for a manual authoring change if desired.
6. In **Natural-language edit**, enter:
   ```text
   Move the treasure to the room that contains the goal.
   ```
7. For this request, confirm one validated `move-entity` is applied. AI Edit V3 supports 11 single-command types, including Room movement/resizing and Corridor editing; it does not execute batches or arbitrary code. Undo remains available.
8. Select **Play**, then press **▶ Test** to play the current authored dungeon. **🎲 Mystery** instead uses a fresh Seed to reroll routes/content without exposing the authored map. The selected strategy determines the terrain; V1 retains its fixed-layout baseline.
9. Play begins with Fog of War and the lower **LV / HP / EXP / G** HUD. Resolve blocking Room Events first. Traps use one **TRY TO AVOID** action with a displayed **70%** success rate and failure damage; either result resolves the trap once. The floor Seed and trap ID fix the outcome across replay/import.
10. Move using the directional **CHOOSE EXIT** pad. Explored rooms and traversed corridors remain mapped; hidden topology and the Goal stay concealed until discovered.
11. At Goal, resolve any required active enemies/traps, then use **Finish floor** when the completion action is shown. Continue into Floor 2 with PlayerState carried forward, then clear the final Goal. Shop purchases are optional.
12. Confirm Result shows the cleared **Floor 2/2** run state and compact metrics.
13. Use **Return to Edit**; the generated authoring run remains available.
14. Optional: in **Create** → **Import / Export**, **GLB · current floor (3D visuals)** saves the displayed floor's geometry and materials for other 3D tools. It contains no gameplay data and cannot be re-imported into Dungeon Architect AI; lighting may differ.

## AI/data boundary

Generation sends the request text and fixed `includeRoomRequests: true` flag to same-origin `/api/design-intent`.

Natural-language edit sends:

- request text;
- room ID / `x` / `z` / `width` / `depth`;
- entity ID / type / room ID;
- corridor ID / `fromRoomId` / `toRoomId` / `width` / `kind` / `fromSide` / `toSide`.

Events, renderer objects, Play/Run state, files and credentials are excluded. See [Privacy / Data Flow](../privacy/PRIVACY_DATA_FLOW.md).

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

## Verification status

> **確認状況（2026-10-04）:** 現仕様の操作案内です。公開版の対象commit、実provider確認、未完了の受入項目は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) を参照してください。過去の公開E2Eだけで現候補の全項目PASSとはしていません。

所有者のWindows Brave/Chromiumによる限定live確認で、Generateのcloud Response、AI Editの `move-entity` Responseと画面適用を確認済みです。公開build-infoと対象mainのcommit/source/bundle一致、全公開E2E、全異常入力への合格はこの確認に含みません。根拠は [限定live確認記録](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/3196f2bb942bbdfbcddc2481416f24d7196c5ead/docs/testing/LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md) を参照してください。公開build-infoと候補commitの一致、全公開E2Eは、2026-10-19に候補 `806d70c` で別途確認しました（[記録](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md)）。
