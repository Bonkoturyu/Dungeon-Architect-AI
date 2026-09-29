# Generator Algorithm Cores

このディレクトリは Algorithm Lab 用の独立生成Coreを置く予定地。

各Algorithmは、可能な限り単独packageとして成立する構造にする。

推奨構成:

```text
<algorithm>/
├─ package.json
├─ src/
│  ├─ core.js          # algorithm-native generation only
│  ├─ model.js         # algorithm-native IR / DTO
│  ├─ prng.js          # 必要ならalgorithm-local deterministic RNG
│  ├─ validate.js      # algorithm invariants
│  ├─ adapter.js       # DungeonSpec / Strategy adapter
│  └─ index.js
└─ test/
   ├─ determinism.test.js
   ├─ invariants.test.js
   └─ adapter.test.js
```

## Core rules

Algorithm Coreは以下へ依存しない。

- DOM
- Three.js
- Editor
- Play Core
- OpenAI / provider API
- Cloudflare / hosting
- localStorage
- network I/O

入力と出力はJSON互換plain dataを基本とする。

## Adapter rules

Dungeon Architect AI固有の `DungeonSpec` 変換はAdapterへ閉じ込める。

```text
Algorithm Core
  ↓
Algorithm-native IR
  ↓
Adapter
  ↓
Generator Strategy Result
  ↓
DungeonSpec
```

## Packages

- `delaunay-mst/` — Product accepted; independent Core + app Adapter
- `bsp/` — Core + app Adapter implementation in progress
- `rooms-mazes/`
- `gameplay-graph/`
- `maze/`
- `random-walk/`
- `cellular-automata/`
- `wfc/`

共通Strategy contract:

`packages/generator-strategy-core/`

設計資料:

`docs/generator-algorithms/CORE_ARCHITECTURE.md`


## Random Walk

`random-walk/` contains the reusable seeded Random Walk Core used by `algorithm-lab.random-walk`.

The Core discovers coarse-grid cells through a seeded cardinal walker, keeps first-discovery edges as a guaranteed spanning tree, and restores a bounded subset of unused local adjacencies as loops. It has no DungeonSpec, DOM, Three.js, Editor, Play, or network dependency.


## Cellular Automata

`cellular-automata/` contains the reusable seeded cave-mask Core used by `algorithm-lab.cellular-automata`.

It randomizes and smooths an interior occupancy grid, keeps the largest cardinal component, deterministically repairs connected capacity when required, selects a connected Room subset, and adds bounded local loops. It has no DungeonSpec, DOM, Three.js, Editor, Play, or network dependency.


## Maze Carving

`maze-carving/` contains the reusable randomized-Kruskal maze Core used by `algorithm-lab.maze-carving`.

The Core builds a compact exact-N lattice, treats all cardinal adjacencies as walls, carves an N−1 perfect-maze tree through seeded disjoint-set union, and optionally restores unused walls as loops. It has no DungeonSpec, DOM, Three.js, Editor, Play, or network dependency.
