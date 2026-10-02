# Result パネル可読性・Layout JSON 拒否回帰 — 2026-10-02

## 対象と変更範囲

オーナー添付の右上 Result パネルを、現在の Play 下部ステータスと同じラベル・順序・数値の見た目に合わせて整理した。

- プレイヤー: LV / HP / EXP / G
- 装備: 武器 / 防具
- 攻略結果: 踏破階 / 戦利品 / 被ダメージ / 回復量 / 敵 / 宝箱 / 罠
- 全13項目を保持。値の計算・ゲームルール・集計対象は変更していない
- 意味を持つ section / heading / dl / dt / dd で、ラベル左・値右の2列を形成
- 幅340pxを上限、デスクトップでは画面高に制限。縦スクロール領域はキーボードでも操作可能
- 800px以下は既存の best-effort 縦積み配置を維持し、Resultカード内で二重スクロールさせない
- 言語切替時に Result 見出しが旧言語のまま残る問題も修正

参考資料: [Result Panel UI References](../research/RESULT_PANEL_UI_REFERENCES_2026-10-02.md)

## 実施結果

検証環境: Linuxの表示ありChromium 154.0.8037.57、Node.js v24.19.0。Windows Chromeの正式受け入れを代替するものではない。

| 検証 | 結果 |
|---|---|
| npm test | 434/434 pass、24テストコマンド |
| npm run build:hosting | pass。既存の500kB超バンドル警告は残る |
| npm run validate:syntax | 273ファイル pass |
| npm run validate:legal-registers | 14/14 pass |
| npm run validate:secret-privacy | 18/18 pass |
| npm run smoke:dai-100-result-focus | 15/15 pass |
| npm run smoke:dai-100-json-import | 13/13 pass |
| npm run smoke:ui-ux-polish | 25/25 pass |
| git diff --check | pass |

### Result 回帰

- 2階ランを実際のPlay操作でクリアし、全13個の値と3グループを確認
- 英語・日本語・簡体字・繁体字・韓国語 × 1440×900 / 1024×768 / 800×600
- すべての組合せで横方向のはみ出し・ラベルと値の重なりなし、言語切替で値不変
- 下部HUDと同じ LV / HP / EXP / G のラベルと順序
- ラベル14 CSS px、値16 CSS pxを計測。実際のグリフ寸法やXAG準拠を主張するものではない
- 1024×768でルート文字サイズを200%にし、キーボードEndで最終項目までスクロール可能。値32 CSS px、横はみ出しなし
- 文字サイズ拡大検証であり、ブラウザズーム200%の検証とは区別する
- イベント／階移動／結果カメラ・結果アニメーション・reduced-motion・Edit復帰の既存検証もpass
- console/page/request/HTTP errors は0

### 不正Layout JSON

配列でない rooms / connections を実際のファイル入力から読み込み、対応する検証エラーが表示され、インポート前のデータがそのまま残り、START可能な状態を維持することを確認。

## 証拠

ローカル生成物（Git登録は別途判断）:

- `artifacts/result-focus/result-focus.json`
- `artifacts/result-focus/play-status-reference.png`
- `artifacts/result-focus/result-card-ja.png`
- `artifacts/result-focus/result-readability-ja.png`
- `artifacts/result-focus/result-readability-enlarged.png`
- `artifacts/dai-100-json-import/json-import.json`
- `artifacts/ui-ux-polish/ui-ux-polish.json`

## 残る確認

- オーナーによるスクリーンショット／実機の見た目確認
- Windows Chrome正式対象、ブラウザズーム、大きい値、敗北表示の今回専用の追加視覚検証は未実施
- 本書はローカル検証の記録。公開反映のコミットとデプロイ確認は対応PRに記録する
