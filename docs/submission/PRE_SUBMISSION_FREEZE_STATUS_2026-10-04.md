# 提出前の現状固定・残ゲート — 2026-10-04

## 結論

現mainの退避点と旧PR整理を記録する。**現状を復元できる状態にした記録であり、最終受け入れPASSや提出完了の宣言ではない。**

- 現状退避点: `rollback/pre-submission-2026-10-04` → `8bcce65246663bc16625a0f915ec2f202c63b5e4`
- 旧候補向けPR #55〜#58: mergeせずclose、元branch・commitは保持
- 現mainの一回限り最終統合: **FAIL（1 PASS / 1 FAIL / 22 未実行）**
- 公開backendのlive生成＋AI Edit: **所有者Windowsで両方の正常Responseとゲーム画面への適用を確認**（先行生成を含む回数・費用の限界は後述）
- デモ動画: 確認済み範囲で撮り直しを必要とする実質的差分は見つからず、承認済み150秒版v2を暫定維持

本追記はdocs-onlyの状態記録。application code、fixture、期待値を変更せず、追加の試験・課金API・動画再撮影・公開作業を行うものではない。

## 固定した対象

| 項目 | 値 |
|---|---|
| 実測／退避対象commit | [`8bcce65246663bc16625a0f915ec2f202c63b5e4`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/commit/8bcce65246663bc16625a0f915ec2f202c63b5e4) |
| 同tree | `3ec19b979d79897916e7f72f9acbedfb9315faf5` |
| 退避branch | [`rollback/pre-submission-2026-10-04`](https://github.com/Bonkoturyu/Dungeon-Architect-AI/tree/rollback/pre-submission-2026-10-04) |
| 状態記録のPR | [#74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74)（この記録の確認時点ではDraft / 未merge） |
| 初回状態記録直前のdocs-only head | `249762b4b0dc901acccf35a5ee116a2a5faddcf2` |
| 同tree | `02d1a7b8f1894e0d396c463aff122a7bd3115486` |
| live確認追記の基準docs-only head | `2b3c648cdab48996febc2fdbcf99bbfd05d17f39` |

退避refの読戻しで対象SHAとの一致を確認した。退避branchは今後の作業branchに使わず、commit／merge／移動をしない運用とする。調査や復元作業が必要な場合は別branchを作る。`main` のforce-resetや履歴書換えは行わない。

状態記録自身をcommitするとdocs-only headは変わるため、実測／退避対象SHAと記録用headを混同しない。既存の[DAI-084歴史freeze](DAI-084_CANDIDATE_FREEZE.md)と `CANDIDATE_FREEZE.json` は古い候補の証拠として残し、今回のPASS済みmanifestへ書き換えない。

## 旧PR #55〜#58の整理

4件ともclosed / merged=falseを読み戻し、元branchのrefと下記head SHAの存在を確認した。

| PR | 状態 | 保持branch | 保持head SHA |
|---|---|---|---|
| [#55](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/55) | closed / merged=false | `freeze/dai-099-bookkeeping-2026-09-24` | `252e5b733b8f7088f53eb62d4f4de6a4f8a5ae1f` |
| [#56](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/56) | closed / merged=false | `verify/dai-090-unexpected-prompts-2026-09-24` | `66bf7cf370361f6a74c40cdd5f79aa480cae68c3` |
| [#57](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/57) | closed / merged=false | `final/dai-091-compliance-2026-09-25` | `a2f204990f04fa5946a654e9bd3dcf85342b6f25` |
| [#58](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/58) | closed / merged=false | `verify/dai-091-final-compliance-2026-09-25` | `1807c1bbec6bb9df901b926503b849e258a52b7c` |

これらは主に旧候補 `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3` 用のfreeze、異常入力検証、compliance、公開前監査に関するPRである。**closeは「全内容をmainへ取り込み済み」「現候補の全検証済み」という意味ではない。** 旧候補／旧動画hashに固定された記録を丸ごとmergeせず、歴史証拠・必要時の参照用として保持した。

特に #58の監査scriptがmainにない事実だけから、公開前監査を未実施とは判定しない。整理時の根拠は[#58のclose説明](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/58#issuecomment-5977889187)に残している。

## 既存監査を保持する境界

既存の共有済み報告には、1,805 reachable commits、580 files、70 PRs、229 comments、855 reviews、9 branches、83 refsを対象にした公開前監査がある。これは過去実施済みの監査報告として保持し、「旧PRのrunnerがmainにない」ことを理由にゼロへ戻さない。

本追記のためにその全履歴監査を再実行しておらず、元監査のexact対象SHA／結果ファイル参照も今回再同定していない。したがって、この集計だけで現在の `8bcce652` に対する全監査PASSを新たに主張しない。追加で必要なのは、保存済み監査結果の対象範囲と現候補との差分を対応付け、未カバーの部分だけを明確にすることである。

[PR #71](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/71)〜[PR #73](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/73)および現mainの[AI利用台帳](../legal/AI_USAGE.md)、[TTS技術レビュー](../legal/TTS_TOOLCHAIN_REVIEW_2026-10-03.md)には動画制作の追加来歴記録がある。これらは該当用途の証拠を補完するが、上記1,805 commits集計の対象SHAそのものを示すものではない。

DAI-090にも対象の違いが残る。現mainの20件はGenerate中心のcorpusであり、旧 #56のGenerate＋Edit API異常入力20件と同等ではない。旧PRのcloseをもってどちらかを実行済み／不要とせず、現候補に必要な範囲と保存済み証拠を照合する。ここで自動的に移植や再試験を開始する指示にはしない。

## 提出資料・検証定義に残る整合性

mainにはDAI-073 legal、DAI-074 current tree／history-secret／privacy、DAI-083 metadata、DAI-099 freeze-prepの既存検証があるため、旧PRのscript一式を移植することは前提にしない。

旧 #56 runnerは旧候補と `move-entity` 成功を前提にしているが、現AI Editの契約はより広い許可command、Room geometry／Corridor topologyを扱い、Generateには `includeRoomRequests: true` の経路がある。現候補向けに必要なGenerate＋Edit API境界／異常入力の証拠が不足する場合は、現契約に沿う必要最小限の検証を別途判断する。古いrunnerをそのまま持ち込んだだけで同等性を主張しない。

提出資料と監査定義にも古い状態が残る。[DAI-080監査script](../../scripts/run-dai-080-public-docs-audit.mjs)を読んだところ、`Refreshed final candidate — pending`、未チェックのDAI-099項目、`DAI-099 REFRESH IN PROGRESS`、`49.5-second capture remains historical evidence` などの固定文字列を条件としている。現在の150秒動画や今回の退避点を反映して提出資料を整理する際は、履歴を残しながら実態と監査条件を一緒に整合させる判断が必要になる。

これは静的読取りで確認した文書／検証定義の追従残件であり、今回DAI-080を実行して失敗したという記録ではない。今回の一回限りsuiteではその段階まで到達しておらず、本追記で資料本文や監査scriptを変更していない。

## 現mainの最終統合結果

詳細は[2026-10-04最終統合記録](../testing/FINAL_LOCAL_REGRESSION_2026-10-04.md)と[機械可読結果](../testing/FINAL_LOCAL_REGRESSION_2026-10-04.json)を参照。

- `npm run validate:dai-100-final-local` を対象SHAで1回だけ実行
- 全Node suite: 556/556 PASS、fail 0、skip 0
- 第2段階の複数階simulation: 15 invariant中4 FAIL
- safe方針が3階の70%罠回避に失敗し死亡。旧fixtureの「safe全階クリア／成功2/3」前提と不一致
- 現行ルールと期待値の不整合が疑われるが、この1回だけでruntime欠陥とは未断定
- 既存fail-fastにより第3〜24段階は未実行。build、browser、監査等の今回PASSは主張しない
- コード／fixture／期待値の修正・再試験はしていない

退避pointを作成しても、このFAILを解消したことにはならない。

## 公開backendのlive確認

**所有者がWindowsのBrave/Chromium 154で実施し、live生成、live AI Edit、ゲーム画面へのcommand適用を確認した。** 詳細は[2026-10-04公開live確認](../testing/LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md)を参照。

- 生成: 正規 `/api/design-intent` へのPOST 200、`ok: true`、`selectedProvider: cloud`、`provider: openai`、`model: gpt-5.6-luna`。DesignIntent／roomRequestsの独立validatorもvalid
- AI Edit: `/api/natural-edit` の `ok: true`、`move-entity` / `treasure-1` / `room-005`、同じprovider/modelをResponse本文で確認
- 最終画面: `Applied: move-entity`、Chest `treasure-1` のRoomが `room-005`、同室にGoal `goal-1`、Undo有効、`✓ Valid`。Responseと適用先が一致
- 採用した両成功Responseのusage: input 2,758 / output 560 / total 3,318 tokens。標準単価試算 `$0.0012236`、計画換算200円/USDで約0.24円。実請求額ではない
- 先行に2つの生成履歴があり、その後に今回の1生成＋1Editを行った。全体を生成1回だけとは扱わない。把握した3生成＋1Editと内部retry上限を含む保守的予約見積りは約50円で、承認予算100円内（追加の別呼出しがない前提）

初回のクラウド確認はWebGL disabledと通常HTTPのCloudflare `403 / 1010` により課金呼出し前に停止していた。初回の生成0／Edit0／provider0と見積0円はその試行に限る歴史的記録として保持し、後続の所有者Windows操作へ拡張しない。初回の環境エラーと手順は `Dungeon-Architect-AI_live-provider_blocked_2026-10-04.zip` に保持している。制限迂回はしていない。

今回の資料解析で新しい課金呼出し、コード変更、deploy、最終統合suite再実行は行っていない。以下は未確認のまま残す。

- 公開 `build-info.json` のcommit／runtime source／bundle fingerprintと現mainとの一致
- 最新成功セッションの生の前後Full JSON差分。先行の5部屋／10部屋JSONは異なる生成状態であり、宝箱移動のみの前後ペアではない
- 実際の内部provider retry回数、先行生成や失敗試行のusage、実請求額。公開生成APIがattemptsを返さないため、正確な値はserver-sideログまたはprovider利用明細が必要

これは限定live経路の成功であり、全体の公開E2E、Play完走、最終統合PASS、Windows Chromeブランド固有の正式受け入れを新たに主張するものではない。

## 動画と現UIの整合性

確認対象は[AI利用台帳](../legal/AI_USAGE.md)に記載された承認済みv2。

- ファイル: `DAI_Demo_Review_EN_2026-10-03.mp4`
- 150秒、1920×1080、30fps、4,500 frames
- SHA-256: `3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8`

動画実フレームで難易度位置／手動生成確認、11方式、manual edit／Undo、AI resize、店でのT2購入、2階CLEARED Result、Full JSON出力と修正済みJSON場面を確認した。

[最後のUI修正 #69](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/69)のmerge commit `79b97b7bd21de7496c44cad6d76f1d68c902e06a` から対象mainまでの[比較](https://github.com/Bonkoturyu/Dungeon-Architect-AI/compare/79b97b7bd21de7496c44cad6d76f1d68c902e06a...8bcce65246663bc16625a0f915ec2f202c63b5e4)は4 commits／12 filesで、docs・テスト／検証scriptのみ、runtime差分はなかった。

確認範囲では撮り直しが必要となる実質的差分は見つからず、承認済みv2を維持する。新規再撮影、動画差替え、公開は行っていない。

ただし、元captureの撮影SHA・開始時刻は特定できていない。Library初版作成 `2026-10-03T08:48:32Z`、v2更新 `2026-10-03T09:53:33Z` を撮影開始時刻とは同一視しない。今回のcloud browserでは静的UIを照合したが、WebGL制約により公開画面の3D全操作の再検証はできていない。「撮影SHAと公開SHAの完全一致」「公開全フロー再確認済み」とは記録しない。

## 残る判断と作業境界

1. 統合FAILのfixture／現行ルール不整合をどう扱うか。現状のまま最終統合PASSにはしない
2. 限定live生成＋AI Editは確認済み。現公開build fingerprintの厳密な照合と、最終受け入れ範囲との対応付けは残る
3. 保存済み監査・DAI-090証拠が現候補を覆う範囲の突合。旧PR／runner不在を理由に監査全体を未実施扱いにしない
4. 提出資料とDAI-080の古い状態表記の整合。履歴を残し、今回未実行の監査をPASS扱いにしない
5. repository公開、動画公開、正式提出などの提出手続き。今回のrollback作成やPR closeはこれらの完了を意味しない

上記は残状況の記録であり、追加開発、全suite再実行、動画再撮影、公開操作の一括承認や実行指示ではない。主観的音声レビュー、Windows Chromeの正式受け入れなどについても、別の既存証拠がある部分と今回未実行の部分を分けて判断する。
