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

- `delaunay-mst/` — implementation in progress; independent Core + app Adapter
- `bsp/`
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
