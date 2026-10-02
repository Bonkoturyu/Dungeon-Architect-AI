# ローカル起動ランチャー

依存関係のインストール後、リポジトリのルートで `npm run start:local` を実行する。

- Windows: 従来の Chrome（ユーザー / Program Files / Program Files (x86)）と Edge（Program Files / Program Files (x86)）を自動探索する。
- Linux: デスクトップセッション内で実行する。PATH の絶対ディレクトリ、`/usr/bin`、`/opt/google/chrome`、`/snap/bin` から実行可能な Chrome / Chromium / Edge を探索する。`/usr/bin/chromium` に対応する。
- `127.0.0.1:4173` で Vite を起動し、一時プロファイルの専用ブラウザウィンドウを自動で開く。ウィンドウを閉じるか Ctrl+C で、ランチャーが起動したプロセスを停止して一時プロファイルを削除する。
- Windows は既存の `taskkill /T /F` を維持する。Linux は専用プロセスグループを終了する。既存の通常ブラウザセッションは対象外。
- ポートが使用中、ブラウザ未検出、起動エラーなどの場合は異常終了する。自動インストールやブラウザサンドボックスの無効化は行わない。
- `/api` は既存の `start-local.config.mjs` に従い公開バックエンドへ転送する。AI 操作の入力が送信される境界は変わらない。

## 回帰テスト

`node --test tests/tooling/start-local.test.js`

Linux 上で Windows/Linux の探索、起動引数、終了処理、起動失敗などをスタブで検証する。Windows の実ウィンドウでの操作確認とは区別する。Linux ランチャー対応は、提出版の対応環境（Windows desktop Chrome）や既存の acceptance 判断を変更しない。macOS 対応はこの変更の対象外。

## 2026-10-02 ローカル検証

対象: `feat/dai-100-final-polish` の `83ca2d6` を基点とする本変更。

- Debian 13 / Node.js 24.19.0 / Chromium 154.0.8037.57 で検証。リポジトリ指定の Node.js 24.15.0 および Windows 実機とは異なる検証環境。
- `npm test`: 432/432 PASS。ランチャー 20 件と出口ラベル 3 件の回帰テストを含む。
- `npm run build:hosting`: PASS。既存の 500 kB 超チャンク警告あり。
- `npm run validate:syntax`: 追跡済み 269 ファイル PASS。新規 `.mjs` / `.test.js` 4 ファイルも `node --check` で個別 PASS。
- `CHROME_PATH=/usr/bin/chromium node scripts/run-ui-ux-polish-smoke.mjs`: 可視ブラウザで PASS、`falseChecks: []`、console/page/request/HTTP error なし。実際の出口ラベル 1 件を確認。
- ランチャーの実ウィンドウを 2 回起動し、閉じた際の終了コード 0 を確認。再起動後も正常終了し、ポート 4173 のサーバー停止と一時プロファイル残存 0 件を確認。
- legal / secret-privacy / public-docs audit: PASS。依存バージョン・lockfile は変更なし。
- 文書の修正先ディレクトリ存在と、V3 対応済みコマンドが未対応一覧から除かれたことを確認。
- `git diff --check`: PASS。

未検証: Windows 実機の起動・終了、24 段階の最終ローカル統合ゲート全体、公開デプロイ、live-provider、所有者の視聴確認、動画・freeze。今回のローカル結果で既存のリリース判定を変更しない。
