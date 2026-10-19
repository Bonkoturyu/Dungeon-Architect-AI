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
- [x] [Windows r3ローカル統合](../testing/WINDOWS_PR75_R3_FINAL_LOCAL_2026-10-04.md): 24/24段階、Node 628/628、browser 15段階・253 checks PASS
- [ ] ローカルsuite対象外の公開deployment／全公開E2E、主観的音声レビュー、DAI-090 Final等を含め、最終受入を判断
- [ ] 現公開candidateのGenerate / Edit異常入力確認を完了
- [ ] 現candidate・公開fingerprint・動画・監査証拠を整合させて最終freezeを確定
- [ ] RepositoryのPublic化を承認された手順で完了
- [ ] 最終compliance、追加提出物、実際の提出を完了

r3の実測対象はPR #75の `8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531` であり、後続のdocs-only記録commitとは区別します。提出前の記録は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) と上記r3を参照してください。この一覧は全ゲートPASSの宣言ではありません。既存の包括的な公開前監査とPR #71–73のAI/TTS来歴補完を保持し、旧scriptの不在を理由に未監査とは扱いません。

## 現候補の統合確認（2026-10-19、`806d70c`）

- [x] [公開候補 806d70c 統合確認](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md): ローカル統合 24/24段階（Node 694/694）PASS
- [x] Cloudflare Pages本番を `806d70c` に反映し、公開 `build-info.json` の commit / runtime source 指紋がローカル候補と一致
- [x] 公開E2E 22/22 PASS（live Generate / AI Edit、2階層Play完走、Result、Edit復帰を含む）
- [x] [公開版の異常入力確認とDAI-090 Final](../testing/PUBLIC_ABNORMAL_INPUT_DAI090_2026-10-19.md): DAI-090 Final 20/20、公開Generate / AI Edit異常入力 8/8 checks PASS
- [x] 主観的音声レビュー（所有者がOKと判断、2026-10-19）
- [x] デモ動画は現行の150秒v2候補を撮り直さずに使う（所有者判断、2026-10-19）
- [ ] 動画と最終候補・監査証拠との整合、最終freeze / rollback作成
- [ ] RepositoryのPublic化、最終compliance、提出

この節も最終受入の宣言ではありません。上の「現候補（2026-10-04）」の未完了項目のうち、公開deployment、全公開E2E、主観的音声レビュー、DAI-090 Final、公開Generate / Edit異常入力確認は、この節の記録で確認しました。

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
