# PROD-DEP-003 — Vite 8.1.6 / 現行lockfileレビュー

- レビュー日: 2026-10-30
- 対象: `vite@8.1.6`。Provider: VoidZero Inc. / Vite contributors
- Status: **Approved（既存のproduction build/preview・benchmark tooling用途のみ）**
- 旧承認: [Vite 8.1.5](PROD-DEP-003-vite-8.1.5.md)。旧記録は変更しない
- 対象PR: [#101](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/101)、head `e242229c516dd6608f24f07bf6e0c66a7f3a588a`

## 使用前レビューと判断

本レビューはpackageの**実行・install前**に、公式tag差分、npm配布物のbyte列、bundledコードとlicenseを静的に確認した。lockfileのhashだけを新値に置き換える承認ではない。現在の用途・配布範囲で追加のライセンス阻害要因は認められず、下記identityの固定導入を認める。build/test成功、無脆弱性、一般的なruntime利用や第三者へのツール再配布までを承認するものではない。

## 出所と同一性

- [公式tag比較](https://github.com/vitejs/vite/compare/v8.1.5...v8.1.6)、release commit `dade886f0cc17fedf777eff804593d2af182abd4`
- [公式changelog](https://github.com/vitejs/vite/blob/v8.1.6/packages/vite/CHANGELOG.md): 2026-10-06 release
- [npm exact metadata](https://registry.npmjs.org/vite/8.1.6) / [npm tarball](https://registry.npmjs.org/vite/-/vite-8.1.6.tgz)
- tarball SHA-256: `4e512df2b82176a9b7462d72188e984bda6d55629a46d506f43cff7848957ee1`
- tarball SRI: `sha512-aRAHIxx5SW5zc1sMqFwJU/t5qaFfXb5Hj0J7W0VXihu/X99+346tz6080tO1T1xVIJORX/b3zVTXGFqUXh35uw==`

取得した8.1.5/8.1.6のtarball双方で、実byteから計算したSHA-512・SHA-1がnpm metadataと一致した。8.1.6はPR101のlock integrityとも一致。[npm registry公開鍵](https://registry.npmjs.org/-/npm/v1/keys)で`name@version:integrity`へのECDSA署名2件をOpenSSL検証し、2/2 `Verified OK`。これはregistry署名の確認で、再現build証明ではない。

[npm provenance](https://registry.npmjs.org/-/npm/v1/attestations/vite@8.1.6)のdecoded payloadは、上記tarball digest、official tag、release commit、`.github/workflows/publish.yml`に一致した。Sigstore certificate/trust chain/transparency logの完全検証は行っておらず、「SLSA検証済み」とは扱わない。機械可読の取得元・hash・検査範囲は[証拠JSON](../evidence/VITE_8_1_6_REVIEW_2026-10-30.json)に記録した。

## コード差分と影響

公式tag差分の全16ファイルと公開tarball差分を確認。tarballは双方35ファイル、追加・削除なし。変更は`package.json`と`dist/node/chunks/node.js`のみで、残り33ファイルはbyte一致。

1. HTML変換のfilenameからqueryを除外し、`//`で始まるHTML proxy URLを正規化する。対応するupstream回帰testの追加を確認したが、本レビューでupstream testは実行していない。
2. dev serverの`safeModulePaths`にはURLではなく解決済みIDを登録し、未解決SSR importをsafe扱いしない。root-relative URLとfilesystem pathの混同に対する回帰testが追加されている。
3. 内部bundled `launch-editor` / `launch-editor-middleware`は2.14.1→2.14.2、`shell-quote`は1.8.4→1.12.0。[launch-editor公式比較](https://github.com/vitejs/launch-editor/compare/v2.14.1...v2.14.2)と実bundleの変更を確認。Windows editor引数の改行・`%`拒否、absolute path化、WSL相対pathの`./`付与などが含まれる。[shell-quote公式changelog](https://github.com/ljharb/shell-quote/blob/v1.12.0/CHANGELOG.md)と実bundleではparse/quoteの修正・対応構文追加が確認できる。これはdev toolingの内部コードであり、DAAIアプリがshell操作機能を追加する変更ではない。

bundled packageの変更はDAAIのnpm lockに独立entryとして現れないため、lock差分だけでは見落とす。今回の承認はこのVite配布物内の変更も含むが、当該packageを別用途で導入する承認にはならない。Node engineは従来どおり`^20.19.0 || >=22.12.0`、Viteのinstall lifecycle script追加なし、外部dependency宣言も不変。包括的な脆弱性監査やWindows実機editor起動試験は未実施。

## ライセンスと配布義務

[official core MIT license](https://github.com/vitejs/vite/blob/v8.1.6/LICENSE)と、公開packageの完全な`LICENSE.md`を確認した。後者は8.1.5からbyte不変、SHA-256は`b1d741c26b53de1bbc0d4d7d3365b79888f9fe511527544a8a7b8e24dec43147`。bundled license欄はMIT 72、ISC 8、BSD-2-Clause 2、Apache-2.0 1、CC0-1.0 1 section（package数ではない）。変更されたlaunch-editor系・shell-quoteのMIT noticeを含む。

- Viteまたは対象bundled materialを再配布する場合、各copyright/license/適用されるnoticeを保持する。core MITだけでpackage全体を扱わない。
- 今回は既存のbuild/preview tooling更新。browser runtimeへの新しいlibrary採用や、Vite本体の配布を意図しない。従来のThree.js runtime noticeを削除・変更しない。
- 後続buildの配布物検査で新たな第三者コードが見つかった場合は、その配布範囲を再レビューする。byte同一のbrowser bundleは現時点で未確認。

## lockfileの意味とbyte-exact identity

base `6a4a2b1dbe957709cad86d8589ae95cafb474993`とPR101 headから取得したJSONを再帰比較した。差分はrootのVite pin、および`node_modules/vite`のversion/resolved/integrityの4項目のみ。他のpackage entry・version・integrityは不変で、source-map-js 1.2.2の[既存承認](PROD-DEP-006-source-map-js-1.2.2.md)も維持する。

- 新`package-lock.json` SHA-256: `07011c9f06fa753f0dccf80eb30c169f498b100c5d18624ca73da0bdbb2d44cc`
- 旧SHA-256: `4aa37de779084e0edffc11eb4a4df6874e5c0fd09f40d7e398d4f3f49259469d`
- 現行gateの正本: [REVIEWED_PACKAGE_LOCK.json](../evidence/REVIEWED_PACKAGE_LOCK.json)
- PR101のLF byte列をそのまま使用する。`.gitattributes`のlockfile `-text`とfail-closed検証を維持する。旧review・freezeのhashを遡及変更しない。

## 導入後・merge前に別途必要な検証

本記録作成時点で`npm ci`、アプリtest、build、browser smokeは未実施。これらの成否を本静的レビューの結果と混同しない。

1. 対象lockを固定した`npm ci --ignore-scripts --no-audit --no-fund`後、実lockのraw hashとVite version/integrityを再照合する。
2. 現行legal-register / tooling gate、関連アプリtest、`build:hosting`、配布notice検査を実行する。必要なbrowser smokeとCIは対象headを明記する。
3. 同一環境の8.1.5 buildと8.1.6 buildを比較できる場合、generated build identityとruntime payloadの差を区別して記録する。旧freezeや動画の検証結果を新headの測定結果に流用しない。
4. 新version、異なるlock、runtimeへの採用、ツール再配布は再レビュー対象。

## 2026-10-30 導入後の統合検証

静的承認の後、cloud Linux / Node v24.22.1 / npm11.9.0で実行した。base `6a4a2b1…`の633 source blobをGitHub原本とbyte一致確認し、PR101の依存差分と本レビュー・監査pin修正、PR102 `c15b415…`の提出資料、PR103 `2b1dcf0…`のprovenance/ignore修正を合成したtreeが対象。未取得のdesktop実機や過去freezeの測定結果で代用していない。

- 固定`npm ci --ignore-scripts --no-audit --no-fund`（workspace-local cache）成功。導入後もlock SHA-256は`07011c9f06fa753f0dccf80eb30c169f498b100c5d18624ca73da0bdbb2d44cc`、Vite8.1.6。
- `npm test`: **706/706 pass**。更新後`test:tooling`: **119/119 pass**。reviewed-lockfileの5件に、manifest・raw lock bytes・Vite pin・review/register・legal auditの整合検査を含む。6種の意図的な不整合は全て拒否した。
- `validate:syntax` / `validate:public-docs`成功。`validate:legal-registers` **14/14**、`validate:submission-metadata` **13/13**。legal auditのVite固定値も8.1.6へ更新し、未レビュー依存を許すようgateを緩和していない。
- secret/privacy auditの現行source・dist検査は成功。検証用repoはGit履歴を取得していないため、同scriptのhistory項目は**履歴安全性の証拠に数えない**。
- 同一環境の8.1.5と8.1.6の`build:hosting`は双方成功。`build-info.json`を除く全7配布ファイルがbyte一致、runtime bundle SHA-256は双方`0a3853ac655a6f5deb879bd8670b02bb8445ef24cd8f43745b14ca143db30e69`。build identityと生成時刻は比較除外した。source fingerprintはpackage/lockの変更により変わるため、旧freezeのidentityを新依存へ流用しない。
- 追加のLinux headless hosting smokeはChromium起動時の環境制限（`socket() failed: Operation not permitted`）で停止し、browser検査は未実行。権限回避・再試行はしていない。指定Windows / Node24.15.0 / visible Chromeの新規受入、live provider、全編動画・音声の確認は今回の検証範囲外。

remote CIはpush後の実headで別途確認する。本節は上記合成treeのローカル検証であり、過去の公開demoや動画を新commitの実測と表示するものではない。
