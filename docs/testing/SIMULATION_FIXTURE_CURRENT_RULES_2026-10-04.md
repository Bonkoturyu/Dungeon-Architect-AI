# 複数階simulation fixtureの現行罠ルール整合 — 2026-10-04

## 変更理由

対象main `8bcce65246663bc16625a0f915ec2f202c63b5e4` の一回限り最終統合で、第2段階 `validate:run-simulation` の4 invariantが失敗した。現行`seeded-avoidance-1`は成功率70%で、Seedと罠IDから固定判定を行う。旧fixtureではsafe方針も3階の罠で回避に失敗し、HP10に対してdamage12を受けて死亡した。

この挙動は[現行罠仕様](CURRENT_CONTENT_RULES_2026-10-02.md)どおり。`safe`というpolicy名は回避成功や無敵を保証しない。旧受け入れfixtureが100%回避を前提に持っていた「safeとtreasureはクリア、riskは最終階で死亡」という検証意図との不整合を、検証用入力に限定して修正する。

## 最小変更と維持する保証

[dai-098-run-balance-v1.json](../../spec/simulation/fixtures/dai-098-run-balance-v1.json)の`f3-trap.damage`だけを12から9へ変更した。

- Seed `98000 / 98001 / 98002`、罠ID、部屋、経路、敵、回復、報酬は変更しない
- 確率70%、判定式、被害処理、HP、装備、Play／simulation runtimeには変更を加えない
- 3階の回避roll `0.7279483226593584`は同じで、結果は引き続き`triggered`
- safeは罠直前HP10からHP1で生存する。9はこの固定場面で生存できる最大の整数被害であり、追加回帰でdamage10が致死になる境界を検査する
- riskは最初の2階で罠を強制発動し、回復を使わず、3階の敵で死亡する。最後の罠に到達する前に失敗するので、今回のdamage調整でriskの失敗を消していない
- treasureは同じ失敗rollを受けつつ、宝箱・回復を利用し、safeより大きいHP余裕で生存する
- 作者側hazard予算は敵＋罠の合計で7→12→14、部屋当たり2.333333→4→4.666667と階ごとに増える

元の15 invariantは削除も弱化もせず保持した。そこへ「safeが実際の固定回避失敗をHP1で生存」「safe/riskの操作選択が保持される」「treasureの回復による生存余裕」の3項目を追加し、18 invariantに強化した。fixtureを共有するmetricsテストの予算・成功率・死亡階の期待値も、この入力に対応する厳密値へ変更した。

## 回帰テスト

[run-balance-regression.test.js](../../packages/simulation-core/test/run-balance-regression.test.js)に4 testsを追加した。

1. safe／treasure／riskの全階成否、同じ固定失敗roll、HP10→1、回復／宝箱の選択を検査
2. 3方針すべてについて同入力・反復実行の完全一致と作者データ不変を検査
3. 同じSeed／罠ID／失敗rollのままdamage9でHP1生存、damage10で死亡する境界を検査
4. 元のdamage12へ戻したfixtureではsafeが3階の回避操作で死亡することを保持。旧失敗をruntime変更や100%回避化で隠していないことを検査

最初に新規テストを旧fixtureへ実行し、4件中1件が期待どおり失敗した。その後fixtureを修正し、focused suiteでPASSを確認した。

## 今回のfocused測定

- 基準: main `8bcce65246663bc16625a0f915ec2f202c63b5e4` ＋本fixture／test／harness差分
- 環境: Linux x86_64、Node.js `v24.19.0`、npm `11.9.0`
- `npm run test:simulation`: **38/38 PASS**、fail 0、skip 0（新規4 testsを含む）
- `npm run validate:run-simulation`: **18/18 PASS**、falseChecksなし
- focused validation実行: `2026-10-04T08:30:41.249725+00:00`〜`2026-10-04T08:30:41.546140+00:00`
- 変更したharness／新規testの`node --check`、作業差分の`git diff --check`: PASS

| 方針 | 結果 | 最終HP | 総damageTaken | 実回復量 | 罠発動 | 回復使用 | 宝箱loot |
|---|---|---|---|---|---|---|---|
| safe | 3/3階クリア | 1 | 21 | 0 | 1 | 0 | 0 |
| treasure | 3/3階クリア | 16 | 21 | 15 | 1 | 3 | 3 |
| risk | 3階で死亡、2/3階クリア | 0 | 22 | 0 | 2 | 0 | 2 |

集計は成功2／失敗1、成功率0.666667、最終階のclearRate0.666667。PlayerStateの厳密持越し、進行／装備、作者データ非変更など既存条件もすべて成立した。

## 証拠と未実行の区別

この記録はfocused確認であり、最終統合24段階のPASS記録ではない。提出資料／API境界の別作業と統合した後に全体suiteを確認する。過去の一回限りFAIL記録はその時点のSHAとfixtureに対する正しい観測として保持し、後からPASSへ書き換えない。

検証harnessは`artifacts/dai-098/dai-098-multi-floor-simulation.json`へ全trace・18 checks・各階trap damage・固定失敗rollを出力する。focusedログと修正前の失敗ログは今回の作業証拠として保管する。live provider、公開deployment、Windows Chrome受け入れ、動画の再撮影はこの変更では行っていない。
