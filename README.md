# Dungeon Architect AI

**Describe. Edit. Play.**

Dungeon Architect AI is a browser-first dungeon-design project for **AI Builder Hackathon 2026**. A natural-language design request is translated into validated `DesignIntent`, mapped into a deterministic low-poly `DungeonSpec`, then edited, validated and played in the same browser experience.

**Live demo:** https://dungeon-architect-ai.pages.dev/

## Verified browser flow

```text
DESCRIBE
  ↓
GENERATE
  ↓
EDIT
  ↓
VALIDATE
  ↓
TEST / MYSTERY
  ↓
EXPLORE + ROOM EVENTS
  ↓
RESULT
```

The repository flow has focused local and hosted regression evidence. See [the 2026-10-03 acceptance record](docs/testing/ACCEPTANCE_GAP_2026-10-03.md) for its exact commit and fixture-based scope. Historical M8 / DAI-099 public-E2E evidence is retained separately; it is not a full acceptance claim for the current candidate.

Current pre-submission verification status (recovery point, latest Windows integrated run and its scope, owner live check boundary) is recorded in Japanese in the section **提出前の確認状況** near the end of this README.

## Judge quick start

See **[Judge Quick Start](docs/submission/JUDGE_QUICKSTART.md)**.

Recommended judging environment:

- desktop Google Chrome on Windows;
- 1440 × 900 or comparable desktop viewport;
- mobile/narrow layouts are best-effort only.

Suggested refreshed-candidate generation prompt:

```text
Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.
```

Suggested natural-language edit:

```text
Move the treasure to the room that contains the goal.
```

Then confirm `✓ Valid`, open **Play**, choose **▶ Test** (current authored dungeon) or **🎲 Mystery** (fresh Seed that rerolls routes/content without revealing the authored map), resolve any blocking Room Events, navigate with the directional **CHOOSE EXIT** pad until Goal, inspect `✓ CLEARED`, and use **← Edit**. The browser Recommended selection is V3; 11 generator strategies remain selectable, including V1/V2 and BSP.

## What is production-backed today

| Area | Current status |
|---|---|
| Public demo | Hosted Cloudflare Pages demo; candidate-specific evidence and remaining acceptance gates are tracked in PR #74 |
| Renderer | Three.js `0.185.1`, retained by ADR-001; historical benchmark limitations are documented and later production evidence validates the current stack |
| DungeonSpec | Renderer-independent schema, parser, validation, deterministic generation |
| Procedural core | Deterministic graph/layout, corridors, Start/Goal, route-choice controls, Seed reproducibility |
| Natural-language generation | OpenAI Responses cloud path + deterministic fallback → validated DesignIntent → bounded DungeonSpec mapping |
| Play core | Session snapshot, Fog of War / auto-map, directional exits, Room Events, HP/Level/XP/Gold/equipment, 1–10 floor runs with PlayerState carry, Test/Mystery play, clear/failure Result |
| Natural-language edit | AI Edit V3 supports one validated command per request across 11 Room/Entity/Corridor command types; live and fixture evidence remain distinct |
| Edit mode | Room select/move/resize/add/remove; corridor add/remove + N/E/S/W endpoint-side editing; entity add/move/remove; Undo/Redo; Start→Goal route check |
| UI languages | English (default), Japanese, Simplified Chinese, Traditional Chinese, Korean; live switching also available in onboarding |
| Validation | Critical Play gate with structural/reachability checks |
| Simulation | Deterministic simulator, shortest/greedy/cautious agents, metrics, intent-fit and explainable summary |
| Hosting | Cloudflare Pages + Pages Functions / ADR-002 |
| Legal/security | Dependency/AI/service registers, third-party notice, secret/privacy audit |
| Device scope | Desktop Chrome on Windows; mobile/narrow best-effort only / ADR-003 |

## Important current limitations

See **[Known Limitations](docs/submission/KNOWN_LIMITATIONS.md)**.

Key boundaries:

- DesignIntent → DungeonSpec generation is intentionally bounded; not every intent axis has a dedicated semantic generation mechanic;
- the natural-language edit surface supports one safe command per request across 11 allowed command types; batch transactions, Event editing and arbitrary runtime code remain unsupported;
- Play perspective and combat-model selection remain pending the frozen PCE-1.0 evaluation;
- mobile is outside the supported submission acceptance scope;
- no Safari/Firefox acceptance claim has been made;
- there are no accounts, persistent project storage, analytics or telemetry;
- historical public candidates, videos and freezes remain evidence for their recorded commits; the current submission candidate and remaining gates are tracked in PR #74.

## Sample prompts

See **[Sample Prompts](docs/submission/SAMPLE_PROMPTS.md)**.

The original one-floor M8 prompt and the September DAI-099 two-floor prompt retain their historical evidence. Current examples and their verification scope are listed in [Sample Prompts](docs/submission/SAMPLE_PROMPTS.md); one successful prompt does not establish all-prompt acceptance.

The repository also retains the frozen ten-case DesignIntent regression corpus at:

`spec/design-intent/fixtures/dai-045-prompt-regression-v1.json`

## 特殊部屋・店・難易度（共通内容レイヤー）

自然文でモンスターハウス／トラップハウス／店、個数、対象階、明示Room IDを指定できます。未指定の種類は各1/3の確率でラン全体に1部屋、明示した「置く／置かない」は優先します。確認画面でランダム／必ず置く／置かないを切り替えられ、同じSeedなら同じ結果です。選択した生成方式で地形を作り、共通内容レイヤーで部屋・難易度を適用します。生成設定の「自動」は明示指定を保ち、未指定値を自動で決めます。「手動」では右上のキャンセル／生成ボタンを使って確認・調整できます。店ではGでHP回復・武器・防具を購入でき、装備による被害軽減があります。敵の自由移動は追加していません。

例：`標準のダンジョン。room-003に敵3体のモンスターハウス。room-004に罠4個のトラップハウス。room-002に店。`

追加敵・罠は1階合計100体が標準上限。実測に基づく高度設定は250まで。相対位置指定など解釈できない表現は確認が必要です。ブラウザのRecommendedはV3です。V1/V2の明示選択とライブラリ既定V1は維持しています。Start/Goalも通常・ランダム・各特殊種類から選択できます。特殊Goalは敵・罠を全処理した後に「この階をクリア」で進み、店の購入はどの場所でも任意です。共通レイヤーの公開検証範囲は、対象commitを記録した [受入smoke記録](docs/testing/ACCEPTANCE_GAP_2026-10-03.md) とPR #74を参照してください。

難易度は生成ボタンの直前で選択します。「文章に合わせる」は自然文の指定を使い、未指定なら標準です。やさしい／標準／難しいを選ぶと文章より優先し、自動・手動の両方に適用します。確認画面ではランダムの抽選結果を表示せず、明示した種類・Start/Goalだけを編集できます。抽選結果は生成後に確認できます。[難易度・ランダム表示の検証](docs/testing/GENERATION_SETTINGS_2026-10-02.md)を参照してください。

UI・数量差別化は [ユーザーフィードバック対応](docs/testing/UI_FEEDBACK_2026-10-02.md)、共通レイヤーの初期検証は [生成方式維持・Auto・端点設定](docs/testing/ROOM_CONTENT_LAYER_2026-10-02.md)、既存V3の検証と制約は [特殊部屋V3検証](docs/testing/SPECIAL_ROOMS_V3_2026-10-02.md) を参照してください。

## 罠の回避判定

罠は「回避を試みる」1操作で、成功率70%（全難易度共通の暫定値）と失敗時の被害を表示します。成功は無傷、失敗は罠が発動し、どちらも1回で解決済みになります。同じ階Seed・罠IDでは再PlayやFull JSON再Importでも判定が変わりません。内容レイヤーは失敗分の被害を含む攻略経路を実Playで検査し、指定を守って確認できない場合は生成を拒否します。ルール未指定のJSONも現行70%へ正規化し、地形・個数・Seed・IDは保持します。旧内容レイヤー1/2と100%回避の互換分岐は廃止しました。BSPやGenerator V1/V2を含む11の選択可能な生成方式は引き続き利用できます。詳細は[現行ルールへの統一](docs/testing/CURRENT_CONTENT_RULES_2026-10-02.md)と[罠回避検証](docs/testing/TRAP_AVOIDANCE_2026-10-02.md)を参照してください。

## JSONで再編集 / GLBで3D外観を共有

Createの「インポート / エクスポート」から用途に合わせて保存できます。

- **完全JSON（Full JSON）**：全階のDungeonSpec、Entity、Eventを保存し、JSONインポートでDungeon内の編集を再開します。プレイ途中のHP・進行状況やUndo履歴の保存ではありません。
- **レイアウトJSON（Layout JSON）**：全階の部屋・通路・Start/Goal役割を交換します。敵・宝・罠などの内容やEventは含みません。
- **GLB · 表示中の階（3D外観）**：選択中の1階の確定済み形状・材質を、他の3Dツール向けに保存します。全階を自動積層しません。他の階は切り替えて個別に保存します。

GLBは床・壁・通路・配置物の静的な外観用です。ゲーム機能、進行状態、編集ハンドル、カメラ、照明・霧・音声・アニメーションは含まず、Dungeonへ再インポートできません。元の表示と照明の見え方は変わります。再編集用には完全JSONも保存してください。[範囲・座標・検証方法](docs/architecture/GLB_EXPORT.md)

## Generator versions and research

**Generator Version 1** is retained as a reproducibility baseline. The browser Recommended alias selects **V3**, with **11 generator strategies** available; V1/V2 and BSP remain selectable. V3 shares V2 terrain and adds the common content layer, so eleven selectable strategies are not a claim of eleven independent terrain algorithms.

- [Generator version registry / Version 1 specification](docs/architecture/GENERATOR_VERSIONS.md)
- [Dungeon generation algorithm research](docs/research/DUNGEON_GENERATION_ALGORITHMS.md)

`DungeonSpec schemaVersion` and `Generator Version` are separate concepts: the same DungeonSpec schema may be produced by multiple generator versions.

## Architecture

- `DesignIntent` represents normalized game-design intent.
- `DungeonSpec` is renderer-independent serialized dungeon data.
- Generator/Core produces deterministic structure and bounded intent-driven entities.
- Editor mutations go through explicit `EditCommand` operations.
- `▶ Test` creates a fixed execution snapshot of the current authored dungeon; `🎲 Mystery` uses a fresh Seed so route/content choices can change without exposing the authoring map. The selected generator strategy and its version determine spatial variability; V1 remains available as the fixed-layout baseline.
- Play Core does not directly mutate authoring state.
- Three.js consumes the spec/snapshot through a disposable renderer adapter.
- Cloudflare Pages Functions hold provider credentials server-side.
- AI output is schema-constrained and independently validated before application.

Relevant ADRs and design reviews:

- [Editor UI/UX Review — 2026-09-21](docs/research/EDITOR_UI_UX_REVIEW_2026-09-21.md)
- [ADR-001 — Three.js production renderer](docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md)
- [ADR-002 — Cloudflare Pages hosting](docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md)
- [ADR-003 — Desktop-only submission mobile scope](docs/architecture/adr/ADR-003-MOBILE-SCOPE-DESKTOP-ONLY.md)
- [ADR-004 — Final focus category: AI 3D Scene Generation](docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md)

## Run locally

Requirements:

- Windows
- Node.js `24.15.0` and npm
- desktop Google Chrome for production browser smokes

Install dependencies once:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

Start the local UI by double-clicking `run-ui.cmd` in the repository root (or running it from a terminal):

```powershell
.\run-ui.cmd
```

`run-ui.cmd` builds the production Pages output (`npm run build:hosting`), serves it at `http://127.0.0.1:8000/` and opens the default browser. **Generate** and **AI Edit** are forwarded by a local proxy to the public demo backend (`https://dungeon-architect-ai.pages.dev`); no API key is needed or stored on the local machine. Close the console window to stop the local server.

For UI-only development, `npx vite --host 127.0.0.1` serves the static development surface; it does not provide the `/api/*` endpoints, so the live AI buttons do not work there.

Build the production Pages output only:

```powershell
npm run build:hosting
```

See [Cloudflare Pages deployment](docs/deployment/CLOUDFLARE_PAGES.md).

## Verification

```powershell
npm test
```

Major evidence and task-specific gates are recorded under `docs/testing/` and `scripts/`.

## Privacy and AI boundary

- no accounts, analytics, ads, telemetry, database or persistent project storage are part of the current MVP;
- browser authoring/play state is in-memory;
- generation sends the generation request text to the same-origin `/api/design-intent` endpoint;
- natural-language edit sends request text plus bounded Room geometry, Entity identifiers, and Corridor authoring topology to `/api/natural-edit`; Events, runtime state, renderer data, files, and credentials remain excluded;
- `OPENAI_API_KEY` remains server-side;
- OpenAI requests explicitly use `store: false`;
- `store: false` is **not** claimed to be Zero Data Retention.

See [Privacy / Data Flow](docs/privacy/PRIVACY_DATA_FLOW.md).

## Licensing and provenance

Project code is licensed under **Apache-2.0**.

The current browser candidate uses no third-party or AI-generated creative assets. The selected redistributed third-party runtime is Three.js `0.185.1`; its MIT notice is included in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and copied into the production `dist/` build.

See:

- [Third-party dependencies](docs/legal/THIRD_PARTY_DEPENDENCIES.md)
- [Third-party creative assets](docs/legal/THIRD_PARTY_ASSETS.md)
- [AI usage register](docs/legal/AI_USAGE.md)
- [Third-party services](docs/legal/THIRD_PARTY_SERVICES.md)

## 提出前の確認状況（2026-10-04）

初回退避点の確認基準は `8bcce65246663bc16625a0f915ec2f202c63b5e4`。`rollback/pre-submission-2026-10-04` はこのcommitを保存する現状退避点であり、最終受入の全項目PASSを意味しません。初回退避と限定live確認の記録は [提出前検証記録 PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74)、最新のローカル統合と公開E2Eの結果は次の記録を参照してください。

最新のローカル統合は [公開候補 806d70c 統合確認](docs/testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md) の **24/24段階PASS** です。実測対象は `806d70c2be99863a2b14dbabf942422107898379`（PR #88 マージ後の `main`）で、Node 694/694 が成功しました。この候補は2026-10-05レビュー対応、GLB Export〔PR #78〕、詳細HUD分離〔PR #81〕などのruntime変更を含みます。後続のcommit（PR #89 のテストscript修正、記録の追加）はruntimeを変更していません。以前の [Windows r3記録](docs/testing/WINDOWS_PR75_R3_FINAL_LOCAL_2026-10-04.md)（PR #75 の `8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531`、24/24段階）は別の実測として保持します。

所有者のWindows Brave/Chromiumによる限定live確認で、Generateのcloud Response、AI Editの `move-entity` Responseと画面適用を確認済みです。公開build-infoと対象mainのcommit/source/bundle一致、全公開E2E、全異常入力への合格はこの確認に含みません。根拠は [限定live確認記録](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/3196f2bb942bbdfbcddc2481416f24d7196c5ead/docs/testing/LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md) を参照してください。公開 `build-info.json` と候補commitの一致、全公開E2Eは、2026-10-19に候補 `806d70c` で別途確認しました（[記録](docs/testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md)）。公開版の異常入力確認も同日に行いました（[記録](docs/testing/PUBLIC_ABNORMAL_INPUT_DAI090_2026-10-19.md)）。

10月3日の受入smokeと過去の公開E2Eは、それぞれの対象commit・fixture／実providerの区別を保持します。公開API異常入力、DAI-090 Final、主観的音声レビューは、2026-10-19に [異常入力確認とDAI-090 Finalの記録](docs/testing/PUBLIC_ABNORMAL_INPUT_DAI090_2026-10-19.md) で確認しました。最終候補のfreezeとrollbackタグの作成は、2026-10-20に [freeze記録](docs/submission/FINAL_FREEZE_2026-10-20.md) で行いました。本番は `806d70c` のままで、その後の `main` の差は文書・テスト・npm script定義だけです。repository公開と提出は、個別の証拠が揃うまで完了扱いにしません。

2026-10-05のレビュー対応ではDungeonSpec検証・audio unlock・simulation policyと証拠検査を変更しました。[追加修正の検証記録](docs/testing/REVIEW_THREAD_REMEDIATION_2026-10-05.md)を参照してください。上記Windows r3の24/24 PASSは記録済みSHAに対する履歴であり、この追加runtime差分のbrowser受入を意味しません。この差分を含む候補 `806d70c` のbrowser受入は、上記の公開候補記録で確認しました。

## Submission status

Historical DAI-081 hosted-demo evidence exists at:

https://dungeon-architect-ai.pages.dev/

Submission metadata:

- Focus category: **AI 3D Scene Generation**
- Short description: frozen in [DAI-083 Submission Description / Focus Category](docs/submission/DAI-083_DESCRIPTION_CATEGORY.md)

Historical DAI-084 rollback point:

- candidate commit: `cacba2a1f8f079ab6401768b97f9fc91fff8f3b9`;
- candidate tree: `e2938bb46e1cf2eedc3a90e2b7603bd6050486ad`;
- rollback ref: `rollback/submission-candidate-m8-2026-09-19` (created as a branch; moved to a tag of the same name on 2026-10-20);
- dist manifest SHA-256: `387287bfba2aaad91a7ef4c9d98ebb522e8ce8e1e0768825d39d33d949d8ea6d`.

See [DAI-084 Candidate Freeze / Rollback Point](docs/submission/DAI-084_CANDIDATE_FREEZE.md). The September DAI-099 rollback remains preserved separately. The 2026-10-04 rollback records the current baseline without promoting it to final acceptance.

The M8 49.5-second and September DAI-099 59.9-second videos remain historical evidence. The current submission video is the **150-second glb_v5** (the earlier 150-second v2 with the JSON / GLB export segments replaced) described in [the video record](docs/testing/DAI-099_REFRESHED_VIDEO.md). Its existence does not establish public upload or final submission.

The GitHub repository is still private and must be switched to Public before submission.

See [Submission Checklist](docs/submission/CHECKLIST.md).

## Team and license

**Team:** a few  
**Target:** AI Builder Hackathon 2026  
**License:** Apache-2.0
