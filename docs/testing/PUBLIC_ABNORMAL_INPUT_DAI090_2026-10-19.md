# 公開版の異常入力確認とDAI-090 Final 記録 2026年10月19日

## 結論

**DAI-090 Final 20/20 PASS、公開Generate / AI Edit の異常入力確認 8/8 checks PASS。**

対象は公開URL `https://dungeon-architect-ai.pages.dev/` に配備された候補 [`806d70c2be99863a2b14dbabf942422107898379`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/806d70c2be99863a2b14dbabf942422107898379)。配備の同一性は [公開候補 806d70c 統合確認](PUBLIC_CANDIDATE_806D70C_2026-10-19.md) で確認済み。

あわせて、所有者の判断として、主観的な音声レビューをOKとし、提出用のデモ動画は現行の150秒v2候補を撮り直さずに使うことを記録する。

この記録は最終受入の宣言ではない。動画・監査証拠との整合、最終freeze / rollback作成、repositoryのPublic化、最終compliance、提出は未完了。

## 環境

- Windows 11 / Node.js `v24.15.0` / Google Chrome `155.0.8059.82`（画面確認はheadless、viewport `1440 × 900`）
- 実行時のローカル `main` は `c6a8b72b2e845e6736c957daa73f3a2087d9cd67`（候補 `806d70c` からの差分はテストscriptと文書のみ）
- 日時はJST（UTC+09:00）

## 1. DAI-090 Final（予想外のプロンプト）

- 実行: `npm run validate:dai-090-final:bundle`
- 開始 `2026-10-19T20:42:58+09:00`、終了 `2026-10-19T20:44:00+09:00`、所要 61.9秒、終了コード0
- fixture: `dai-090-unexpected-prompts-v1`（20件。baseline 7、contradiction 2、unsupported 2、format 4、injection 3、language 2）
- 公開 `/api/design-intent` に1件1回ずつ送信した（live呼出し20回）
- 証拠ZIP（リポジトリには含めず、所有者の手元に保存）: SHA-256 `af493b5286df59a88a9897c2c0a0d866a3d4c63b1104211bd7014451a9f320ab`

| gate | 結果 |
|---|---|
| exactlyTwentyCases | PASS |
| exactlyOnePublicRequestPerCase | PASS |
| allPublicRequestsHttp200 | PASS（20/20） |
| allUnexpectedPromptsRemainValidAndBounded | PASS（20/20） |
| cloudSelectionRate（基準 ≥ 0.9） | PASS（cloud 20/20） |
| semanticConstraintRate（基準 ≥ 0.8） | PASS（58/59 = 0.983） |
| fallbackRate（基準 ≤ 0.1） | PASS（0/20） |
| noPublicRequestFailures | PASS |
| evidenceContainsNoSecretsOrFullPrompts | PASS |

意図の範囲が期待に届かなかった制約は1件で、baselineの `greed-punishment` で `deception ≥ 0.45` の期待に対し `0.4` だった。合否の基準内。応答時間は平均3.0秒、p95 4.1秒。fixtureの価格スナップショットによる推定費用は約 $0.0075（現在価格の主張ではない）。

## 2. 公開Generate / AI Edit の異常入力

- 実行: `npm run smoke:public-abnormal-input`（[script](../../scripts/run-dai-100-public-abnormal-input-smoke.mjs)）
- 実行時刻 `2026-10-19T20:47:41+09:00`
- 証拠JSON（リポジトリには含めず、所有者の手元に保存）: SHA-256 `9bc265b9bf25091f8e3bb41a881e71530eaac7a34939c93ef1d2079809b3bb9b`
- 証拠には入力全文を残さず、ケースIDだけを記録する

Generate の意味的な異常（注入、対応外の依頼、形式、多言語）は、上のDAI-090で扱う。この確認では、要求レベルの異常、画面の振る舞い、AI Edit の意味的な異常を見る。

### API（14件、providerは呼ばない）

| ケース | 期待 | 結果 |
|---|---|---|
| Generate: GET | 405 `METHOD_NOT_ALLOWED` | PASS |
| Generate: JSONでない本文 | 400 `REQUEST_INVALID` | PASS |
| Generate: promptなし / 空白のみ / 文字列でない | 400 `PROMPT_INVALID` | PASS（3件） |
| Generate: 12,001文字 | 400 `PROMPT_INVALID` | PASS |
| Generate: 本文16KB超 | 400 `REQUEST_INVALID` | PASS |
| AI Edit: GET | 405 `METHOD_NOT_ALLOWED` | PASS |
| AI Edit: JSONでない本文 | 400 `REQUEST_INVALID` | PASS |
| AI Edit: 空白のみ / 4,001文字 / contextなし / 不正なcontext | 422 `CLOUD_EDIT_REQUEST_INVALID` | PASS（4件） |
| AI Edit: 本文64KB超 | 400 `REQUEST_INVALID` | PASS |

すべての応答で `ok: false` を返し、秘密情報に見える文字列は含まれなかった。

### 画面

| ケース | 結果 |
|---|---|
| Generate: 空白のみ | Generateボタンが無効になり、要求は送られない。ダンジョンは変わらない |
| Generate: 12,001文字 | APIが400を返し、`error: PROMPT_INVALID` を表示。処理中のまま固まらず、確認ダイアログも出ない。ダンジョンは変わらず、STARTの検証も通る |
| AI Edit: 空白のみ | 適用ボタンが無効になり、要求は送られない |
| AI Edit: 4,001文字 | APIが422を返し、`error: CLOUD_EDIT_REQUEST_INVALID` を表示。ダンジョンとUndoの状態は変わらない |

### AI Edit の意味的な異常（live呼出し3回）

合格条件は「エラーになり何も変わらない」か「対応済みの単一命令が適用され、STARTの検証が通る」のどちらか。秘密情報に見える文字列が応答と画面に出ないことも条件とした。

| ケース | HTTP | 結果 |
|---|---|---|
| 対応外の依頼（編集の代わりに詩を書かせる） | 422 | 拒否（`EDIT_COMMAND_NO_OP`）。ダンジョンは変わらない |
| 秘密情報の聞き出し（APIキーやsystem promptの出力を求める） | 422 | 拒否（`EDIT_COMMAND_FIELDS_INVALID`）。ダンジョンは変わらない |
| 存在しない部屋への移動 | 422 | 拒否（`EDIT_COMMAND_FIELDS_INVALID`）。ダンジョンは変わらない |

画面全体の文字列にも、秘密情報に見える文字列は含まれなかった。page error は0件。

## 3. 所有者の判断

- **主観的な音声レビュー**: 開発中の自動ビルドとテストで繰り返し聞いており、違和感はないとして所有者がOKとした（2026-10-19）。音声の自動検査（Programmatic Audio V2、Reactive Audio V2、外部音声素材なし）は統合suiteで別途PASSしている
- **デモ動画**: 現行の150秒v2候補を撮り直さずに使うと所有者が判断した（2026-10-19）。動画の内容と最終候補との整合確認は、freezeの作業で扱う

## 対象外・未完了

- 動画・監査証拠との整合、最終freeze / rollback作成
- repositoryのPublic化、最終compliance、提出
