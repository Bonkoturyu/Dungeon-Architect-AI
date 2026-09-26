# Delaunay + MST + Loops

## 目的

Algorithm Lab の最初の独立生成Core。

この方式は、Roomを自然に散布し、Delaunay triangulationで近傍候補を作り、Minimum Spanning Tree (MST) で全Roomの接続性を保証したうえで、一部の非MST edgeをloopとして戻す。

```text
Room scatter
    ↓
Delaunay triangulation
    ↓
near-neighbor candidate graph
    ↓
Minimum Spanning Tree
    ↓
guaranteed connected tree
    ↓
restore bounded non-MST edges
    ↓
connected graph + loops
```

---

## 1. 分かりやすいイメージ

### Step 1 — Roomを散らす

```text
      A

 B          C

        D

 F             E
```

最初にRoom centerをSeedから決定する。

Dungeon Architect AI実装では、Roomが重ならないよう最低中心間距離を保証する。

---

### Step 2 — Delaunay triangulation

```text
      A
     / \
    B---C
     \ / \
      D---E
     /
    F
```

「どのRoom同士を接続候補にするか」を局所的に作る。

完全グラフのように全Roomを全Roomへつなぐ必要がない。

特徴:

- 近傍Room同士が候補になりやすい
- 2D平面上でedgeが過剰になりにくい
- MSTの候補graphとして使いやすい

---

## 2. MSTとは

Delaunay edgeをそのまま全部使うとCorridorが多すぎる。

そこで、全Roomをつなぎながら総edge長を抑えるMinimum Spanning Treeを作る。

```text
Delaunay candidate:

A---B
|\ /|
| X |
|/ \|
C---D

        ↓ MST

A---B
    |
    D
    |
    C
```

Room数を `N` とすると、MST edge数は必ず:

```text
N - 1
```

になる。

これにより、最低限の接続だけでも全Roomへ到達できる。

---

## 3. Loopを戻す

MSTだけではtreeなのでloopがない。

探索でshortcutやroute choiceを作るため、MSTで落としたDelaunay edgeの一部を戻す。

```text
MST:

A---B
    |
    D---E
    |
    C

      + loop

A---B
|   |
C---D---E
```

Dungeon Architect AIでは `loopRatio` を0～1で指定する。

現在のAdapterではDesignIntentの:

`routeChoice`

を `loopRatio` に対応させる。

---

## 4. CoreとAdapterの分離

```text
packages/generator-algorithms/delaunay-mst/
                   │
                   │ algorithm-native IR
                   ▼
packages/generator/src/strategies/delaunay-mst-lab.js
                   │
                   │ DungeonSpec
                   ▼
Editor / Renderer / Play / Simulator
```

### Core

Coreが知っているもの:

- Seed
- roomCount
- loopRatio
- Room size range
- minimum center distance
- Delaunay
- MST
- loop selection

Coreが知らないもの:

- DesignIntent
- DungeonSpec
- Three.js
- Editor
- Play
- AI provider
- DOM
- Cloudflare

### Adapter

AdapterだけがDungeon Architect AI固有処理を担当する。

現在の最初のAdapterでは、Entity/Event countとwarning semanticsを安定させるため、凍結済みV1のDesignIntent content/profile mappingを利用する。

つまり:

```text
DesignIntent
   ├─────────────► stable content/profile mapping
   │
   └─────────────► Delaunay Core
                       ↓
                 rooms + graph
                       ↓
                  Adapter merge
                       ↓
                  DungeonSpec
```

Core自体はV1/V2へ依存しない。

---

## 5. Core API

```js
import {
  generateDelaunayMstCore,
} from '@dungeon-architect/generator-delaunay-mst';

const result = generateDelaunayMstCore({
  seed: 123456789,
  roomCount: 10,
  loopRatio: 0.6,
});
```

主要input:

| Field | 意味 |
| --- | --- |
| `seed` | deterministic Seed |
| `roomCount` | Room数 |
| `loopRatio` | loop追加量 0～1 |
| `roomSizeMin` | 最小Room size |
| `roomSizeMax` | 最大Room size |
| `minCenterDistance` | Room center最低距離 |
| `scatterStep` | coordinate quantization |

---

## 6. Algorithm-native output

```js
{
  algorithm: 'delaunay-mst-loops',
  algorithmVersion: '1',
  seed,
  rooms,
  triangles,
  delaunayEdges,
  mstEdges,
  loopEdges,
  finalEdges,
  diagnostics
}
```

### rooms

Room centerとsize。

### triangles

Delaunay triangulationのtriangle。

### delaunayEdges

接続候補。

### mstEdges

Minimum Spanning Tree。

### loopEdges

追加されたloop。

### finalEdges

実際にDungeon graphとして使う:

```text
mstEdges + loopEdges
```

---

## 7. Determinism

同一:

- Algorithm Version
- Seed
- roomCount
- loopRatio
- options

なら同じ出力を返すことを要件にする。

Random sourceはCore内の明示PRNGだけ。

```text
Same Seed
   ↓
Same scatter
   ↓
Same Delaunay graph
   ↓
Same MST
   ↓
Same loop selection
```

---

## 8. Room overlap

Room centerを完全ランダムにするとRoom同士が重なる。

Coreではcandidate pointを生成した際、

```text
distance(candidate, every existing room)
    >= minCenterDistance
```

を要求する。

通常candidateが見つからない場合はdeterministic fallback placementを使用する。

最終的にもRoom rectangle同士のoverlapをCore invariantとして検査する。

---

## 9. Delaunay実装

現在のCoreは外部libraryを使わず、project-authoredなBowyer-Watson方式でtriangulationを構築する。

概念:

```text
super triangle
      ↓
insert point
      ↓
find triangles whose circumcircle contains point
      ↓
remove those triangles
      ↓
find polygon boundary
      ↓
connect boundary to inserted point
      ↓
repeat
      ↓
remove super-triangle vertices
```

これによりAlgorithm Core単体で利用でき、第三者runtime dependencyを増やさない。

---

## 10. MST実装

Kruskal方式。

```text
Delaunay edges
      ↓ sort by distance
shortest first
      ↓
Union-Find
      ↓
add edge only when it joins two different components
      ↓
N - 1 edges
```

同距離の場合はvertex indexでtie-breakし、deterministicにする。

---

## 11. Loop selection

MSTに採用されなかったDelaunay edgeをloop candidateにする。

```text
Delaunay edges
  - MST edges
      ↓
loop candidates
      ↓ seeded deterministic shuffle
      ↓
bounded prefix selected by loopRatio
```

loop capacityはRoom数に対して無制限に増やさず、現在は:

```text
min(
  non-MST candidate count,
  max(1, floor(roomCount / 3))
)
```

で上限を設定する。

---

## 12. Diagnostics

Coreは比較・説明用に以下を返す。

- roomCount
- triangleCount
- delaunayEdgeCount
- mstEdgeCount
- loopCandidateCount
- loopCapacity
- loopTarget
- loopEdgeCount
- cycleRank

これらはApplication runtimeの必須情報ではない。

将来Algorithm comparison画面やBenchmarkで使用できる。

---

## 13. DLL / WASM化

Coreはplain-data input/outputだけなので、将来Native版を作る場合も同じ意味論を維持できる。

```text
JS Core today
     │
     ├── same JSON contract ──► WASM
     │
     ├── same JSON contract ──► DLL
     │
     └── same JSON contract ──► .so / dylib
```

Native ABI例は `CORE_ARCHITECTURE.md` を参照。

---

## 14. Acceptance gate

Core段階では以下を確認する。

- same Seed byte-stable
- different Seed variation
- MST edge count = N - 1
- graph connected
- loopRatio=0でcycleなし
- loopRatio増加でbounded loop追加
- Room overlapなし
- Delaunay edge unique
- invalid parameter fail-closed
- Adapter出力がvalid DungeonSpec
- DesignIntent-driven MVP Entity/Event semantics維持

このCore gateが通るまではProduct selectorへ登録しない。

---

## 15. 次段階

Core acceptance後:

1. Algorithm Lab catalogへ登録
2. Product selectorへ表示
3. visible Chrome生成
4. Renderer routeability matrix
5. Mystery / Multi-floor
6. Simulator比較
7. V1 / V2 / Delaunay side-by-side benchmark

を進める。
