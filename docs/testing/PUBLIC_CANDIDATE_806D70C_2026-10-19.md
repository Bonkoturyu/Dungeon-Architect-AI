# 公開候補 806d70c 統合確認記録 2026年10月18日〜19日

## 結論

**ローカル統合 24/24段階 PASS、公開deploymentの同一性一致、公開E2E 22/22 PASS。**

対象は [`806d70c2be99863a2b14dbabf942422107898379`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/806d70c2be99863a2b14dbabf942422107898379)（PR #88 マージ後の `main`）。ローカル統合suite、Cloudflare Pages本番への反映、公開URLに対するlive Generate / AI Edit を含むE2Eを確認した。

この記録は最終受入の宣言ではない。主観的な音声レビュー、DAI-090 Final、公開Generate / Edit の異常入力確認、動画・監査証拠との整合、最終freeze / rollback作成、repositoryのPublic化、提出は対象外で、未完了のまま。

## 対象・環境

- 対象commit: `806d70c2be99863a2b14dbabf942422107898379`（tree `3d8eef13bd31b40036a648a878950fd95a00ccd8`）
- Windows 11 / Node.js `v24.15.0` / npm `11.12.1` / Google Chrome `155.0.8059.82`
- Browser viewport: `1440 × 900`
- 日時はJST（UTC+09:00）

## 1. ローカル統合suite

- 実行: `npm run validate:dai-100-final-local:bundle`（`scripts/run-logged.ps1` 経由）
- 開始 `2026-10-18T20:03:38+09:00`、終了 `2026-10-18T20:10:24+09:00`、所要 **406.6秒**、終了コード0
- `run-metadata.json` の branch は `main`、head は対象commitと一致
- 証拠ZIP（リポジトリには含めず、所有者の手元に保存）: SHA-256 `d681d82e001e2e1c9c46e83b7b8221347878c6d8be2e61d7e37bb9cd194e80fa`

[suite定義](../../scripts/run-dai-100-final-local-regression.mjs)の順序・ラベルを保持する。第18段階の「Ten-strategy」は歴史的なscriptラベルで、現行selectorは11方式。

| 段階 | suiteラベル | 結果 | 内訳 |
|---|---|---|---|
| 1 | Full Node regression suite | PASS | 694/694 tests |
| 2 | Multi-floor simulation regression | PASS | 18/18 checks |
| 3 | Production hosting build | PASS | production build完了 |
| 4 | Browser performance regression | PASS | 判定は単一の `passed` |
| 5 | Owner UI regression smoke | PASS | 63/63 checks |
| 6 | Room Event gameplay regression | PASS | 16/16 checks |
| 7 | Multi-floor browser regression | PASS | 15/15 checks |
| 8 | Programmatic character regression | PASS | 11/11 checks |
| 9 | Programmatic Audio V2 regression | PASS | 18/18 checks |
| 10 | Motion feedback regression | PASS | 8/8 checks |
| 11 | Event feedback regression | PASS | 9/9 checks |
| 12 | Result / camera-focus regression | PASS | 15/15 checks |
| 13 | DesignIntent atmosphere regression | PASS | 12/12 checks |
| 14 | AI Edit V3 structural regression | PASS | 12/12 checks |
| 15 | Reactive Audio V2 regression | PASS | 14/14 checks |
| 16 | JSON Export regression | PASS | 14/14 checks |
| 17 | JSON Import / round-trip regression | PASS | 14/14 checks |
| 18 | Ten-strategy Generator selector regression | PASS | 21/21 checks |
| 19 | Legal / provenance audit | PASS | 14/14 checks |
| 20 | Secret / privacy audit | PASS | 18/18 checks |
| 21 | Public docs truthfulness audit | PASS | 20/20 checks |
| 22 | Submission metadata audit | PASS | 8/8 checks |
| 23 | Syntax validation | PASS | — |
| 24 | Git whitespace / error-marker check | PASS | — |

第11段階のevidenceには、`introPlacement.checks.clearOfExitPad: false` が含まれる。これはイベント導入中に出口が表示されないための参考値で、smokeの合否には使わない設計（[event-feedback smoke](../../scripts/run-dai-100-event-feedback-smoke.mjs)）。

suiteとは別に、同じcommitで `npm run smoke:glb-export`（15/15）と `npm run validate:glb-export` もPASSした。

## 2. 公開deploymentの同一性

Cloudflare Pagesの本番は自動配備を止めており、所有者がDeploy Hookで対象commitを反映した。公開 `build-info.json`（`generatedAt` `2026-10-19T08:34:20Z`）とローカル候補buildを照合した。

| 項目 | 公開 | ローカル候補 | 判定 |
|---|---|---|---|
| `commitSha` | `806d70c2…` | `806d70c2…` | 一致 |
| `runtimeSourceSha256` | `11920de0…bbee830` | `11920de0…bbee830` | 一致 |
| `runtimeBundleSha256` | `0a3853ac…3b982fc`（参考） | `819c200e…45bb13af`（参考） | 不一致 |

`runtimeBundleSha256` はビルド環境（Cloudflare / Windows）で変わり得る診断値で、公開E2Eでも合否には使わない（`bundleDiagnosticMatches`）。同一性はcommitとruntime sourceで判定する。

## 3. 公開E2E

- 実行: `node scripts/run-dai-099-public-smoke.mjs`（`DAI_PUBLIC_URL=https://dungeon-architect-ai.pages.dev/`）
- 照合に使ったローカル候補buildは上記 `806d70c`。実行したscriptは [PR #89](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/89) マージ後の `main`（`78886156`）の版で、PR #89 の変更はテストscriptとAI利用記録だけ。runtimeは対象commitと同一
- 実行時刻 `2026-10-19T19:25:52+09:00`
- 証拠JSON（リポジトリには含めず、所有者の手元に保存）: SHA-256 `e496dc8016b647661c1f1ee38465e2de6398d1e32d05fc2bd3143b20da3b4631`

**22/22 checks PASS。** live Generate（`selectedProvider: cloud`、2階層、Manual生成の確認ダイアログを送信）、live AI Edit（`move-entity`、画面適用まで）、`/api/design-intent` と `/api/natural-edit` の200、2階層のPlay完走とResult、Editへの復帰を確認した。console error、page error、失敗request、HTTP 4xx/5xx はいずれも0件。

| check | 結果 |
|---|---|
| httpsDeployment | PASS |
| buildFingerprintEndpointAvailable | PASS |
| publicRuntimeSourceMatchesLocalCandidate | PASS |
| publicCommitMatchesLocalCandidate | PASS |
| refreshedUiPresent | PASS |
| initialEditorReady | PASS |
| audioUnlocksFromUserGesture | PASS |
| liveGenerationUsedCloud | PASS |
| generatedTwoFloors | PASS |
| generatedDungeonValid | PASS |
| liveNaturalEditWorked | PASS |
| bothApisReturned200 | PASS |
| roomEventStackObservedCentered | PASS |
| programmaticPlayerAndEnemyObserved | PASS |
| realCombatChangedPlayerState | PASS |
| playerStateCarriesExactlyToFloorTwo | PASS |
| twoFloorRunClears | PASS |
| resultShowsFloorCompletion | PASS |
| resultAudioModeCurrent | PASS |
| noExternalAudioAssets | PASS |
| returnToEditPreservesTwoFloorAuthoring | PASS |
| browserErrorsAbsent | PASS |

`roomEventStackObservedCentered` は歴史的な名前で、現行の判定内容は「水平中央・ビューポート中央から104px上・ビューポート内」（DAI-100の配置）。

### 同日の失敗した実行

このPASSの前に、同じ公開候補に対して公開E2Eを4回実行し、いずれも失敗した。原因はテストscriptがDAI-100以降の仕様（Manual生成の確認、画面表示、AI Editの対象選択、特殊Goal、戦闘バランス）に追従していなかったことで、[PR #89](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/89) で修正した。失敗した実行のうち後半2回では、live Generate と live AI Edit 自体は成功している。PASSした実行を含め、live呼出しは合計で Generate 5回、AI Edit 4回。

## 対象外・未完了

- 主観的な音声レビュー
- DAI-090 Final
- 公開Generate / Edit の異常入力確認
- 動画・監査証拠との整合、最終freeze / rollback作成
- repositoryのPublic化、最終compliance、提出
