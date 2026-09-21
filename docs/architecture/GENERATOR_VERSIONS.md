# Dungeon Generator Versioning

## 目的

Dungeon Architect AI の生成方式を、将来の改良で上書きせず追跡・再現できるようにする。

生成結果の構造や乱数利用、DesignIntent から生成パラメータへの写像、Room Graph、Layout、Entity 配置など、**生成結果に影響する変更は新しい Generator Version として追加する**。

## バージョン規則

- 現在の生成方式を **Version 1 / V1** とする。
- V1 の実装は `packages/generator/src/versions/v1/` に保存する。
- 将来 V2 を作る場合は `packages/generator/src/versions/v2/` を追加し、V1 を書き換えて代用しない。
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
| V1 | Frozen baseline | Yes | `packages/generator/src/versions/v1/` |

`DEFAULT_GENERATOR_VERSION = "1"`

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
