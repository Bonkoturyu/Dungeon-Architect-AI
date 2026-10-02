# Dungeon Generator Versioning

## 目的

Dungeon Architect AI の生成方式を、将来の改良で上書きせず追跡・再現できるようにする。

生成結果の構造や乱数利用、DesignIntent から生成パラメータへの写像、Room Graph、Layout、Entity 配置など、**生成結果に影響する変更は新しい Generator Version として追加する**。

## バージョン規則

- 現在の生成方式を **Version 1 / V1** とする。
- V1 の実装は `packages/generator/src/versions/v1/` に保存する。
- 新しい生成方式を作る場合は次の `versions/vN/` を追加し、既存Versionを書き換えて代用しない。
- V3 以降も同様に `versions/v3/`, `versions/v4/` ... と追加する。
- `packages/generator/src/generator-versions.js` が対応バージョンと既定バージョンを管理する。
- 公開 API は `version` を指定できる。省略時は `DEFAULT_GENERATOR_VERSION` を使う。
- **同じVersionの生成結果を変える修正は禁止**を原則とする。生成結果が変わる場合は次の整数Versionを作る。
- 文書、テスト、UIだけの変更など、生成結果に影響しない変更は新Versionを必要としない。
- 過去Versionは、比較・回帰・再現・Submission evidence 用に残す。

## Version registry

現在:

| Version | 状態 | 既定 | 実装 |
| --- | --- | --- | --- |
| V1 | Frozen baseline | Yes (library default) | `packages/generator/src/versions/v1/` |
| V2 | DAI-100 locally accepted candidate | No (candidate browser selects explicitly) | `packages/generator/src/versions/v2/` |
| V3 | 特殊部屋・店・難易度のローカル検証候補 | Yes (browser Recommended; library default is V1) | `packages/generator/src/versions/v3/` |

`DEFAULT_GENERATOR_VERSION = "1"`

The DAI-100 browser candidate explicitly requests V2 while the library default remains V1 until the replacement candidate is accepted.

## Generator Strategy boundary

Generator Versionと製品上の選択肢を分離する。

- Generator Versionは再現性のため固定する。
- `Recommended` は製品上のaliasで、受入済みの推奨Versionへ向ける。
- Algorithm LabはBSP / Delaunay+MST / Rooms+Mazes等の独立Coreを同じStrategy contractから選択する。
- 実装非依存contractは `packages/generator-strategy-core/`。
- V1/V2 adapterは `packages/generator/src/strategies/`。
- composition rootは `packages/generator/src/strategy-catalog.js`。

詳細なMarkdown/HTML資料は `docs/generator-algorithms/` を参照する。

## Version 1 — 現行生成方式

### 分類

V1 は既存の一般的な単一アルゴリズムをそのまま実装したものではなく、以下を組み合わせた **deterministic graph-first constructive generator**。

1. Prompt / DesignIntent を生成パラメータへ変換
2. Start→Goal の guaranteed backbone graph を構築
3. Seed により alternate edge 候補を決定
4. `routeChoice` に応じて cycle を追加
5. Room graph を serpentine grid へ配置
6. Start / Goal を端点へ配置
7. Seeded PRNG で Enemy / Treasure / Trap / Recovery を interior room へ配置
8. DungeonSpec validation
9. Renderer 側で orthogonal corridor geometry を routing

### V1 の DesignIntent → Generation Profile

- `roomCount = round(targetDuration / 60)` を `5..20` に clamp
- `routeChoice = intent.routeChoice`
- `enemyCount = round(combatDensity * 4)` を `1..4` に clamp
- `treasureCount = round(rewardDensity * 4)` を `1..4` に clamp
- `trapCount = round(trapDensity * 4)` を `1..4` に clamp
- `recoveryCount = 1` if `targetDifficulty >= 0.65 || fairness >= 0.75`, otherwise `0`

Promptからの既定Seedは、NFKC正規化した文字列へ固定ハッシュ処理を行って生成する。

### V1 Room Graph

Room は `room-001 ... room-N` の固定順序を持つ。

まず、

```text
room-001 → room-002 → ... → room-N
```

という backbone を必ず作る。

- Start = `room-001`
- Goal = `room-N`
- backbone があるため Start→Goal の構造的到達性は生成時点で保証される。

Alternate route:

- capacity = `max(1, floor(roomCount / 3))`
- target = `round(routeChoice * capacity)`
- backbone上で2～4 Room離れたRoom pairだけを候補にする
- Seeded PRNGで候補順をshuffle
- target数だけ採用
- 同一Seed + roomCountでは、routeChoiceを増やした場合に以前のalternate集合をprefixとして保持する

したがって、alternate edge 1本につき cycle rank が1増える。

### V1 Spatial Layout

`layoutRoomGraph()` は固定値を既定とする。

- columns = 4
- spacing = 12
- roomSize = 8 × 8
- 偶数行は左→右
- 奇数行は右→左
- serpentine / snake 配置

例:

```text
01 02 03 04
08 07 06 05
09 10 11 12
16 15 14 13
```

**重要:** 同じ `roomCount` なら、Seedが変わってもRoomの基本座標は変わらない。Seedで変わる主なものはalternate routeの選択とEntity配置である。

このためV1 Mysteryはfresh seedでも「空間配置そのもの」は似て見えやすい。これはV1の既知制約であり、V2候補では spatial layout variability を改善対象とする。

### V1 Entity placement

Start / Goal以外はinterior roomsからSeeded PRNGでRoomを選ぶ。

Seed stream:

- Enemy: `seed ^ 0x11ee11ee`
- Treasure: `seed ^ 0x22ee22ee`
- Trap: `seed ^ 0x33ee33ee`
- Recovery: `seed ^ 0x44ee44ee`

V1では同一Roomへ複数Entityが配置される場合がある。

Treasureのwarning、TrapのwarningはDesignIntentから決定される。

### V1 Event

最初のTreasureに対して `on_open_treasure → reveal_hint` のone-shot eventを1件追加する。

### V1 Renderer routingとの境界

Generator V1 が決定するのはRoom座標、Roomサイズ、Corridorの接続関係まで。

実際の3D Corridor形状はRenderer側のorthogonal routerが構築する。したがってCorridor geometry routingの改良は、DungeonSpec生成結果そのものを変えない限りGenerator Versionとは別管理とする。

## V1 frozen source

V1 baseline source:

| File | Git blob SHA |
| --- | --- |
| `versions/v1/prng.js` | `a3cd984e12e1b7980877beaf267d17e3e61819eb` |
| `versions/v1/room-graph.js` | `4f5978300158614198e3e7f3acf636fd86fe5868` |
| `versions/v1/layout.js` | `8745bb6cebd1645ee7dddad07e67e70e3f46e349` |
| `versions/v1/dungeon-generator.js` | `1cd5eab68e037eb2c0571a2cf1ea35b00979cd4c` |
| `versions/v1/design-intent-generator.js` | `1925a2197155fe4a7582a664bb0fffbbb63dbe77` |

この表はV1 archive作成時点の参照値。V1の生成ロジックを変更する必要が生じた場合、原則としてV1を更新せずV2を追加する。

## Version 2 — DAI-100 spatial-variation candidate

V2 intentionally preserves the V1 gameplay-generation profile and Room Graph semantics while replacing only the spatial layout stage.

Inherited from V1:

- prompt hashing / default Seed;
- targetDuration → roomCount mapping;
- routeChoice → alternate-edge target;
- guaranteed sequential Start→Goal backbone;
- alternate-edge selection;
- Enemy / Treasure / Trap / Recovery counts and seeded placement;
- first-Treasure hint event.

Changed in V2:

- Seed selects one of multiple column counts;
- Seed selects spacing from 12 / 13 / 14;
- Seed selects one of eight rotation/mirror orientations;
- Seed selects the first serpentine row direction;
- each Room receives deterministic 7–9 × 7–9 dimensions from the same Seed stream;
- coordinates are normalized after orientation so generated layouts remain easy to frame.

The goal is visible spatial diversity for same-room-count generation and Mystery play without replacing the proven graph/gameplay semantics.

V2 acceptance requires a multi-seed / multi-room-count / multi-routeChoice matrix to pass both DungeonSpec validation and Three.js scene-plan corridor routing.

The DAI-100 candidate browser explicitly uses V2. V1 remains available unchanged for regression/reproduction.

## 新Version追加手順

V2の例:

1. `packages/generator/src/versions/v2/` を追加
2. V2専用PRNG / graph / layout / intent mappingを必要に応じて配置
3. `generator-versions.js` に `"2"` を登録
4. facadeで `version: "2"` をdispatch
5. V1回帰テストが以前の結果を維持していることを確認
6. V2専用テストと比較evidenceを追加
7. 本文書へ「Version 2」節を追加
8. デフォルトをV2へ変更する場合のみ `DEFAULT_GENERATOR_VERSION` を更新
9. V1実装・資料は削除しない

## API

```js
generateDungeonSpec({
  version: "1",
  seed: 123,
  roomCount: 8,
  routeChoice: 0.5,
});

generateDungeonFromDesignIntent(intent, {
  version: "1",
  prompt,
});
```

Version省略時は現在の既定Versionを使う。

## 関連資料

- [Dungeon Generation Algorithms Research](../research/DUNGEON_GENERATION_ALGORITHMS.md)
- [DungeonSpec v1](../../spec/dungeon/DUNGEON_SPEC_V1.md)


## Version 3 — 特殊部屋・店・難易度

V2の空間生成をそのまま使用し、明示された部屋planと装備／難易度ルールを追加する。V1/V2の実装・乱数列・出力は変更しない。planも新ルールもなければV2と同じSpecを返す。

- monster-house：指定個数の休眠敵と入室時one-shot起動
- trap-house：指定個数の罠
- shop：指定商品・価格・在庫。指定部屋の通常生成内容は置換し、Start/Goalは保護
- 店の最高価格商品1つ分のG専用宝箱を、店より前の通常部屋に置く。前に通常部屋がなければStartを使う
- 生成前に未指定値を確認・変更でき、明示値を無言で減らさない
- 追加敵・罠は1階合計100が既定。検証環境での高度設定最大250。生成の前に合計上限を検査
- 難易度／装備効果は新しいSpecの明示ルール。旧Specのプレイ挙動は維持

公開APIの `version:"3"`、strategy `version-3-special-rooms` から利用する。LibraryのdefaultはV1を維持し、ユーザー承認に基づきbrowser Recommended aliasはV3へ変更した。V1/V2は明示選択可能。

詳しい承認値、測定条件、検証結果、未検証事項は `docs/testing/SPECIAL_ROOMS_V3_2026-10-02.md` を参照。

未指定の特殊部屋種別は、それぞれ独立したSeed streamで1/3の確率で存在を決める。明示include/excludeを優先し、部屋容量不足ではrandom候補だけを除外して確認画面に理由を表示する。Mysteryの新Seedではrandom有無も再決定する。

## 共通内容レイヤー special-rooms-1

ブラウザでは全Strategyの選択地形を維持し、その新規生成結果に特殊部屋・店・難易度を適用できる。`generatorStrategyId` / `algorithmVersion` / `generatorVersion`は地形の由来を示し、`contentLayerVersion: "special-rooms-1"`は内容処理を別に示す。V3の内容処理は二重実行しない。無装飾ライブラリAPIは従来出力を保持する。

Start/Goalの明示設定・ランダム、Auto、Play終了条件は [共通内容レイヤー検証](../testing/ROOM_CONTENT_LAYER_2026-10-02.md) を参照。
