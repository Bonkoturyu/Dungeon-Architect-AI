# PR未解決レビューの確認・追加修正（2026-10-05 UTC）

## 対象と結論

- 基準main: `3ad63ae8de2ccf7d68db9e2ff5fe9a25d73205b1`
- 75 PR / 56 review threadsを調査し、未解決26件を再判定
- 15件は後続変更で対応済み。11件はこの変更セットで追加修正
- GitHubへの返信・resolve・commit・push・merge・deploymentはこのローカル検証には含まない

## 追加修正

1. DungeonSpec: 配列index descriptorを先に検査しgetterを実行しない。hidden/inheritedのcallable `toJSON`とaccessorを拒否。JSON安全性に違反したspecは後続構造検査へ進まずSTARTをblock
2. Audio: context生成/resume失敗をunavailableへ正規化しUI listenerを解除。unlock中のcueを上限付きで待機し、成功後に一度だけ再生。失敗/dispose時は破棄
3. Simulation: policy actionのJSON snapshot失敗を`RUN_SIM_POLICY_INVALID_ACTION`へ正規化。実行とtraceに同一snapshotを使用
4. Build fingerprint: 実worktree内容とFunctions依存を共通helperでhash（source textの改行のみLF正規化、lock/binaryはraw bytes）。build前後の入力変化を拒否
5. Recording: passedの公開E2Eとcandidateのsource identityに結び付け、開始/終了の公開fingerprintを照合。新しいcapture・hash・MP4 probeなしでは成功させない
6. Freeze: public-doc audit必須化、source/dist再計算、録画file/hash/build identityの再照合

## 実行済み検証

| 検証 | 結果 |
|---|---|
| `npm test`（全24 test scripts） | 668/668 PASS、failure/skip 0 |
| Runtime重点4 files | 64/64 PASS |
| 同じ追加runtime回帰を基準main実装へ適用 | 64件中15 FAIL、修正後0 FAIL |
| 既修正13 threadsの重点8 files | 52/52 PASS |
| tooling suite（全体suiteに含む） | 86/86 PASS |
| `validate:run-simulation` | PASS |
| `build:hosting` | PASS（既存chunk-size警告あり） |
| `validate:legal-registers` | PASS |
| `validate:secret-privacy` | PASS |
| `validate:public-docs` | PASS |
| `validate:submission-metadata` | PASS |
| `validate:refreshed-video-plan` | PASS（計画・runner構造のみ） |
| `validate:syntax` | 343 files PASS |
| `git diff --check` | PASS |
| 最終sourceの隔離`core.autocrlf=true` checkout | CRLF化後もLinuxのsource hashと一致、lock raw bytes保存 |

materialized sourceは基準SHAから取得したもの。一時Git indexでファイルinventory・syntax/diff検査を行い、commitは作成していない。production bundleは生成したが、この作業領域にHEADがないためbuild-infoの`commitSha`は正直に`null`/`unavailable`とした。これを配信候補のcommit照合PASSとは扱わない。

- Source algorithm: `worktree-text-lf-sha256-v1`
- Runtime source SHA-256: `3d575af28571f73b040d97b0bdc9b79d0bade54a1f2ec9ffd258f8e1aee2c01f`
- Runtime bundle SHA-256: `5ab0fc70e062ecab129df231a0e1db0bcdf1ab02d6815e432f9aaae42ad7947b`
- 上記source identityは実OSがWindowsという証拠ではなく、最終sourceのGit改行変換を再現した比較。このtooling修正でbrowser runtime bundleは変わらない

追加tooling回帰はunstaged edit・Cloud Intent依存・未追跡source・入力改行・source/dist mutation・captureなし/古いcapture/probe失敗・公開deployment不一致・public-doc欠落/失敗を検査する。CLI freeze/auditの正例・負例では隔離fixtureのHEAD/status/ffprobeを明示stub化しており、本物の動画/公開候補の証拠は生成しない。

## 証拠の適用範囲

この変更セットはruntimeを変更する。Windows r3の24/24段階PASS（Node 628、browser 15段階/253 checks）は、引き続き過去の実測SHA `8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531` の証拠として保存する。今回の差分へそのPASSを流用しない。

今回の環境はLinux/Node 24.19.0（repository pinは24.15.0）。browser/WebGLの利用制約によりbrowser smoke、Windows/Chrome受入、主観的音声レビューは再実行していない。全24段階統合PASSは主張しない。公開deployment/public E2E、paid provider、動画の実capture/probe、freeze/rollback作成も実施していない。証拠scriptの負例・fixtureテストは、公開物や実動画の合格を意味しない。

source hashはindex由来から実worktree由来へ変更したため旧保存hashとは互換ではないが、source textのCRLF/CRはLFへ正規化してWindows/Linuxのcheckout差を吸収する。改行以外のbytes、監査済みlockfile、binaryは正規化しない。実Gitの`core.autocrlf=true/false` checkoutと未stageの内容変更を隔離fixtureで検証済み。Git属性・checkout設定の変更や改行の手動確認は不要。このtooling変更だけを理由に新たなowner受入項目を追加せず、次の通常candidate build/public fingerprint検査に反映する。現在保持する150秒v2を再収録したり、新runtimeに適合済みと認定したりはしていない。

## 全26件の判定

| PR / comment | thread ID | 判定 |
|---|---|---|
| [#71 / 4172906151](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/71#discussion_r4172906151) | `PRRT_kwDOUX4y8c6om5d2` | 基準mainで対応済み |
| [#68 / 4167098410](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/68#discussion_r4167098410) | `PRRT_kwDOUX4y8c6oY2dw` | 基準mainで対応済み |
| [#67 / 4165597021](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/67#discussion_r4165597021) | `PRRT_kwDOUX4y8c6oVLNj` | 基準mainで対応済み |
| [#67 / 4165597027](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/67#discussion_r4165597027) | `PRRT_kwDOUX4y8c6oVLNo` | 基準mainで対応済み |
| [#65 / 4164989833](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/65#discussion_r4164989833) | `PRRT_kwDOUX4y8c6oTsff` | 基準mainで対応済み |
| [#64 / 4164172558](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/64#discussion_r4164172558) | `PRRT_kwDOUX4y8c6oRt3o` | 基準mainで対応済み |
| [#64 / 4164172567](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/64#discussion_r4164172567) | `PRRT_kwDOUX4y8c6oRt3v` | 基準mainで対応済み |
| [#63 / 4163841804](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/63#discussion_r4163841804) | `PRRT_kwDOUX4y8c6oQ6iw` | 基準mainで対応済み |
| [#62 / 4163806955](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/62#discussion_r4163806955) | `PRRT_kwDOUX4y8c6oQ1Fc` | 基準mainで対応済み |
| [#62 / 4163806959](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/62#discussion_r4163806959) | `PRRT_kwDOUX4y8c6oQ1Ff` | 基準mainで対応済み |
| [#61 / 4163400696](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/61#discussion_r4163400696) | `PRRT_kwDOUX4y8c6oP2GN` | 基準mainで対応済み |
| [#61 / 4163400702](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/61#discussion_r4163400702) | `PRRT_kwDOUX4y8c6oP2GT` | 基準mainで対応済み |
| [#59 / 4162628626](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/59#discussion_r4162628626) | `PRRT_kwDOUX4y8c6oN_ch` | 基準mainで対応済み |
| [#54 / 4092998729](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/54#discussion_r4092998729) | `PRRT_kwDOUX4y8c6ljr1V` | この変更セットで追加修正 |
| [#54 / 4092998736](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/54#discussion_r4092998736) | `PRRT_kwDOUX4y8c6ljr1b` | この変更セットで追加修正 |
| [#52 / 4088486993](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/52#discussion_r4088486993) | `PRRT_kwDOUX4y8c6lYfQG` | この変更セットで追加修正 |
| [#52 / 4088487000](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/52#discussion_r4088487000) | `PRRT_kwDOUX4y8c6lYfQK` | この変更セットで追加修正 |
| [#52 / 4088487004](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/52#discussion_r4088487004) | `PRRT_kwDOUX4y8c6lYfQN` | この変更セットで追加修正 |
| [#52 / 4088487007](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/52#discussion_r4088487007) | `PRRT_kwDOUX4y8c6lYfQP` | この変更セットで追加修正 |
| [#51 / 4083007498](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/51#discussion_r4083007498) | `PRRT_kwDOUX4y8c6lLAld` | この変更セットで追加修正 |
| [#51 / 4083007506](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/51#discussion_r4083007506) | `PRRT_kwDOUX4y8c6lLAlj` | 基準mainで対応済み |
| [#50 / 4082100971](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/50#discussion_r4082100971) | `PRRT_kwDOUX4y8c6lIupp` | この変更セットで追加修正 |
| [#50 / 4082100977](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/50#discussion_r4082100977) | `PRRT_kwDOUX4y8c6lIupr` | この変更セットで追加修正 |
| [#50 / 4082100982](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/50#discussion_r4082100982) | `PRRT_kwDOUX4y8c6lIupu` | 基準mainで対応済み |
| [#48 / 4082070723](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/48#discussion_r4082070723) | `PRRT_kwDOUX4y8c6lIpwi` | この変更セットで追加修正 |
| [#48 / 4082070732](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/48#discussion_r4082070732) | `PRRT_kwDOUX4y8c6lIpwn` | この変更セットで追加修正 |
