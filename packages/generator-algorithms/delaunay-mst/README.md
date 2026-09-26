# Delaunay + MST + Loops Generator Core

Algorithm Lab向けの独立生成Core。

```text
Seed
 ↓
Room centers scatter
 ↓
Delaunay triangulation
 ↓
Minimum Spanning Tree
 ↓
Selected non-MST edges restored as loops
 ↓
Algorithm-native IR
```

このpackage自体はDungeon Architect AIのUI、Renderer、Editor、Play、DesignIntent、DungeonSpecへ依存しない。

## Input

```js
generateDelaunayMstCore({
  seed: 123456789,
  roomCount: 10,
  loopRatio: 0.6,
})
```

## Output

主なfield:

- `rooms`
- `triangles`
- `delaunayEdges`
- `mstEdges`
- `loopEdges`
- `finalEdges`
- `diagnostics`

`finalEdges` は `spanning-tree` / `loop` のalgorithm-native kindを持つ。

Dungeon Architect AIへの変換はCore外のStrategy Adapterで行う。

## Reuse boundary

- no DOM
- no Three.js
- no network I/O
- no localStorage
- explicit deterministic Seed
- plain-data input/output
- no dependency on V1/V2 Generator

そのため将来的に、このCoreと同じcontractをRust/C++等で実装しWASM/DLLへ差し替えられる。
