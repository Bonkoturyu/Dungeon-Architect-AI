# DungeonSpec v1 — Production Contract

## Status

Clean-room production contract. No Pre experiment implementation is copied.

## Required top-level fields

- `schemaVersion`: `1.0`
- `id`: non-empty string
- `seed`: non-negative safe integer
- `rooms`: array
- `corridors`: array
- `entities`: array
- `events`: array

## Rooms

- `id`
- `x`, `z`
- `width`, `depth` > 0

任意の `kind`: `normal | monster-house | trap-house | shop`。省略時は従来の通常部屋。
種類だけでは敵の移動・自動戦闘を追加しない。MonsterHouse は既存の入室イベント、
TrapHouse は既存の armed trap と退出ブロックを利用する。

## Corridors

- `id`
- `fromRoomId`
- `toRoomId`
- `width` > 0

Both room references must exist; a corridor cannot connect a room to itself.

Optional manual-rendering preferences:

- `fromSide`: `north | east | south | west`
- `toSide`: `north | east | south | west`

When omitted, the renderer/router chooses the doorway side automatically. These fields constrain only the endpoint wall used by the orthogonal corridor route; they do not change logical graph connectivity.

## Entities

MVP v1 types:

- start
- goal
- enemy
- treasure
- trap
- recovery
- shop

Each entity requires a stable ID and valid room reference.
Exactly one Start and one Goal are required.

### Shop / Gold / equipment（後方互換の任意拡張）

`shop` Entity は非空の `offers` 配列を持つ。商品は以下を明示する。

- `id`: 店舗内で一意の非空文字列（店舗間での再利用可）
- `type`: `healing | weapon | armor`
- `price`: 0以上の safe integer（G）
- `stock`: 1以上の safe integer
- healing 商品: `healing` を1以上の safe integerで指定。`tier` は不可
- weapon / armor 商品: `tier` を1以上の safe integerで指定。`healing` は不可

`treasure` は任意の `goldReward`（0以上の safe integer）で獲得Gを明示できる。
省略時は従来のSeed/Entity ID由来の報酬。任意の `rewardItem: false` は宝箱からの
装備入手を抑制する。金額は宝箱を開けた時だけ獲得し、生成時の所持Gには加算しない。

任意の top-level `equipmentRules` は次の3つをすべて0以上の safe integerで持つ。

- `weaponEnemyReductionPerTier`
- `armorDamageReductionPerTier`
- `minimumPositiveDamage`

省略時は従来のダメージ処理を保持する。`difficulty` は任意の
`easy | normal | hard` メタデータ。V3生成APIの明示 `difficultyProfile`
(`enemyDamage`, `trapDamage`, `recoveryHealing`、すべて正の safe integer)
は敵/罠の `damage`、回復Entityの `healing` に展開する。Coreが難易度名から数値を推測しない。

## Stable IDs

Room, corridor, entity and event IDs share one global namespace in v1. Duplicate IDs are rejected.

## Reachability

Current Core validation builds an undirected adjacency graph from valid corridor references and rejects a Goal room that cannot be reached from the Start room with `GOAL_UNREACHABLE`.

This is structural reachability only. Key/door/event-condition soft locks are handled by later validation tasks.

## Renderer independence

Serialized DungeonSpec does not contain renderer objects, DOM nodes, Unity objects, GPU handles, scene nodes or runtime session references.

## Generator versioning

`DungeonSpec.schemaVersion` describes the serialized data contract. It is **not** the generator algorithm version.

The current generation method is frozen as **Generator Version 1** under:

`packages/generator/src/versions/v1/`

Future generation algorithms are added as Version 2, Version 3, etc. without overwriting V1. See:

- `docs/architecture/GENERATOR_VERSIONS.md`
- `docs/research/DUNGEON_GENERATION_ALGORITHMS.md`

## Generator contract now available

The production **Generator Version 1** can create:

- deterministic room graph from Seed
- guaranteed backbone Start→Goal route
- deterministic alternate route choices based on `routeChoice`
- deterministic serpentine grid layout
- Start/Goal entities

### Multiple-route constraints

For Generator Version 1:

- `routeChoice` remains normalized to `[0, 1]`;
- alternate-route capacity is `max(1, floor(roomCount / 3))`;
- requested alternate count is `round(routeChoice * capacity)`;
- the generator produces that exact alternate count for every supported room count (`3..64`);
- every alternate edge reconnects two rooms already on the backbone rather than creating a disconnected/dead-end branch;
- alternate edges skip at least one backbone room and span at most four backbone steps;
- duplicate/self/adjacent alternate edges are not generated;
- increasing `routeChoice` for the same Seed/roomCount preserves the lower-choice alternate set as a deterministic prefix;
- each alternate edge adds one independent graph cycle, so a positive alternate count yields multiple Start→Goal route choices while retaining the guaranteed backbone.

These constraints are structural. They do not yet assign risk, reward, safety, trap, combat, or semantic quality to one route versus another.

The same inputs are byte-stable within the current schema/generator implementation.

### Generator V3 — 特殊部屋の明示構成

`versions/v3/` は凍結したV2を新規生成の土台として使い、V1/V2の実装や出力を変更しない。
公開APIの `version: "3"`、Strategy ID `version-3-special-rooms` を追加する。
ライブラリ既定V1 / Recommended alias V2 は変更しない。

直接APIは `roomPlans`, `equipmentRules`, `difficulty`, `difficultyProfile` を受け取り、
Strategyでは同じ値を `request.options` に渡す。
`roomPlans` 省略/空、他の任意値も省略ならV2と同じspecになる。

`roomPlans` は現在の1フロア分だけの配列。各planは以下を持つ。

- 任意の `id`: 非空かつ一意。省略時は入力順から `room-plan-{index+1}` を生成
- `kind`: `monster-house | trap-house | shop`
- `floorNumber`: 解決済みの正の safe integer。複数階混在は呼び出し側のfilter漏れとして拒否
- `roomId`: 明示的な既存の部屋ID、または `null`（Seedで自動配置）
- `entityCount`: Houseは明示の正の safe integer。Shopは `null`
- `offers`: Houseは空配列。Shopは上記の非空商品配列

Start/Goal、重複した部屋指定、不明な部屋、空き部屋不足、不正/未解決の個数はエラーにする。
明示Room IDを先に予約し、残りはStart/Goal以外の部屋から重複なくSeedで選ぶ。
個数をclampしたり一部のplanを黙って落としたりしない。

新規生成の指定特殊部屋はV2由来の内容を置換し、削除Entityを参照した生成イベントも除く。
MonsterHouseは指定数の dormant enemy と入室時one-shot `spawn_enemy_group` を生成。
TrapHouseは指定数の通常trap、Shopは敵/罠のない1つのshopを生成する。
通常部屋の既存内容と廊下は保持する。この置換は編集済みDungeonSpecへの編集APIではない。

Shopがある場合は各店舗で最高価格の商品を1回買える額のGを、そのshopへの最短経路上の
直前の通常部屋に補充宝箱として用意する（1店舗につき最大1箱、`rewardItem: false`）。
通常部屋がStart以外にない場合だけStartへ置き、後半店舗の予算を原則として最初に配らない。
経路計算では入るとPlayが終了するGoalを除外し、MonsterHouse/TrapHouse/他のshopを
予算箱の配置先にしない。敵報酬や任意経路の宝箱は算入しない。
ショップの順序はStartからのBFS距離、同距離ならIDで決定する。予算総額がsafe integerを
超える指定は生成前に拒否し、高価格を大量Entityに変換しない。
この保証は「Gを回収可能」であり、回収や購入の実行、すべての在庫購入、全明示設定での
生存・クリアを保証するものではない。`profile.shopEconomy` に追加箱数、Startで回収可能な
Gと全体の回収可能額、各shopの価格/配置先/経路/距離/Startフォールバックを記録する。
Gの獲得源は宝箱/敵報酬のまま。

価格/効果/個数/難易度の既定値決定とユーザー確認は呼び出し側で行い、V3は未解決値を補完しない。

### 最初のShopまでの必須戦闘チェック

実際に解決済みShop planがある時だけ、特殊部屋の内容を置換する前に到達チェックを行う。
通常部屋・Houseの無軽減ダメージを重みにした有界Dijkstra探索でShopへの経路を選び、
既存Play runtimeの初期HP、敵ID由来XP、Level Up閾値/HP増加で生存を評価する。
同室では表示済みXPの高い敵から処理する。GoalをShopへの途中経路に含めない。
罠は既存の回避操作を前提とし、任意の装備loot/回復には依存しない保守的判定である。
全経路や戦闘状態の無制限探索ではなく、通常は部屋数R/廊下数Eの探索1回、
移設候補を調べる場合も有限のR候補だけを検査する。

そのまま生存できれば配置を保持する。失敗時だけ、自動配置のShopを元の位置に近い
未使用通常部屋へ移し、それでも無理なら自動配置同士の特殊部屋を交換する。
明示Room ID/Floorは動かさず、許可された配置変更で安全を確認できない場合は
`FIRST_SHOP_SURVIVAL_CONFLICT` で拒否する。敵1体のdamageや数は変更しない。
回復Entityの自動追加/置換も行わない。判定は最初のShopに届く1経路の保証であり、
任意経路・任意の操作・全設定のクリアを保証するものではない。
`profile.shopPlacementGuard` に判定前後の経路・想定HP・移動したplanを記録する。
Shopが含まれない解決済みplanには、このチェックもG補充も適用しない。

### 特殊部屋Entityの技術上限

1フロアの全MonsterHouse enemy + TrapHouse trapの合計は既定で100まで。
`specialRoomEntityLimit` で明示的に小さい上限を指定でき、Advanced設定からの増加は
ネイティブChromiumで実測済みの `MAX_SPECIAL_ROOM_ENTITY_LIMIT` までに制限する。
現時点のAdvanced最大値は250。共通定義は `packages/intent/src/room-limits.js`。
`validateConfirmedRoomPlanLimits(plans, limit)` は全フロアの確認済みplanを検査し、
`{ limit, entityCountByFloor }` を返す。異なるフロア間では件数を合算しない。
この上限は通常部屋の既存Entity数や
shop商品在庫には適用せず、特殊部屋の配置処理の負荷を制限する。
上限は直接V3 API / DesignIntent API、Strategyの `request.options` で渡す。
全planを合計してから配置を始め、超過は `SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED` として
拒否する。大きい値を暗黙にclampしたり、後半planを落としたりしない。

250は普遍的なハードウェア上限ではなく、2026-10-02のネイティブChromium / SwiftShader、
1440×900で検証したAdvanced設定上限。100時のフレーム中央値19msに対し、
250時は64ms（p95 103.5ms）で、既に描画負荷の増加がある。
500時は中央値127ms / p95 1406ms、1000時は中央値3004msだったため許可範囲外とした。
既定は100を維持し、Advancedへの引き上げはユーザーの明示設定に限定する。
測定記録: `artifacts/special-rooms/capacity.json`（ローカル検証artifact）。

## Current non-goals

- key/door dependency validation
- event semantic validation
- risk/safety semantics on alternate routes
- route quality / intent-fit scoring
- runtime state
- renderer-specific objects
- persistence migration

### V3の攻略経路検証と複数階の引継ぎ

`difficultyProfile`を指定するV3生成は、Start→Goalの有限個の方策を実Play Runtimeで実行し、成功した操作列を`profile.routeViability.witness`に返す。最小被害経路・最短経路・店優先・loot優先の高々4方策で比較し、生存HPの多い証拠を選ぶ。罠は回避し、通常部屋も全敵を倒してから退出する。全状態空間や全単純経路を探索するsolverではない。

証拠が得られない自動配置は、既存の装備宝箱をStartへ移動、既存回復を到達した通常部屋へ移動、通常敵を経路外の通常部屋へ移動する順で補正する。なお足りない場合は、部屋数×自動MonsterHouse数までの候補から、家と通常部屋の内容を丸ごと交換する。明示した特殊部屋ID、敵/罠数、ダメージ、回復量、item、G、商品価格は変更せず、新しい店や回復は追加しない。店用G箱はこの補正で移動しない。家のspawn eventの部屋参照も同時に更新する。各補正は成功した証拠がある場合だけ採用する。

固定条件などにより証拠が得られない場合は`ROUTE_VIABILITY_CONFLICT`で生成を中止する。この結果は有限方策で確認できなかったという意味で、数学的な解なしの証明ではない。`difficultyProfile`未指定のV3互換APIは従来どおりで、V1/V2は変更しない。

初階は標準20HP・装備なし・0Gで検証する。2階以降は生成API/Strategyの`initialPlayerState`へ前階の`witness.playerState`をそのまま渡し、HP/最大HP/XP/level/G/装備を引き継いだ状態で検証する。Runの実遷移と操作列の再生でも状態の一致を検証する。プレイヤーが異なる行動をした場合や、敵・罠を追加編集した場合までの生存保証ではない。`assumptions.scope`は`fresh-player-single-floor`または`provided-carried-player-state`を明示する。

検証記録は`artifacts/special-rooms/tri-state-presence-after-route-guard.json`、`multifloor-route-viability.json`に保存する。生成時間には攻略経路検証のコストも含まれるため、以前の軽量V3生成だけの測定値をそのまま流用せず、`generation-after-route-guard.json`を参照する。

## 罠回避ルール（任意、後方互換）

`trapRules: { "version": "seeded-avoidance-1" }` は回避成功率70%の固定Seed判定を有効にする。
版・各階の`seed`・罠Entity IDだけから成功/失敗を決定し、成功は無傷、失敗は既存damageと防具軽減を適用する。
いずれも一度だけ解決する。未知の版・余分なルール項目は拒否する。
`trapRules`未指定の旧Specは100%回避を維持する。詳細は `docs/testing/TRAP_AVOIDANCE_2026-10-02.md`。
