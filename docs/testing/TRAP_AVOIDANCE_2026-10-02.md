# 罠の単一回避判定 — 2026-10-02

## 変更

Room Eventsの「回避／踏む」を「回避を試みる」1ボタンへ変更した。成功は無傷、失敗は罠の既存被害を受ける。どちらも一度で解決済みとなり、連打・再入室で再判定しない。成功／失敗を別の文言・効果音で表示する。罠からのXP/G/装備報酬は追加していない。

新規ブラウザ生成では回避成功率70%を表示する。これは今回の**暫定バランス値**で、easy/normal/hard共通。難易度差は既存の被害量（4/6/7HP）・罠数が担当する。防具による被害軽減も維持する。調整は `packages/core/src/trap-rules.js` の版管理定数から行い、同じ版の確率・判定方法を後から変更しない。

## 再現性と互換性

- 新しい任意フィールド `DungeonSpec.trapRules = { version: 'seeded-avoidance-1' }` を追加。schemaVersionは1.0のまま、未知の版・余分なルール項目は検証エラー
- 版・各階のDungeonSpec.seed・trapIdから固定32bitハッシュを計算し、0以上1未満へ正規化して0.7と比較する。部屋ID、操作順、時刻、HP、装備は抽選に含めない
- ブラウザの各階Seedは既存のderivedFloorSeedを使用。同じSpecの再Play、Full JSON再Import、同じSeedの再生成・reload後も同じ判定。Mysteryの新Seedでは別の判定になる
- 旧SpecでtrapRulesがない場合は従来の100%回避を維持し、UIにも100%と表示する。旧Specへの暗黙移行はしない
- 新規生成の内容レイヤーはspecial-rooms-3。special-rooms-1/2の明示選択と旧V1/V2地形生成を維持。V3 APIではtrapRulesが明示されたときだけ新判定を使う
- Full JSON export/importはルールを保存する。地形のみのLayout Exchangeにはもともと敵・罠のゲーム内容を含めない
- 強制triggerTrap APIは旧テスト・診断用途で残すが、ブラウザには公開しない。新ルールのsimulation観測も「踏む」を選択肢にしない

## 攻略経路の保護

生成検査と実Play/simulationは同じ判定関数を使い、期待被害や「全部成功」の仮定で合格させない。

- 経路コストに、固定判定で失敗する罠の実効被害を加算
- 店に到達するまでの保守的被害に失敗罠と持ち越した防具を反映
- 店の装備価値に罠への防具効果を反映。失敗する罠の前にも回復を判断し、死亡後は後続操作を実行しない
- 各階の生存経路を実ランタイムで再生し、HP/Level/XP/G/装備を次階へ引き継ぐ
- 新ルールでは通常部屋も未処理の敵・罠による退出阻止をCore/simulationとブラウザで統一。通常Goalの罠も処理前に自動クリアしない
- 攻略経路補正では既存の自動配置調整を通常罠・自動TrapHouseにも適用できるが、ID・個数・被害・報酬・価格・地形は変えない。先行する通常部屋数量レイヤーの自動overflow分散・抑制は既存仕様どおり。部屋移動で抽選結果は変わらない
- 明示Room ID、Start/Goal指定、特殊部屋内容、通常部屋の数量上限を維持。制約内の有限探索で安全経路が確認できない場合は適用前に拒否。再抽選・明示罠数削減・別地形への置換はしない
- 「生成設定を手動に切り替える」という現行UIに沿ったエラー案内へ5言語を修正（PR #64のレビュー指摘にも対応）

## 検証

実行結果と証拠は以下に記録する。

- 全Node suite: 540件、失敗0。build・構文・legal/privacy監査も通過
- Node回帰: 固定判定ベクトル、成功/失敗、二重操作、順序独立、再Play/Full JSON再Import、防具、死亡、旧Spec、未知版拒否、Goal、simulation一致
- 生成回帰: 失敗込み攻略証拠、明示の致死TrapHouseを原子的拒否、店到達前の罠、防具購入、罠前回復、自動配置後も抽選/個数/地形不変
- 5言語の文言と現行Manualラベル整合
- `node scripts/validate-trap-avoidance.mjs --seeds=4`: 全11方式×3難易度×random/include/exclude×1/3/10階×4Seed、1,188ケース。1,152件を実Runでクリアし、失敗罠1,108回を含む。36件は生成段階で制約拒否、受理されたランの再生失敗は0。証拠 `artifacts/trap-avoidance/route-matrix.json`
- 拒否は主に10階ラン、一部Random Walkの短いランにも発生。有限方策で経路を発見できないという意味で、数学的な「解なし」の証明ではない。全行動の安全性や人間プレイのクリア率は主張しない
- 表示ありChromiumの専用回帰: 18チェック通過、console/page error 0。5言語×成功/失敗、再入室、無傷/HP減少、旧JSON、reload再Import、防具軽減、Goal、2階HP carry、新規ブラウザ生成のルール付与を検証。`node scripts/run-trap-avoidance-smoke.mjs`、成果物 `artifacts/trap-avoidance/ui/`。成功率・失敗時被害が省略されないよう罠カードの説明は折り返し表示を検証

既存room-contentの表示あり回帰も14チェック通過（5言語、キーボード、Auto/Manual、11方式、階別上書き、Goal店、装備・階間carry等）、console/page error 0。

## 末尾の独立した店追加指定

PR #64レビューの再現例「Start in a normal room and make the Goal random and add a shop」と日本語の同等文で、末尾の独立した追加命令がGoal/randomを継承する問題を限定修正した。特殊部屋をadd/place/includeする独立節だけを分け、店の商品列挙のandや、明示したat the Goalは維持する。英日fallback→確認画面でStart=normal、Goal=random、全体shop=include、Cancelで元データ不変を確認する。

ローカル検証はライブAI応答を含まない。公開時は同じUIスモークで配信commit SHAとruntime-source hashの一致も確認する。
