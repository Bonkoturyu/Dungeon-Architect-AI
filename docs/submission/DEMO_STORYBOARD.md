# Demo Storyboard

## 現在の提出動画（2026-10-19更新）

**150-second glb_v5 を提出動画とする。新規撮影は行いません。**

- ファイル: `DAI_Demo_Review_EN_2026-10-03_glb_v5.mp4`
- SHA-256: `161f7674bb6963df212118919601b1da284622c234e566a156ea73c93bb17f9e`
- 150秒、1920×1080、30 fps
- 2026-10-04時点で保持していた150秒v2（`DAI_Demo_Review_EN_2026-10-03.mp4` の修正版）を元に、0:24〜0:30 と 2:14〜2:25.5 の2区間だけを、JSON / GLB書き出しの比較画面・ナレーション・字幕に差し替えた版。ほかの映像・音声はv2を引き継ぐ。2026-10-19にv2と1秒ごとに映像を比べ、差がこの2区間だけであることを確認した（音声は比較していない）
- GLBの場面は、アプリの3D構築とGLTFExporterの処理をNodeのテストで動かして出力した別サンプル階のGLBを、Blenderで描画した静止画。動画内にもその旨を表示している。アプリの追加撮影はしていない
- アプリ操作の映像はv2のもの（Generate 1回、AI Editの `resize-room` とUndo）。制作の来歴と検証限界は [AI usage register](../legal/AI_USAGE.md) を参照
- 2026-10-19に、10秒ごとの静止画を公開候補 `806d70c` の画面と比べ、審査で混乱しそうな食い違いがないことを確認した（目に見える違いはDetails見出しの折りたたみボタンの有無だけ）
- 公開アップロード・最終提出の完了は主張しません。現UI・candidateとの整合および残る確認は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) を参照

置き換え前の150秒v2（同一性は [AI usage register](../legal/AI_USAGE.md) に記録）、旧M8の49.5秒動画、旧DAI-099の59.9秒動画は歴史的証拠として保持します。以下の旧撮影計画／runnerは現在の150秒glb_v5を作成・再検証した証拠ではありません。候補の確認では matching build fingerprint と動画identityを区別します。

## 歴史的DAI-099撮影計画（2026-09）

当時の状態: **DAI-099 REFRESH IN PROGRESS — FINAL CAPTURE PENDING.**

Requirement: **under 3 minutes**. The previously accepted 49.5-second capture remains historical evidence for the earlier M8 candidate and must not be treated as the final video for the current DAI-085–098 runtime.

Use the actual public candidate:

https://dungeon-architect-ai.pages.dev/

The pre-DAI-026 and misframed interim captures are rejected. The accepted capture uses the corrected DAI-026 public candidate and fullscreen viewport-only framing.

## Historical storyboard

1. **0:00–0:08 — Title / problem**
   - Dungeon Architect AI
   - “Describe. Edit. Play.”

2. **0:08–0:32 — Describe / Generate**
   - request a verified **2-floor** dungeon;
   - click Generate;
   - hold the generated 3D dungeon and current valid state;
   - briefly expose the Floor selector to make multi-floor generation obvious.

3. **0:32–0:48 — Generated state**
   - briefly show rooms/entities and the non-overlapping routed corridors.

4. **0:48–1:05 — Manual Edit**
   - select one room;
   - move it;
   - Undo.

5. **1:05–1:30 — Natural-language Edit**
   - enter the verified treasure-relocation request;
   - apply;
   - show `applied: move-entity`.

6. **1:30–2:05 — Test / Explore**
   - select **Play** and press **▶ Test**;
   - show the current **LV / HP / EXP / G** HUD;
   - show Fog of War / auto-map;
   - resolve a visible centered blocking Room Event;
   - show the programmatic Player/Enemy presentation;
   - traverse using the directional **CHOOSE EXIT** pad;
   - show Floor 1 advancing into Floor 2.

7. **2:05–2:18 — Result**
   - hold the cleared **Floor 2/2** Result and compact run/gameplay metrics.

8. **2:12–2:22 — Return to Edit**
   - return to authoring view.

9. **2:22–2:30 — End card**
   - “Dungeon Architect AI — Describe. Edit. Play.”
   - public demo URL.

## Recording rule

Record the real hosted candidate only after DAI-097 and DAI-098 are complete, DAI-099 has deployed the refreshed runtime, and refreshed public E2E passes with a matching build fingerprint. Cuts/titles/narration are allowed, but do not use the historical pre-polish capture as the final judge-facing video.

See `docs/testing/DAI-082_VIDEO.md`.


DAI-099 refreshed-video acceptance is tracked in `docs/testing/DAI-099_REFRESHED_VIDEO.md`.
