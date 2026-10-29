# Judge Quick Start

## Live demo

https://dungeon-architect-ai.pages.dev/


> Verification status for the current candidate, including the boundary of the owner live check, is summarized in Japanese under **Verification status** at the end of this page.

## What to evaluate

Dungeon Architect AI is for indie level designers who want to turn a level idea into an editable, playable prototype. The intended benefit is joining generation, refinement and playtesting in one browser workflow; adoption and time savings are not yet measured.

The walkthrough demonstrates that core loop. The optional reuse checks below distinguish implemented generalizability from future possibilities: multiple strategies share `DungeonSpec` and the same editor/play workflow; JSON supports authoring exchange; GLB supports static appearance export. No other-domain deployment is claimed.

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
3. Choose a difficulty in **Difficulty** above **Generate**, and keep **Generation settings** at Manual (the default) or select Automatic (Auto). Click **Generate**. Auto applies valid interpreted settings; ambiguous or unsupported settings can be rejected without replacing the current dungeon. Manual opens a confirmation screen where **Generate this plan** commits the settings and **Cancel** leaves authoring unchanged. Unspecified random choices are revealed after generation. The cloud path or bounded fallback returns validated input for the local two-floor generator.
4. Confirm the validation pill shows `✓ Valid`.
5. Select **Edit**. Use the **Entities** / **Rooms** / **Corridors** inspector for a manual authoring change if desired. The **Details** heading in the 3D view folds or restores the selection details.
6. In **AI Request**, enter:
   ```text
   Move the treasure to the room that contains the goal.
   ```
7. Press **Apply**. For this request, confirm one validated `move-entity` is applied. AI Edit V3 supports 11 single-command types, including Room movement/resizing and Corridor editing; it does not execute batches or arbitrary code. Undo remains available.
8. Select **Play**, then press **▶ Test** to play the current authored dungeon. **🎲 Mystery** instead uses a fresh Seed to reroll routes/content without exposing the authored map. The selected strategy determines the terrain; V1 retains its fixed-layout baseline.
9. Play begins with Fog of War and the lower **LV / HP / EXP / G** HUD. Resolve blocking Room Events first. Traps use one **TRY TO AVOID** action with a displayed **70%** success rate and failure damage; either result resolves the trap once. The floor Seed and trap ID fix the outcome across replay/import.
10. Move using the directional **CHOOSE EXIT** pad. Explored rooms and traversed corridors remain mapped; hidden topology and the Goal stay concealed until discovered.
11. At Goal, resolve any required active enemies/traps, then use **Finish floor** when the completion action is shown. Continue into Floor 2 with PlayerState carried forward, then clear the final Goal. Shop purchases are optional.
12. Confirm Result shows **✓ CLEARED**, the cleared Floor 2/2 run state (the **Floors** row reads `2/2`) and compact metrics.
13. Use **◀ Edit** at the top to return to Edit; the generated authoring run remains available.
14. Optional: in **Create** → **Import / Export**, **GLB · current floor (3D visuals)** saves the displayed floor's geometry and materials for other 3D tools. It contains no gameplay data and cannot be re-imported into Dungeon Architect AI; lighting may differ.

## Optional reuse checks

Save Full JSON first if you want to keep the current authored dungeon before generating a variant or importing a file. These are inspection instructions, not a claim that every variant was included in the recorded live-provider acceptance.

1. In **Create**, inspect the generator selector. Recommended is V3; 11 strategies share the authoring and play workflow. V3 shares V2 terrain, so this is not 11 independent terrain algorithms. Generate a variant with another strategy and inspect it in **Edit**; recheck validation before **Play > Test**.
2. In **Create > Import / Export**, save **Full JSON** and import it to continue editing all floors' DungeonSpec, entities and events. It does not save current HP, play progress or Undo history. **Layout JSON** exchanges rooms, corridors, Seed and Start/Goal roles without entity/event content; it is not a full-content backup.
3. Use **GLB · current floor (3D visuals)** for the displayed floor's static geometry and materials. Other floors require separate exports. It contains no gameplay, camera, lighting, audio or animation and cannot be re-imported into this app. A different 3D tool may render the lighting differently.

Architecturally, `DungeonSpec` is renderer-independent. Reuse already exists inside this dungeon workflow and its documented output formats; adaptation to another domain would require new domain data and validation and is not implemented here. See [JSON / GLB scope](../architecture/GLB_EXPORT.md).

## Reproducibility and cloud availability

Generation is deterministic for the same normalized input, Seed, settings, strategy and version. A fresh live-model interpretation can differ, so re-entering the same wording is not a guarantee of identical output. Full JSON is the authoring-data handoff for an existing result.

If generation falls back because cloud AI is unavailable, **Manual** mode shows review warnings; **Auto** stops without replacing the current dungeon. Do not label fallback output as a live-model result. **AI Edit** has no fallback and leaves the dungeon unchanged on error; manual editing remains available. See [Known Limitations](KNOWN_LIMITATIONS.md).

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

The 2026-10-29 revision adds benefit, reuse and export guidance only. It does not change the runtime or declare new Windows/browser/live-provider acceptance. The historical records below keep their original dates, commits and scope.

> **確認状況（2026-10-04、2026-10-19に画面表記を照合）:** 現仕様の操作案内です。公開版の対象commit、実provider確認、未完了の受入項目は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) を参照してください。過去の公開E2Eだけで現候補の全項目PASSとはしていません。

所有者のWindows Brave/Chromiumによる限定live確認で、Generateのcloud Response、AI Editの `move-entity` Responseと画面適用を確認済みです。公開build-infoと対象mainのcommit/source/bundle一致、全公開E2E、全異常入力への合格はこの確認に含みません。根拠は [限定live確認記録](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/3196f2bb942bbdfbcddc2481416f24d7196c5ead/docs/testing/LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md) を参照してください。公開 `build-info.json` と候補commitの一致、全公開E2Eは、2026-10-19に候補 `806d70c` で別途確認しました（[記録](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md)）。公開版の異常入力確認も同日に行いました（[記録](../testing/PUBLIC_ABNORMAL_INPUT_DAI090_2026-10-19.md)）。

