# 現mainの最終統合テスト — 2026-10-04

## 結論

**FAIL。24段階中、1 PASS / 1 FAIL / 22 未実行。**

既存の `npm run validate:dai-100-final-local` を1回だけ実行した。全Node suiteは556/556 PASSだったが、第2段階の複数階simulationで4 invariantが失敗し、既存suiteのfail-fastにより停止した。現main基準の24/24 PASS証拠は成立していない。

これは最終確認の記録であり、application code、fixture、テスト期待値の修正や再試験は行っていない。本記録を追加するdocs-only変更のcommitとは、下記の**実測対象commit**を区別する。

## 対象・環境

- Repository: `Bonkoturyu/Dungeon-Architect-AI`
- 実測対象main: [`8bcce65246663bc16625a0f915ec2f202c63b5e4`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/8bcce65246663bc16625a0f915ec2f202c63b5e4)
- 実測対象tree: `3ec19b979d79897916e7f72f9acbedfb9315faf5`
- 開始: `2026-10-04T07:39:08.196234+00:00`
- 終了: `2026-10-04T07:39:20.546742+00:00`
- OS: Linux 6.18.44 x86_64 / glibc 2.41
- Node.js `v24.19.0` / npm `11.9.0`
- 既設browser: Chromium `154.0.8037.57`、`CHROME_PATH=/usr/bin/chromium`
- 推奨受け入れ環境のWindows desktop Chrome / Node.js `24.15.0`とは異なる
- 固定SHAから取得した全582 tracked files、tree、元の署名付きcommitのハッシュを照合したshallow detached snapshotを使用。試験後も全582ファイルが一致し、mainのSHAも同じだった

## 実行方法

[既存24段階suite](../../scripts/run-dai-100-final-local-regression.mjs)を変更せず実行した。

```sh
npm ci --ignore-scripts --no-audit --no-fund --cache <workspace-cache>
CHROME_PATH=/usr/bin/chromium npm_config_cache=<workspace-cache> npm run validate:dai-100-final-local
```

lockfileどおりの `@babylonjs/core@9.18.0`、`playwright-core@1.62.0`、`three@0.185.1`、`vite@8.1.5` を導入。初回の依存準備は標準cache `/home/agent/.npm` を作れず失敗したため、workspace内cacheで依存準備のみ再実行した。統合suiteの実行回数は1回で、終了コードは `1`。

live-provider検証はこのsuiteの対象外であり、実API／課金APIは呼んでいない。provider用の実credentialはテストprocessへ渡していない。

## 24段階の結果

ラベルは実行したsuite定義の表記をそのまま残す。第18段階の「Ten-strategy」も既存ラベルであり、今回の方式数検査結果ではない。

| 段階 | suiteラベル | 結果 |
|---|---|---|
| 1 | Full Node regression suite | PASS |
| 2 | Multi-floor simulation regression | FAIL |
| 3 | Production hosting build | 未実行 |
| 4 | Browser performance regression | 未実行 |
| 5 | Owner UI regression smoke | 未実行 |
| 6 | Room Event gameplay regression | 未実行 |
| 7 | Multi-floor browser regression | 未実行 |
| 8 | Programmatic character regression | 未実行 |
| 9 | Programmatic Audio V2 regression | 未実行 |
| 10 | Motion feedback regression | 未実行 |
| 11 | Event feedback regression | 未実行 |
| 12 | Result / camera-focus regression | 未実行 |
| 13 | DesignIntent atmosphere regression | 未実行 |
| 14 | AI Edit V3 structural regression | 未実行 |
| 15 | Reactive Audio V2 regression | 未実行 |
| 16 | JSON Export regression | 未実行 |
| 17 | JSON Import / round-trip regression | 未実行 |
| 18 | Ten-strategy Generator selector regression | 未実行 |
| 19 | Legal / provenance audit | 未実行 |
| 20 | Secret / privacy audit | 未実行 |
| 21 | Public docs truthfulness audit | 未実行 |
| 22 | Submission metadata audit | 未実行 |
| 23 | Syntax validation | 未実行 |
| 24 | Git whitespace / error-marker check | 未実行 |

第1段階の `npm test` は24 test group、合計556 tests、fail 0、skip 0。この「24 test group」は最終統合suiteの24段階とは別の集計である。

## 第2段階の失敗詳細

- コマンド: `npm run validate:run-simulation`
- 実体: [run-dai-098-multi-floor-simulation.mjs](../../scripts/run-dai-098-multi-floor-simulation.mjs)
- Fixture: [dai-098-run-balance-v1.json](../../spec/simulation/fixtures/dai-098-run-balance-v1.json)
- 15 invariant中、11 PASS / 4 FAIL

| 失敗invariant | 期待 | 実測 |
|---|---|---|
| `safeRunClearsAllFloors` | safeが3/3階をクリア | 3階には到達、2/3階クリア、`failed / player-defeated` |
| `hpAttritionIsObserved` | riskの総damageTakenがsafeより大きい | risk=22、safe=22。risk最終HP=0は成立 |
| `aggregateCapturesPolicyOutcomes` | 成功2・失敗1・成功率0.666667 | 成功1・失敗2・成功率0.333333 |
| `finalFloorIsBottleneck` | floorIndex=2、clearRate=0.666667 | floorIndex=2は成立、clearRate=0.333333 |

safe方針の3階、Seed `98002`、罠 `f3-trap` の `avoid-trap` で、現行 `seeded-avoidance-1` の成功率 `0.7` に対しrollは `0.7279483226593584`、outcomeは `triggered` となり、HPが10から0へ減少した。treasure方針は3/3階をクリアし最終HP=13、risk方針も3階で死亡した。

[現行罠ルール](CURRENT_CONTENT_RULES_2026-10-02.md)では、ルール未指定の旧JSONも70%の固定判定へ補完され、生存を保証する自動調整はしない。この実測と「safe全階クリア」の期待値の不整合が疑われる。ただし今回の1回の結果だけでruntime本体の欠陥とは断定していない。期待値を緩めてPASSにする変更もしていない。

PlayerStateの正確な持越し、反復決定性、作者データ非変更など、残る11 invariantはPASS。suite内部の `safeRepeat` は元から存在する決定性検査であり、最終統合suiteを再実行したものではない。

## 未実行・制約

- 第3〜24段階は第2段階のfail-fastにより未実行。build、browser、各監査、syntax、suite末尾のgit diff checkを今回PASSとはしていない
- browserを起動する段階には到達していない。環境には `DISPLAY` がなく、表示ありsmokeの環境条件も未解決だが、今回の実際の停止原因は第2段階のinvariant失敗
- localhost制限の迂回、proxy／セキュリティ設定の変更はしていない
- Windows Chrome正式受け入れ、主観的音声レビュー、公開deployment smoke、live-provider意味検証、DAI-090 Final、動画capture/review、freeze/rollback作成は未実施。このうち後6項目はsuite定義上も対象外
- application code変更、commit/push/PR、deployはテスト実行中には行っていない。テスト終了後の本記録のdocs-only保存とは別の事実

## 証拠の保管

[機械可読結果](FINAL_LOCAL_REGRESSION_2026-10-04.json)に、全24段階、環境、失敗の期待値／実測値、15 invariant、入力・実測ログのSHA-256を保存した。

全ログとsimulation全traceはownerへ渡した次のZIPに保持し、大きなログ自体は本リポジトリへ追加しない。

- ファイル: `Dungeon-Architect-AI_main_8bcce65_final-integration_2026-10-04.zip`
- ZIP SHA-256: `1f5d39276ce312648f95237fbb6e1fc7c5450dfd21e98c36420b787163c5848a`
- 同梱: `final-local.log`、`dai-098-multi-floor-simulation.json`、全24段階summary、実行日時／環境／終了コード、実行前後のソース照合、依存準備ログ

本結果を受けたfixture／現行ルールの整合性判断、修正、再実行は別作業。本記録で修正済みや最終統合PASSと扱わない。
