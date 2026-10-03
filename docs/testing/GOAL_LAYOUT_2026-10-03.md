# Goal完了ボタンと公開URL smokeの補修 — 2026-10-03

## 範囲

- Goalカードは説明と完了ボタンの2要素だが、共通の3列gridを使用していた。日本語の「この階をクリア」が1文字ずつ縦に折り返されるため、Goalだけを2列にし、説明は折り返し、ボタンは1行を維持する。
- `run-goal-dormant-smoke.mjs`と`run-room-content-ui-smoke.mjs`のbuild-infoを配信ルートの`/build-info.json`から取得する。`DAI_SMOKE_URL`が`/apps/editor-slice/index.html`でも動作する。
- Goal smokeではメタデータを`page.request.get`で取得し、HTTP成功を確認する。JSONへの画面遷移が発生させる不要なfavicon取得を避ける。
- Goal判定、イベント、生成方式、内容レイヤー、罠ルールは変更していない。

対応レビュー: https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/68#discussion_r4167098410

## 検証

実行環境: Node.js 24.19.0、Linux上の表示付きChromium 154.0.8037.57。

- 変更前の公開版`84f971f40a24d974d20727597b4733b0e42d2481`を再確認。既存Goal smoke 13項目（build-info照合を含む）が通過し、日本語ボタンの縦折り返しを画面でも再現。
- 追加したレイアウト回帰は変更前の公開版で実際に失敗。英語の無効ボタンが2行になる状態を検知した。
- 全Node suite: 555件、失敗・skip 0。新規URL回帰2件は両scriptのroot、deep editor、query/hash付きURLを確認。
- Goal開発サーバー: 22項目通過。5言語 × 有効/無効 × 1440×900 / 1280×720 / 1024×768の30レイアウトで、ボタン1行、説明との非重複、カード内収容、横overflowなしを確認。
- Goal本番build preview: rootとdeep editor URLで各23項目通過（build-info照合を含む）、各30レイアウト、console/page error 0。
- 既存room-content smoke: 開発サーバーで14項目、本番build previewのroot/deep editor URLで各14項目通過。11生成方式、5言語、店の任意購入・表示切替・階遷移・装備引継ぎなどを確認。
- hosting build、構文検査330 trackedファイルと新規testの個別構文検査、legal/privacy監査、`git diff --check`通過。
- 日本語の変更前・変更後スクリーンショットと、1440/1024幅の実画面を目視確認。

途中の検証では単純なHTTPサーバーにSPA fallbackがなくdeep URLが404になったため、既存手順と同じVite previewへ変更した。また、GoalのJSON画面遷移に由来するfavicon 404を上記のHTTP取得へ修正後、両URLの全項目を再実行して通過した。

証拠: `artifacts/goal-dormant-remaining/`。最終Goal結果は`built-final-root/smoke.json`と`built-final-deep/smoke.json`、room-content結果は`room-content-root/smoke.json`と`room-content-deep/smoke.json`。

## 公開・未確認の境界

上記の測定は公開前のローカル候補に対して実施した。検証後、ownerがこの5ファイルのPR・merge・公開を承認した。公開版の完了判定には、commit後の再buildと配信SHA・fingerprint・実画面の再確認を別途必要とする。

既存buildの`runtimeSourceSha256`はGit indexに基づくため、未stageのCSS変更を表さない。ローカル候補の表示は生成bundleと画面で検証した。公開承認後はcommitしたソースから再buildし、公開SHA・fingerprintと画面を再確認する必要がある。

ライブLLM応答・課金API、Windows Chrome、Safari/Firefox、mobile acceptanceは今回未検証。APIを用いるroom-contentテストはfixtureまたはローカルの決定的fallbackを使用した。
