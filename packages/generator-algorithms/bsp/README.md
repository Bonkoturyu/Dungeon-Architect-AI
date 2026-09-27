# BSP Generator Core

Algorithm Lab向けの独立 Binary Space Partitioning Core。

```text
Root bounds
 ↓
Binary partition tree
 ↓
Leaf regions
 ↓
One Room per leaf
 ↓
Sibling subtree links
 ↓
Optional bounded extra links
```

CoreはDungeon Architect AIのUI / Renderer / Editor / Play / provider / DungeonSpecへ依存しない。

## Input

```js
generateBspCore({
  seed: 123456789,
  roomCount: 10,
  extraConnectionRatio: 0.6,
})
```

## Output

- `rootBounds`
- `partitions`
- `leaves`
- `rooms`
- `treeEdges`
- `extraEdges`
- `finalEdges`
- `diagnostics`

Product側のDungeonSpec変換は別Strategy Adapterで行う。
