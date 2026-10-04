# Submission Checklist

## Historical M8 evidence retained

- [x] Historical Cloudflare Pages candidate deployed
- [x] Historical fresh-browser public E2E passed
- [x] Historical demo video under 3 minutes recorded and reviewed
- [x] Historical DAI-084 candidate hash / rollback point frozen
- [x] Short description
- [x] Focus category
- [x] Third-party disclosure baseline
- [x] AI usage disclosure baseline
- [x] LICENSE / NOTICE baseline
- [x] Historical secret/privacy audit
- [x] Known limitations documented
- [x] Sample prompts documented

These checks describe the earlier M8 candidate and must not be interpreted as acceptance of the current expanded runtime.

## 現候補（2026-10-04）

- [x] 現状退避点 `rollback/pre-submission-2026-10-04` → `8bcce65246663bc16625a0f915ec2f202c63b5e4` を保存
- [x] 旧Draft #55–58を未mergeでcloseし、元branch・SHA・過去証拠を保存
- [x] 150-second v2動画候補を保持（新規撮影なし）
- [x] 所有者Windowsで限定live Generate／AI Edit Responseと画面適用を確認（公開build-info同一性や全E2Eとは別）
- [ ] 統合suiteの最新結果・失敗・未実行項目を確認し、最終受入を判断
- [ ] 現公開candidateのGenerate / Edit異常入力確認を完了
- [ ] 現candidate・公開fingerprint・動画・監査証拠を整合させて最終freezeを確定
- [ ] RepositoryのPublic化を承認された手順で完了
- [ ] 最終compliance、追加提出物、実際の提出を完了

最新の結果は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74)。この一覧は全ゲートPASSの宣言ではありません。既存の包括的な公開前監査とPR #71–73のAI/TTS来歴補完を保持し、旧scriptの不在を理由に未監査とは扱いません。

以下は過去の計画時点のチェック状態です。現在の合否は上記とリンク先の対象commit付き証拠から判断してください。

## Historical September DAI-099 checklist — retained snapshot

- [x] Complete DAI-097 Audio presentation
- [x] Complete DAI-098 multi-floor simulation / balance
- [ ] DAI-099 predeploy validation passes on the refreshed branch
- [ ] DAI-099 refreshed production build emits a valid `build-info.json` fingerprint
- [ ] DAI-099 refreshed branch merges to `main`
- [ ] DAI-099 refreshed Cloudflare production deployment completes
- [ ] DAI-099 public commit/runtime fingerprint matches the local candidate
- [ ] DAI-099 refreshed public E2E against the current 2-floor runtime passes
- [ ] DAI-099 refreshed legal / provenance audit reruns on candidate `main`
- [ ] DAI-099 refreshed secret/privacy/security audit reruns on candidate `main`
- [ ] DAI-099 refreshed demo video under 3 minutes is captured
- [ ] DAI-099 refreshed demo video is manually reviewed
- [ ] DAI-099 freeze-prep evidence passes
- [ ] DAI-099 new candidate hash / tree / runtime fingerprint / rollback point recorded
- [ ] DAI-099 refreshed public/submission docs receive final post-E2E/video truthfulness audit
- [ ] Final repository visibility requirement confirmed
- [ ] DAI-090 unexpected-prompt checks
- [ ] DAI-091 final compliance
- [ ] Additional requested materials, if any
- [ ] DAI-092 submission completed before 2026-11-11 23:30 JST
