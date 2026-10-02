# BSP — Binary Space Partitioning

## 目的

Algorithm Lab の2番目の独立生成Core。

BSPは大きな矩形領域を再帰的に二分し、最終的なleaf領域へRoomを1つずつ配置する。

```text
Root bounds
   ↓
split X / Z
   ↓
binary partition tree
   ↓
leaf regions
   ↓
one Room per leaf
   ↓
sibling-subtree links
   ↓
optional extra links
```

Delaunay方式が「Roomを自然に散らして近傍graphを作る」方式なのに対し、BSPは「空間を先に区画し、その中にRoomを置く」方式。

---

## 1. 基本イメージ

最初は1枚の大きな土地。

```text
+---------------------------+
|                           |
|                           |
|                           |
+---------------------------+
```

縦または横に分割。

```text
+-------------+-------------+
|             |             |
|             |             |
+-------------+-------------+
```

さらに分割。

```text
+------+------+-+-----------+
|      |      | |           |
+------+------+ |           |
|             | |           |
+-------------+-+-----------+
```

leafごとにRoomを置く。

```text
+------+------+-+-----------+
| [A]  | [B]  | |   [C]     |
+------+------+ |           |
|     [D]     | |   [E]     |
+-------------+-+-----------+
```

---

## 2. Dungeon Architect AIでのCore責務

Coreは以下だけを担当する。

- Root bounds決定
- binary partition tree
- split axis / split position
- leaf領域生成
- leaf内Room placement
- sibling subtree間のtree link
- optional extra connection
- algorithm invariant検査

Coreは以下を知らない。

- DesignIntent
- DungeonSpec
- DOM
- Three.js
- Editor
- Play
- AI provider
- Cloudflare

```text
packages/generator-algorithms/bsp/
            │
            │ BSP-native IR
            ▼
packages/generator/src/strategies/bsp-lab.js
            │
            ▼
DungeonSpec
```

---

## 3. Partition Tree

内部nodeは2つのchildを持つ。

```text
           Root
          /    \
        P1      P2
       / \      / \
     P3  P4   P5  P6
```

leaf数が要求Room数に達するまでsplitする。

現在のCoreでは、split可能なleafの中から面積が大きいものを優先する。

---

## 4. Split axis

区画が横長ならX方向、縦長ならZ方向を優先。

```text
横長:
+-----------------------+
|                       |
+-----------------------+
          ↓ X split

+----------+------------+
|          |            |
+----------+------------+
```

```text
縦長:
+---------+
|         |
|         |
|         |
+---------+
     ↓ Z split

+---------+
|         |
+---------+
|         |
+---------+
```

縦横比が近い場合はSeed PRNGで選択する。

---

## 5. Split position

中央付近を基準にしつつ、Seedで少しjitterさせる。

```text
exact center:
|----------|----------|

jitter:
|--------|------------|
```

parameter:

- `splitJitter`
- 0 = 常に中央
- 0.18 = 現在のdefault
- 上限 0.3

ただし両childにRoomを置ける最低spanを必ず確保する。

---

## 6. Room placement

各leafにRoomを1つ配置する。

```text
leaf
+----------------+
|                |
|      [Room]    |
|                |
+----------------+
```

Roomはleaf中央付近にSeedでjitter配置される。

Roomとpartition境界の間には `roomMargin` を確保する。

これにより、異なるleafのRoom同士がoverlapしにくい構造になる。

最終的にもCore invariantとしてRoom rectangle overlapを検査する。

---

## 7. Tree connection

BSP treeの各internal nodeについて、left subtreeとright subtreeから代表Roomを1つずつ選び、その2Roomを接続する。

```text
       parent
      /      \
 left tree  right tree
    A           D
    |           |
    B           E

        ↓

    A           D
    |           |
    B --------- E
```

internal node数はleaf数 - 1なので、基本tree edge数も:

```text
N - 1
```

となる。

これにより全Room接続を保証する。

---

## 8. Extra connection

BSP treeだけではloopがない。

そこで近距離Room pairから追加候補を作り、DesignIntentの `routeChoice` を:

```text
extraConnectionRatio
```

へ対応させる。

```text
BSP tree:

A---B
    |
    C---D

extra:

A---B
|   |
D---C
```

追加edgeは無制限ではなく、Room数に応じてboundedにする。

---

## 9. Core API

```js
import {
  generateBspCore,
} from '@dungeon-architect/generator-bsp';

const result = generateBspCore({
  seed: 123456789,
  roomCount: 10,
  extraConnectionRatio: 0.6,
});
```

主要input:

| Field | 意味 |
| --- | --- |
| `seed` | deterministic Seed |
| `roomCount` | leaf / Room数 |
| `extraConnectionRatio` | extra edge量 0～1 |
| `roomSizeMin` | 最小Room size |
| `roomSizeMax` | 最大Room size |
| `roomMargin` | leaf境界とのmargin |
| `splitJitter` | split位置の揺らぎ |
| `coordinateStep` | 座標quantization |

---

## 10. BSP-native output

```js
{
  algorithm: 'bsp',
  algorithmVersion: '1',
  rootBounds,
  partitions,
  leaves,
  rooms,
  treeEdges,
  extraEdges,
  finalEdges,
  diagnostics
}
```

### partitions

binary partition tree全node。

### leaves

Roomを置く最終leaf。

### rooms

leafに対応したRoom geometry。

### treeEdges

BSP sibling subtree由来の必須接続。

### extraEdges

routeChoice由来のoptional loop。

---

## 11. Determinism

同じ:

- Algorithm Version
- Seed
- roomCount
- extraConnectionRatio
- options

なら同じ結果を返す。

PRNGはCore内部だけで明示的に使用する。

---

## 12. DesignIntent Adapter

最初のAdapterではDelaunayと同様に、V1の凍結済みDesignIntent content/profile mappingを再利用する。

```text
DesignIntent
   ├────────► roomCount / entity counts / warnings
   │
   └────────► BSP Core
                 ↓
          partitions + rooms + links
                 ↓
              Adapter
                 ↓
            DungeonSpec
```

これにより、Algorithm比較では主にtopology/spatial structureの差を見られる。

---

## 13. Delaunayとの違い

| 項目 | Delaunay + MST | BSP |
| --- | --- | --- |
| 空間の作り方 | Roomをscatter | 土地を先に分割 |
| 基本graph | 近傍graph → MST | partition tree |
| 見た目 | irregular | structured |
| Room overlap | 距離制約 | partitionで抑制 |
| 得意 | 洞窟以外の自然なRoom network | 施設・建物・地下区画 |
| routeChoice | non-MST loop | nearby extra link |

---

## 14. DLL / WASM境界

BSP Coreもplain-data input/outputのみ。

```text
JS Core
  │
  ├─ same DTO semantics → WASM
  ├─ same DTO semantics → Windows DLL
  ├─ same DTO semantics → Linux .so
  └─ same DTO semantics → macOS dylib
```

Application固有AdapterをNative側へ持ち込む必要はない。

---

## 15. Acceptance

専用gate:

```bash
npm run validate:dai-100-bsp
```

最終Product acceptanceは2026-09-27 JST、commit `9046a3a676e7988d74bc04196654e00091d0bb3c` でPASS。

確認済み:

- same Seed deterministic
- different Seed variation
- leaf count = Room count
- tree edge = N - 1
- graph connected
- Room overlapなし
- Roomがleaf内
- extraConnectionRatio bounded
- duplicate edgeなし
- invalid parameter fail-closed
- Adapterがvalid DungeonSpec
- DesignIntent content semantics維持
- directional corridor side hints deterministic
- 150/150 renderer routeability PASS
- 30 unique spatial layouts
- production build PASS
- Owner UI / 5言語 PASS
- V1 / V2 / Delaunay / BSP selector PASS
- BSP 3-floor Test / Mystery PASS
- syntax / git checks PASS

Performance evidence:

- original renderer matrix: `5,454,108 ms`
- final full-gate matrix: `229,665 ms`
- `crossing-fallback`: 86/150
- strict: 64/150
- repeated full-run worst observed case: `15,107 ms`

BSPは **functional + performance accepted**。残る10–15秒級のlong-tailと `crossing-fallback` 比率はnon-blockingなrenderer / visual-quality follow-upとして扱う。
