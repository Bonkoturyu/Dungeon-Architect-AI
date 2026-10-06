# JSON再編集とGLB外観出力

## 使い分け

編集モードのCreate → インポート / エクスポートを使う。

| 形式 | 対象 | 用途と境界 |
|---|---|---|
| 完全JSON / Full JSON | 全階 | DungeonRunSpecのDungeonSpec・Entity・Eventを再編集する。プレイ途中のセーブ、Undo/Redo履歴、カメラや音設定のバックアップではない |
| レイアウトJSON / Layout JSON | 全階 | 部屋・通路・Seed・Start/Goal役割を交換する。内容のEntity/Eventは含まない |
| GLB | 選択中の1階 | 他の3Dツールへ静的な形状と材質を渡す。Dungeonへの再読込・編集可能な往復・他ツールでのゲーム動作は保証しない |

JSONの既存schema・ファイル名・Import動作は変更しない。再編集用途では完全JSONを保存する。LayoutのImportは既存の規則でStart/Goal等を再構成するため、完全JSONと同じ内容の復元ではない。

GLBのファイル名は`<dungeon-id>.floor-<1始まりの階番号>.glb`。他の階は階選択を切り替えて個別に書き出す。別々の階は独立したXZ位置設計のため、未知の階高を仮定した積層や並べ替えをしない。

## GLBに含むもの / 含まないもの

- 編集確定済みDungeonSpecから作る床、壁、通路、Start/Goalや敵・宝・罠・店・回復など、現rendererが表示する配置物の形状・材質を含む
- 編集中のドラッグpreviewは含めず、最後に確定した位置・大きさを使う
- 選択枠、経路highlight、ドラッグhandle、画面UI、Playのプレイヤー・現在地ring・Fog of War・一時effectは含まない
- Eventのロジック、衝突判定、敵AI、HP、進行状態、霧、背景、照明、カメラ、音、アニメーションは含まない
- 表面の色、roughness、metalness、emissiveなどはglTF材質へ変換する。ただし他ツールの照明・色管理・対応extensionによって外観は変わる。スクリーンショットと同一の描画結果は保証しない

rendererの座標値を変更せず、XZを床面、Yを上、+Xを東、+Zを南として出力する。部屋寸法は全幅・全奥行きで、床上面はY=0。Dungeonの単位は抽象単位であり、実測メートルではない。glTFの数値上は1 Dungeon単位を1単位として渡すため、メートル扱いする読み込み先では用途に応じて縮尺を調整する。

## 実装と所有権

`three-renderer-adapter.exportDungeonGlb(spec)`は画面表示と同じ`createDungeonScenePlan`と`buildStagingScene`を使い、Play用optionなしの独立stagingを作る。live sceneの親子関係・transform・camera・selection・specを変更しない。stagingのgeometryは完了/失敗のどちらでもdisposeする。共有materialは最初のawait前にcloneし、export後にcloneだけをdisposeする。内部userDataは出力しない。

固定済み`three@0.185.1`の公式`GLTFExporter`をdynamic importし、glTF 2.0 binaryを単一GLBにまとめる。追加npm依存・外部asset・provider通信はない。現rendererは通常のMeshとMeshStandardMaterialを使う。公式addonのInstancedMesh対応は`EXT_mesh_gpu_instancing`を使うが、現在のDungeon出力はそのextensionに依存しない。

連続クリックは1件にまとめず、処理中の新規要求を`EXPORT_BUSY`で拒否する。開始時に階番号・確定spec・geometry・materialを固定するので、処理中の階変更や編集が出力内容に混入しない。GLB専用statusを使い、後から始めたGenerate/Importの表示を上書きしない。失敗時は日本語を含む選択中言語の通知を出し、busyを解除して再試行できる。60秒で非同期処理が完了しない場合も失敗扱いにする。これは内部処理のabortではなく、同期処理の中断もできないが、遅れて返った結果はdownloadに使用しない。Blob URLと一時anchorも成功/失敗の両方で解放する。Windows Chromeで既存JSONと同じ通常download方式を使い、File System Access APIや追加権限を要求しない。

## 再検証

```powershell
npm test
npm run validate:syntax
npm run build:hosting
npm run validate:glb-export
npm run smoke:glb-export
```

`validate:glb-export`は実adapter/builder/exporter/loaderを使うNode統合検証。WebGLRenderer/OrbitControlsとFileReaderを検証用に差し替えるため、GPU・browser・画面操作の証拠ではない。

smokeはfixtureを使用し、有料AI呼出しを行わない。実GLBを公式GLTFLoaderで再読込し、階の範囲・geometry/material・除外対象・状態不変・連続クリック・失敗後の復帰・JSON互換を確認する。browserの実行環境と結果は[検証記録](../testing/GLB_EXPORT_2026-10-06.md)を参照し、Nodeの確認をbrowserやWindowsの実測PASSと言い換えない。

## 公式根拠

- [Three.js GLTFExporter docs](https://threejs.org/docs/pages/GLTFExporter.html)
- [固定r185のGLTFExporter source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/exporters/GLTFExporter.js)
- [依存の用途レビュー](../legal/THIRD_PARTY_DEPENDENCIES.md)
