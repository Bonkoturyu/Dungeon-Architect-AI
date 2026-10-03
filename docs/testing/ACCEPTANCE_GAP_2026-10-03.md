# 公開E2E・受け入れsmokeの限定監査 — 2026-10-03

## 対象

PR #69の公開後、既に通過しているGoal／11方式／特殊部屋の全行列を繰り返さず、生成確認、編集、複数階Play、Result、再編集、JSON再読込のつながりを確認した。

- 基準main／公開commit: `79b97b7bd21de7496c44cad6d76f1d68c902e06a`
- 公開URL: https://dungeon-architect-ai.pages.dev/
- Node.js 24.19.0、Linux上の表示ありChromium 154.0.8037.57
- 通常のクラウドブラウザはWebGL無効で初期化できなかったため、既存のnative Chromiumテスト環境で実施した。この環境制限を公開サイトの不具合とは判定していない。
- ライブLLM／課金APIは呼んでいない。生成とAI編集はHTTP fixture、生成設定の一部は実際の決定的fallback処理を使った。

## 見つかった問題と補修

### Full JSONの比較が現行ルール補完に未追従

旧初期fixtureは`trapRules`を省略する。現行importは`{ "version": "seeded-avoidance-1" }`だけを追加するため、旧smokeの「初回から完全に同じJSON」という比較が失敗した。実際の差分はこの1項目だけで、作者データの欠落ではなかった。

期待値は元Full全体のコピーへ不足ルールだけ追加し、全フィールドを引き続き厳密比較する。さらに、正規化済みの再exportをもう一度importし、Full全体の一致を検査する。部屋・Entity比較、不正JSONの拒否、履歴／実行状態のリセットは維持した。仕様書と計画書にも初回補完と以降の安定性を明記した。

### 3階smokeが現在の手動確認を待ち続ける

旧smokeはGenerate後の確認画面を操作しないため30秒でtimeoutした。手動確認の生成ボタンを明示的に押すように変更した。階編集・持越し検査のfixtureはV2地形、easy、通常Start/Goal、追加特殊部屋なしに固定するが、現行内容・70%罠ルールは適用したまま検査する。特殊部屋の網羅は既存専用smokeの範囲とする。

- 公開URLと証拠出力先を環境変数で選択可能にした
- `EXPECTED_DEPLOY_SHA`指定時はrootのbuild-infoを取得し、commit・runtime source・runtime bundleをローカルbuildと照合する
- Test／Mystery／Edit復帰、通路移動は画面のボタンを押す。敵・罠の解決も画面操作で行う
- 経路の選定、状態比較、階／部屋の選択には既存テストhookを使う。人による手動受け入れとは区別する
- Resultのreveal完了を待ってから、13項目の結果が読める画面を記録する

### JSON Export／方式selectorも同じ手動確認へ追従

この2本も旧来の`generateDungeonFromPrompt()`直接awaitを、Generate→確認→生成完了という画面操作と上限付き待機に変更した。Exportは2階のLayout／Full実ダウンロードとAPI出力の完全一致を維持した。方式selectorは現在のRecommended V3を加えた11方式を実際のselectで選択し、方式由来・同Seed・START可能性・現行罠ルールを検証する。旧10地形方式の相互差分検査は維持し、V2地形を使うV3を無理に11種類目の独自地形とは数えない。

両fixtureはeasy・通常端点・追加特殊部屋なしを明示する。現在の内容ルールを無効化したり、旧版互換へ戻したりする変更はない。

## 実行結果

| 検証 | 結果 |
|---|---|
| 公開の生成設定 | 21/21、5言語、連続Generate拒否、Cancel非破壊、Auto／Manual一致、難易度優先、非表示ランダム、実fallback |
| Start gate | 12/12、到達不能の拒否、Play snapshot、作者操作無効化、Goal、Edit復帰 |
| 構造AI編集 | 12/12、6コマンドのfixture応答、bounded context、各Undo/Redo、最終構造一致 |
| JSON Import | 修正前は13項目中1項目失敗。修正後14/14、全作者フィールド保持＋正規化済み再Import一致 |
| JSON Export | 14/14、2階Layout／Full実ダウンロード、完全一致、現行ルール |
| Generator strategy selector | 21/21、11方式の画面選択・手動確認・生成、同Seed、旧10地形方式の相互差分 |
| 3階Play（local） | 修正前は手動確認待ちtimeout。修正後15/15 |
| 3階Play（公開） | 15/15、SHA／source／bundle一致 |
| 全Node suite | 556/556、失敗・skip 0 |
| focused Node suite | 19/19、export／現行ルール／root・deep URL回帰 |
| build／構文／legal／privacy／diff | 通過、構文331ファイル。既存の大きいbundle警告は残る |

3階Playでは、生成→2階だけの部屋編集→1階からTest→HP/XP/G等のPlayerState完全持越し→3/3階CLEARED→作者データを変えずEdit復帰→Mysteryの3階生成→全階の作者状態への採用を確認した。対象smokeのconsole／page／request／HTTP errorsは0。

公開照合値:

- source: `a2097e3c943aeb5899d0e901ae78ede86705ce80321b33152c7ccec6b08c0b5e`
- bundle: `bf3611d6a8e92c5a27962b4892fe3146d9495a60bdd8a715839e49a61c20c123`

証拠は`artifacts/acceptance-gap-2026-10-03/`。公開結果は`multi-floor-public/dai-095-multi-floor-browser.json`、最終画面は`multi-floor-public/multi-floor-result.png`。JSON結果は`artifacts/dai-100-json-import/json-import.json`、修正前後のログは監査ディレクトリへ保存した。

## 残るゲート

- 今回は選んだsmokeを補修・実行しただけで、24段の`validate:dai-100-final-local`全体を通過したとはしていない
- 追加対象はJSON ExportとGenerator strategy selectorの2本で閉じ、両方の修正と実行まで完了した。その他の過去の全smokeを一括再実行したわけではない
- Windows Chromeの正式受け入れ、ライブprovider意味検証、主観的音声レビュー、動画／freezeは未実施
- ゲームruntime／ルール／生成方式の変更はない。上記は公開前の測定で、検証後にownerがこの8ファイルのPR・mergeを承認した。公開後のcommit／runtime fingerprint照合はPR記録へ追記する
