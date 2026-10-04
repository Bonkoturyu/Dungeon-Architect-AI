# 最小修正後の統合確認 — 2026-10-04

## 結論

**実行できた非browser 9段階はPASS。browser 15段階は未完了のため、24/24 PASSとはしない。**

3領域の変更を統合し、既存 `npm run validate:dai-100-final-local` を今回の修正後に1回実行した。Node **606/606**、複数階simulation **18/18**、production buildはPASS。第4段階はChromium起動時に環境制約で停止し、既存fail-fastにより第5〜24段階は走らなかった。その後、影響を受けない第19〜24段階を個別に補完した。

元のmainに対する[初回FAIL記録](FINAL_LOCAL_REGRESSION_2026-10-04.md)は保持する。以下は未commitの修正snapshotに対する別の測定であり、元main自体がそのままPASSしたという意味ではない。

## 対象snapshot・日時

- 基準main: `8bcce65246663bc16625a0f915ec2f202c63b5e4`
- 記録PR #74の取込head: `3196f2bb942bbdfbcddc2481416f24d7196c5ead`（4 docs）
- 今回の変更: simulation 6 files、API境界 2 files、提出資料／監査 12 filesの計20 files
- 統合入力: 計591 files、mainとの差分24 paths。全入力の内容hashを保存
- テスト時source manifest SHA-256: `7bc379ea3cfc333c0220dde84316aecfef730a06fd5e0dc811cc7a2ad9c9c26f`
- 最終source manifest SHA-256: `26032ed57364325a91455b38d156d4a4ce2c42d8b714b9c12e84b09d2bc34b66`
- 統合実行: `2026-10-04T08:37:34.401121+00:00`〜`2026-10-04T08:37:49.603118+00:00`
- 非browser補完: 2026-10-04 08:39〜08:43 UTC
- 環境: Linux 6.18.44 x86_64、Node.js v24.19.0、npm 11.9.0、Chromium 154.0.8037.57
- 実行設定: `CHROME_PATH=/usr/bin/chromium`、npm cacheはworkspace内

テスト後のsource差はPR74状態文書末尾の余分な改行1 byteを除去したものだけ。内容・runtime変更はなく、staged差分チェックを再実行してPASSした。実行時と最終manifestを両方保持して区別する。この測定記録自身の2 filesは測定後に作成したため、入力591 filesには含めない。

## 修正の要点

- [simulation fixture整合](SIMULATION_FIXTURE_CURRENT_RULES_2026-10-04.md): 最後の罠damage12→9。Seed／ID／70%判定／失敗rollを維持し、safe HP1、treasure HP16、risk 3階死亡を保証。元15 invariantを保持して3項目追加。damage9/10境界、旧12での死亡、3方針の決定性を回帰検査
- [API handler境界](API_BOUNDARY_INTEGRATION_2026-10-04.md): 実handler／router／adapter／HTTP transportを通すoffline 39ケース。provider fetchだけをmockし、body／prompt制限、不正出力、異常context、retry／fallback等を検査。公開POSTや追加課金はなし
- 提出資料とDAI-080／動画計画監査: 現11方式・単一11コマンド・70%罠・150秒v2と確認範囲に整合。歴史的受け入れ証拠を残し、古い現状記述の拒否を含む7回帰testsを追加

ゲームruntime、公開backendの実装、依存関係version、動画内容は変更していない。

## 24段階と補完結果

| 段階 | suiteラベル | 今回の結果 |
|---|---|---|
| 1 | Full Node regression suite | PASS（統合suite） |
| 2 | Multi-floor simulation regression | PASS（統合suite） |
| 3 | Production hosting build | PASS（統合suite） |
| 4 | Browser performance regression | 起動不能（環境制約） |
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
| 19 | Legal / provenance audit | PASS（個別補完） |
| 20 | Secret / privacy audit | PASS（個別補完） |
| 21 | Public docs truthfulness audit | PASS（個別補完） |
| 22 | Submission metadata audit | PASS（個別補完） |
| 23 | Syntax validation | PASS（個別補完） |
| 24 | Git whitespace / error-marker check | PASS（個別補完） |

集計: 統合suite単体は3 PASS／1起動失敗／20未実行。非browser個別補完後は9 PASS／1起動不能／14未実行。第5〜18のbrowserを未実行のままPASSへ変換しない。

## browser停止の実際の原因

第4段階 `smoke:browser-performance` でChromium processを起動したが、ページ初期化前に終了した。

```text
chrome_crashpad_handler: --database is required
Check failed: . socket() failed: Operation not permitted (1)
process did exit: exitCode=null, signal=SIGTRAP
```

環境には`DISPLAY`も設定されていない。上記は実際に出力されたlaunchエラーであり、ゲーム画面のassertion失敗ではない。browser再試行、headlessへの変更、sandbox／proxy等の制限迂回は行っていない。

第5〜18も未実行。Windows Chrome等の適切な表示・browser実行環境で、同じ候補内容を用いた確認が残る。本記録は環境で実行できなかった操作をユーザー確認済みや公開E2E済みへ読み替えない。

## 非browser補完と証拠範囲

| 検証 | 結果 | 範囲 |
|---|---|---|
| 全Node | 606/606 PASS、fail 0、skip 0 | simulation新規4＋API39＋資料監査7を含む |
| simulation | 18/18 PASS | 現行runtimeを使う固定fixture |
| build | PASS | runtime source／bundleは下記に一致 |
| legal | 14/14 PASS | 現作業treeの台帳・配布境界 |
| privacy | 18/18 PASS | index登録済み591 files、local build、実handlerのmock検査 |
| public docs | 20/20 PASS | 現記述・必要な制約・リンク・歴史証拠 |
| submission metadata | 8/8 PASS | 既存提出説明／category |
| syntax | 334 files PASS | 新規3 test filesを含む |
| 差分 | PASS | `git diff --cached --check`。PR74文書末尾改行を修正後に再確認 |

privacyのGit履歴確認には明確な制約がある。このcheckoutはshallowで、`git rev-list --count --all`は1。この回のPASSを全履歴監査の代替としない。過去の1,805 reachable commits等の公開前監査は別の既存証拠として保持する。

suite定義の第24段階 `git diff --check origin/main...HEAD` はHEADとorigin/mainが同じ基準SHAのため空差分だった。実際の24 pathsの作業変更には、別途stageした後の `git diff --cached --check` を適用した。

## build同一性

- local build runtime source SHA-256: `a2097e3c943aeb5899d0e901ae78ede86705ce80321b33152c7ccec6b08c0b5e`
- local build runtime bundle SHA-256: `bf3611d6a8e92c5a27962b4892fe3146d9495a60bdd8a715839e49a61c20c123`
- 既存[受け入れ記録](ACCEPTANCE_GAP_2026-10-03.md)のruntime fingerprintと一致

`build-info.json`のcommitはlocal git HEAD由来の基準main SHA。この作業snapshot全体がそのcommitに保存済みという主張ではない。今回、公開 `build-info.json` を再取得して照合したわけでもない。

## 残るもの

browser 15段階と、別に残っている公開build fingerprint／正式受け入れの確認。今回のAPI異常境界はofflineで充足を確認したが、実モデルの敵対prompt品質や公開edge動作まで証明したものではない。[ユーザーWindows live正常操作の証拠](LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md)は別記録として保持する。

元のFAIL記録、今回の実行全ログ、before／after manifest、simulation全trace、各監査JSONは証拠bundleに保存する。対象sourceと未実行部分を明示し、追加の課金API、deploy、動画再撮影、最終提出を今回の確認に混ぜない。
