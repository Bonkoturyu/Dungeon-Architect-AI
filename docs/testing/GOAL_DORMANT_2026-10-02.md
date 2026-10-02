# Goalの休眠敵による完了不能の修正 — 2026-10-02

## 修正

通常Goalに`initiallyActive:false`の敵を置いた有効なJSONは読込・STARTを通過するが、起動しなければ戦闘できず、Goalも完了できなかった。Goalの敵ブロック判定を`active`だけに限定し、通常部屋の退出判定と揃えた。

`isSpecialGoal`とイベントの処理順序は維持する。休眠敵のいるGoalは自動完了せず「この階をクリア」で終了できる。入室や宝箱のイベントで敵が起動した後は、撃破するまで完了できない。未処理の罠も引き続き完了を妨げる。休眠敵を削除・強制起動したり、作者データを書き換えたりはしない。

通常生成のモンスターハウスは入室one-shot起動を持つため、敵処理は従来どおり必須。設計資料の旧content layer1/2の利用案内も、現行3とJSONの現行ルール補完へ更新した。Generator V1/V2とBSPを含む11地形生成方式は維持する。

## 検証

- 新規Node回帰6件：起動なし、flag条件不成立、入室起動、宝箱操作後の起動、activeとdormant混在、罠との混在。旧JSON import、作者データ非破壊、simulation操作と結果も確認
- 全Node suite 553件、失敗0。11方式の特殊Goal生成・生存経路再生の既存回帰も通過
- native Chromiumの新規画面12項目：5言語の旧JSON完了、条件不成立、入室起動、敵混在、宝箱起動、罠処理、2階連続、再読込・再import。既存room-content画面14項目も通過、console/page error 0
- build、JavaScript構文328ファイル、legal/privacy監査、diffチェック通過

再実行: `node --test packages/play-core/test/goal-dormant.test.js`、`node scripts/run-goal-dormant-smoke.mjs`。画面の証拠は`artifacts/goal-dormant/`へ保存。公開時は`EXPECTED_DEPLOY_SHA`と`DAI_SMOKE_URL`を指定して配信SHA・runtimeソースを照合し、画面12項目を再実行する。生成APIのライブLLM応答はこの修正の検証対象外。
