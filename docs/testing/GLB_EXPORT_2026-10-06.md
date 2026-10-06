# GLB外観出力の実装・検証記録

基準main: `b3f86b5de683acd1021211acbaaae3b095d41d0b`。基準tree: `bb58e919a1628fc00e6890119b97ad6f34aa2e8c`。取得した全sourceのGit blob SHAを照合した上で変更した。

## 実装範囲

- 既存の全階Full/Layout JSON export/importを維持
- 選択中の1階の確定済み形状・材質をGLBにする。任意の階高で全階を積層しない
- live rendererと同じbuilderで独立stagingを構築し、編集preview・選択・Play状態を除外
- 公式Three.js `0.185.1`のGLTFExporterを遅延読込。追加依存・有料AI呼出しなし
- 連打防止、失敗時cleanup/retry、非同期60秒deadline、通常Blob downloadとURL解放
- GLB専用statusで、後から始めたGenerate/Importの進捗を上書きしない
- 全5言語で現在階・外観用途・再Import不可を表示。[形式・座標・限界](../architecture/GLB_EXPORT.md)

## 実測した結果

環境はLinux上のNode `24.19.0`。repositoryのpinは`24.15.0`であり、Windows実行ではない。

| 検証 | 結果 |
|---|---|
| `npm test` | 681/681 PASS、FAIL/SKIP 0 |
| renderer unit | 上記に含む51/51 PASS |
| tooling unit | 上記に含む94/94 PASS |
| GLB/cleanup/timeout重点unit | 上記に含む7/7 PASS |
| GLB UI controller隔離検証 | 上記に含む4/4 PASS |
| `validate:glb-export` | 8/8 checks PASS、実adapter/builder/exporter/loaderを使用、WebGLRenderer/OrbitControlsはstub |
| `validate:syntax` | JS/MJS 351件 PASS |
| `build:hosting` | PASS、GLTFExporterの分割chunkを生成 |
| public-doc / legal-register / secret-privacy監査 | PASS |

重点unitは実GLTFExporter/GLTFLoaderによる親子transform・PBR材質・InstancedMesh roundtrip、共有材質非破壊、失敗/timeout時解放、遅い完了と再試行の分離、Blob URL解放を確認した。UI controller検証は実関数を隔離して連打・後続Importのstatus・開始時の階番号・失敗後復帰・mode/validation guard・全言語定義を確認した。DOMと画面操作の合格ではない。

Node統合のfixtureは2階、各階3部屋・2通路・7種Entity（start/goal/enemy/treasure/trap/recovery/shop）。各GLBは38 mesh、12 group、11 material。1階は78,692 bytes、2階は78,716 bytes。配置・scale・行列・world bounds・色/roughness/metalness/emissiveを再読込して照合した。選択/経路/context/部屋ドラッグ/非表示通路previewがある状態でも出力が同一でlive状態・resourceを壊さないこと、repeat・失敗後retry・処理中階変更・Play由来のplayer/ring/fog除外を確認した。

## 未確認と残る受入

`smoke:glb-export`は実装・syntax確認済みだが、実browserでの合格は未確認。cloud executorのChromium起動が`process_singleton_posix.cc: socket() failed: Operation not permitted`でページ表示前に失敗した。Nodeの補助検証をbrowser・GPU・download実操作・画面の見た目の証拠へ昇格させない。

- Windows desktop Chromeで`npm run smoke:glb-export`を実行し、実downloadと全UI経路を確認する必要がある
- Blender等の外部DCCでの目視、Safari/Firefox、実GPUでの見た目、全既存browser suite、公開deploymentはこの検証に含まない
- WebGLRenderer/OrbitControlsをstubしたNode統合では、描画pixelsやブラウザの実ダウンロード成功は検証できない
- native FileReaderはunit/Node統合ではshim。browser smokeはnative APIを使うが、今回は起動できていない
- 基準sourceへpatchを適用した作業コピーでbuildしたため、build-infoのcommitShaはnull/unavailable。公開candidate identityの合格を示さない
- commit/push/PR/merge/deployはこの実装作業では行っていない

browser smokeは外部APIを遮断したfixtureで、実GLBの再読込、5言語、2階の範囲、draft/live状態、連打、階変更/Import競合、FileReader/Blob URL失敗後復帰、無効spec/Play gate、JSON download/reimportを検査する。正常に起動できた環境では`artifacts/glb-export/`へJSON/GLB/画面証拠を保存する。Node統合は`artifacts/glb-adapter/`へ別記録を保存する。
