# PROD-DEP-006 — source-map-js 1.2.2 / 現行lockfileレビュー

レビュー日: 2026-10-06。対象はDependabot PR #79の`4a73c67574b8bebd527669839d9d76b112ae1e8f`に含まれるlockfile。build/dev tooling用途に限定してApprovedとする。

## 変更と出所

- 経路: `vite@8.1.5` → `postcss@8.5.28` → `source-map-js@1.2.2`
- 旧version: `1.2.1`。lockfileの意味上の変更は同packageのversion、resolved URL、integrityのみ。root依存と他のpackage entryは不変
- 公式配布物: https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz
- npm integrity: `sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==`
- 公式tag: https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2
- upstream commit: `0a1d334fd1e55a47df97fcd60a7915d46df3b08a`
- 公式変更比較: https://github.com/7rulnik/source-map-js/compare/v1.2.1...v1.2.2
- license: BSD-3-Clause。公式npm package内のLICENSEでMozilla Foundation and contributorsのcopyright、source/binary再配布時のlicense保持、endorsement制限を確認

公式npm registryのmetadataとlockfile integrityを照合し、`npm ci --ignore-scripts --no-audit --no-fund`で固定graphを導入して検査した。別のpackage、runtime用途、配布用途の承認は含まない。

## 修正内容と影響の境界

公式releaseはCSPでunsafe-evalを許可しない環境のsort crash、およびmalicious indexed source mapによるDoSを修正する。CVE-2026-93749 / GHSA-68fv-2mgg-jv7qの修正版は1.2.2。

- advisory: https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- indexed offsetの非負safe integer・上限・nested合算を検査し、巨大line gapとnested sources処理を改善
- eval禁止時は動的コード生成を使わないsort経路へfallback
- 本projectではVite/PostCSSのbuild/dev tool依存。production app / Functionsから直接使用せず、現在のbrowser runtime外部依存はThree.jsのまま
- 攻撃者から渡されたsource mapを処理する経路の存在は別途必要であり、公開Dungeonアプリでのruntime exploitを確認したという意味ではない

同じLinux/Node v24.19.0/npm 11.9.0環境でmainとPR #79をbuildし、`build-info.json`以外の7ファイルがbyte一致した。bundle SHA-256は両方とも`721e3b3cbcaad635a9815c97a4fd04cbf02d63a6ace176ccd4dcfbe731b982fc`。固定packageに対するoffset拒否、nested上限、code終端越え、40段nested map、line gap、eval禁止sortの6検査も通過した。Windows実機結果や新たなpublic deploymentの検査とは区別する。

## 現行のbyte-exact lock identity

- `package-lock.json` SHA-256: `4aa37de779084e0edffc11eb4a4df6874e5c0fd09f40d7e398d4f3f49259469d`
- Git blob: `80f7e4226405501a7eacd5119ad00e546f34fae5`
- 今回のlockfileはLF。Dependabotのbyte列を変更せず採用し、`.gitattributes`の`-text`でWindows checkoutでも自動改行変換を禁止する
- 現行検証の正本: [`../evidence/REVIEWED_PACKAGE_LOCK.json`](../evidence/REVIEWED_PACKAGE_LOCK.json)
- NodeとWindows PowerShellの現行validation gateは同じ正本を読み、実ファイルのraw SHA-256と比較する。欠落、不正manifest、未レビューのlockfile変更はfail-closed
- 旧`ce94a9ee...`の[2026-09-12監査](../PACKAGE_LOCK_AUDIT_2026-09-12.md)、過去の実測・freeze manifestは歴史的証拠として保持する。特定commitに固定されたDAI-084のaudit / wrapperも旧identityを維持し、現行candidateの検証にはDAI-099を使用する

byte同一bundleでもlockfile変更でruntime source fingerprintは変わる。現行candidateのcommit/source identity、公開build、動画との整合は後続のfreeze検証で再確認する。旧freeze証拠を新candidateへ転記しない。

## 配布義務

このpackageはbrowser bundleへ追加されないため、今回の変更でpublic runtime noticeを増やす必要はない。package自体を将来再配布する場合はBSD-3-Clauseのcopyright・条件・disclaimerを保持する。新たなruntime組込みや再配布は再レビュー対象。
