# Generator Core Architecture

## 1. 目的

Dungeon Architect AI では、生成方式そのものを比較・選択できるようにする。

そのため、Generatorを「アプリ本体の一部」として直接実装するのではなく、**交換可能なStrategy Core** として扱う。

目標:

- Version 1 / Version 2 / Algorithm Lab を同じ入口から選択できる
- 各アルゴリズムCoreを単独テストできる
- Renderer / Editor / Play / AI providerへ依存させない
- 同一Seedで再現可能にする
- provenanceを必ず残す
- 将来的にnpm package / WASM / DLL等へ切り出せる
- Dungeon Architect AI以外でも流用できる

---

## 2. レイヤ構成

```text
┌─────────────────────────────────────────────┐
│ Application                                 │
│ UI / Prompt / DesignIntent / Algorithm UI   │
└──────────────────────┬──────────────────────┘
                       │ JSON-compatible request
                       ▼
┌─────────────────────────────────────────────┐
│ Generator Strategy Registry                 │
│ strategyId -> isolated implementation       │
└───────┬───────────────┬───────────────┬─────┘
        │               │               │
        ▼               ▼               ▼
  V1 Classic       V2 Recommended      BSP Core
        │               │               │
        └───────────────┬───────────────┘
                        ▼
                 Generator Result
                 { spec, provenance,
                   diagnostics }
                        │
                        ▼
┌─────────────────────────────────────────────┐
│ DungeonSpec Validation                      │
└──────────────────────┬──────────────────────┘
                       ▼
┌─────────────────────────────────────────────┐
│ Editor / Renderer / Play / Simulator        │
└─────────────────────────────────────────────┘
```

重要なのは、下流が `strategyId` を知らなくても動くこと。

RendererはBSPかDelaunayかを意識しない。
Play CoreもRandom WalkかV2かを意識しない。

---

## 3. Strategy Core package

現在追加した境界:

`packages/generator-strategy-core/`

役割:

- Strategy contract
- request normalization
- result envelope
- provenance
- registry
- fail-closed selection

このpackageが**最小の再利用単位**。

依存してはいけないもの:

- DOM
- Three.js
- Editor state
- Play runtime
- OpenAI API
- Cloudflare
- Vite
- app-specific UI

Core packageの入出力はJSON互換データだけにする。

---

## 4. 共通Request

Conceptual shape:

```js
{
  apiVersion: "1.0",
  seed: 123456789,
  id: "generated-123456789",
  prompt: "exploration-heavy dungeon",
  intent: {
    exploration: 0.9,
    routeChoice: 0.7,
    combatDensity: 0.3,
    rewardDensity: 0.7,
    ...
  },
  constraints: {
    floorIndex: 0,
    roomCount: 10
  },
  options: {
    // algorithm-specific
  },
  context: {
    // optional bounded context
  }
}
```

### 共通項目

#### seed

必須。

同一:

- Strategy ID
- Algorithm Version
- Request
- Seed

なら、原則として同一出力を返す。

#### intent

DesignIntent。

AlgorithmがDesignIntentを直接利用しない場合でも、Adapter側でparameterへ変換してよい。

#### constraints

アプリ共通制約。

例:

- room count
- floor number
- maximum footprint
- required entities
- Start/Goal requirement

#### options

**アルゴリズム固有設定はここへ閉じ込める。**

例:

BSP:

```json
{
  "minLeafSize": 12,
  "splitBias": 0.5
}
```

Cellular Automata:

```json
{
  "initialWallRatio": 0.46,
  "iterations": 5
}
```

これにより共通APIをアルゴリズム固有parameterで汚染しない。

---

## 5. 共通Result

```js
{
  spec: DungeonSpec,
  provenance: {
    apiVersion: "1.0",
    strategyId: "version-2-spatial",
    strategyDisplayName: "Version 2 — Recommended",
    strategyFamily: "versioned",
    algorithmVersion: "2",
    seed: 123456789,
    implementation: "generator/versions/v2"
  },
  diagnostics: {
    profile: {...},
    // algorithm-specific evidence
  }
}
```

### spec

下流が利用する正式成果物。

Generator Strategyの最終責務は、原則として **validなDungeonSpecを返すこと**。

### provenance

再現・比較・提出証拠用。

最低限:

- strategyId
- algorithmVersion
- seed

を保持する。

### diagnostics

アプリ動作に必須ではない内部情報。

例:

- BSP partition tree
- Delaunay edge count
- MST edge count
- rejected candidate count
- CA iteration count
- WFC contradiction/retry count
- simulation score

RendererやPlayの動作をdiagnosticsへ依存させない。

---

## 6. Port / Adapter方式

各アルゴリズムを直接Application APIへ合わせるのではなく、CoreとAdapterを分ける。

```text
Algorithm Core
    │
    │ algorithm-native result
    ▼
Strategy Adapter
    │
    │ Generator Result
    ▼
Strategy Registry
```

例:

```text
DelaunayMstCore.generate()
        ↓
{
  rooms,
  graphEdges,
  mstEdges,
  loopEdges
}
        ↓
DelaunayMstStrategyAdapter
        ↓
DungeonSpec
```

利点:

- Algorithm Core単体を他プロジェクトへ持っていける
- DungeonSpecが変更されてもAdapterで吸収できる
- Unity向けAdapterを別に作れる
- benchmarkでCoreだけ比較できる

---

## 7. 推奨package構成

```text
packages/
├─ generator-strategy-core/
│  ├─ src/
│  │  ├─ index.js
│  │  └─ strategy-core.js
│  └─ test/
│
├─ generator/
│  └─ src/
│     ├─ strategy-catalog.js
│     ├─ strategies/
│     │  ├─ v1-classic.js
│     │  └─ v2-recommended.js
│     └─ versions/
│
└─ generator-algorithms/
   ├─ bsp/
   │  ├─ src/core.js
   │  ├─ src/adapter.js
   │  └─ test/
   ├─ delaunay-mst/
   ├─ rooms-mazes/
   ├─ random-walk/
   ├─ cellular-automata/
   ├─ maze/
   ├─ gameplay-graph/
   └─ wfc/
```

将来はalgorithm directoryをそのまま独立repository/packageへ移せる。

---

## 8. Algorithm Core内部の推奨責務

Coreは可能な限り以下だけを行う。

```text
normalize algorithm options
        ↓
create deterministic PRNG
        ↓
generate algorithm-native structure
        ↓
validate algorithm invariants
        ↓
return plain-data result
```

Core内で行わない:

- HTML表示
- Three.js object生成
- Editor command発行
- fetch
- localStorage
- cloud provider呼び出し
- browser判定
- logging UI

---

## 9. Rendererとの境界

既存設計と同じく、GeneratorとRenderer routingを分離する。

Generatorが決めるもの:

- Room / region
- topology
- logical connection
- semantic role
- entity/event placement

Rendererが決めるもの:

- actual mesh
- material
- orthogonal corridor geometry
- visual effects
- camera

ただしAlgorithmによってはtile/cell mapを出す場合がある。

その場合:

```text
Cell Algorithm Core
      ↓
Cell/Tiles IR
      ↓
DungeonSpec Adapter
      ↓
DungeonSpec
```

とし、RendererにAlgorithm固有gridを直接渡さない。

---

## 10. Algorithm-native IR

すべてのAlgorithm Coreが最初からDungeonSpecを直接生成する必要はない。

むしろ、自然な中間表現を許可する。

例:

### BSP

```js
{
  bounds,
  partitions,
  leafRooms,
  links
}
```

### Delaunay + MST

```js
{
  points,
  delaunayEdges,
  mstEdges,
  loopEdges
}
```

### Cellular Automata

```js
{
  width,
  height,
  cells
}
```

### Gameplay Graph

```js
{
  nodes: [
    { role: "start" },
    { role: "combat" },
    { role: "reward" },
    { role: "goal" }
  ],
  edges: [...]
}
```

AdapterがこれをDungeonSpecへ変換する。

---

## 11. DLL / shared library化を見据えた境界

現在はJavaScript ES Moduleとして実装する。

ただし、外部言語から利用する場合に困らないよう、contractを**JSON message boundary**として設計する。

Conceptual C ABI:

```c
const char* dai_generator_metadata_json(void);

int dai_generate_json(
    const char* request_utf8,
    char** result_utf8
);

void dai_free_string(char* ptr);
```

Windows:

`generator_bsp.dll`

Linux:

`libgenerator_bsp.so`

macOS:

`libgenerator_bsp.dylib`

Unity C#側:

```csharp
[DllImport("generator_bsp")]
static extern int dai_generate_json(
    string requestJson,
    out IntPtr resultJson
);
```

重要なのは、Native化してもrequest/result schemaを変えないこと。

### DLL化しやすくする条件

- global mutable stateを避ける
- deterministic seedを明示入力
- file I/OをCore内部で行わない
- network I/OをCore内部で行わない
- allocator ownershipを明確にする
- UTF-8 JSON DTOに限定
- random sourceをOS乱数へ暗黙依存させない
- algorithm versionをmetadataで公開

---

## 12. WASM化

Random Walk / CA / Maze / WFCなどは、将来的にRust/C++へ移植してWASM化することも可能。

```text
JavaScript UI
    ↓ JSON / typed buffer
WASM Algorithm Core
    ↓
Algorithm-native IR
    ↓
JS Adapter
    ↓
DungeonSpec
```

ブラウザ向けではDLLよりWASMの方が直接使いやすい。

したがって「DLL化できる設計」は、実際には:

**Pure Core + stable DTO + explicit ownership**

を意味する。

---

## 13. Strategy Registry

Applicationは具体classを直接newしない。

```js
const registry = createBuiltinGeneratorStrategyRegistry();

const result = await registry.generate(
  selectedStrategyId,
  request
);
```

UIが知るのは:

- ID
- display name
- capabilities
- description

だけ。

これによりAlgorithm追加時の変更点をcomposition rootへ限定できる。

---

## 14. Recommendedの扱い

`Recommended` はVersion番号そのものではない。

現時点:

```text
Recommended
    ↓
version-2-spatial
```

将来:

```text
Recommended
    ↓
version-3-gameplay-graph
```

として切り替え可能にする。

Versionは再現性のため固定。
Recommendedは製品上のalias。

---

## 15. Algorithm Labの扱い

UIイメージ:

```text
Generator
  ○ Recommended
  ○ Version 1 Classic
  ● Algorithm Lab

Algorithm
  [ Delaunay + MST + Loops ▼ ]

Seed
  [ 123456789 ]

Advanced
  Loop Ratio       [ 0.30 ]
  Scatter Radius   [ 24   ]
```

Algorithm固有parameterはcapability/metadataからUI生成できる形へ将来拡張する。

CoreそのものはUI metadataがなくても動作できる。

---

## 16. Versioning

3種類のVersionを混同しない。

### Strategy API Version

例: `1.0`

request/result contractのversion。

### Generator Version

例: `1`, `2`

Dungeon Architect AIのVersioned generator。

### Algorithm Version

例:

```text
bsp@1
delaunay-mst@1
wfc@1
```

個別Coreの再現性を管理。

---

## 17. Testing pyramid

各Algorithmの受入順:

```text
Core unit tests
      ↓
determinism tests
      ↓
algorithm invariant tests
      ↓
Adapter → DungeonSpec validation
      ↓
Renderer routeability
      ↓
Play / Simulator
      ↓
visible browser smoke
```

最低限確認するもの:

- same Seed = same result
- different Seedでvariationが発生
- invalid parameter fail closed
- Start→Goal可否
- Room overlap
- duplicate edge
- orphan entity
- invalid event reference
- algorithm provenance
- excessive execution time

---

## 18. Benchmark

共通benchmark request setを作る。

例:

- roomCount: 5 / 8 / 12 / 20
- routeChoice: 0 / .25 / .5 / .75 / 1
- fixed Seed set
- DesignIntent presets

比較:

- generation ms
- room count
- edge count
- cycle rank
- branch count
- dead-end count
- Start→Goal moves
- bounding area
- overlap
- renderer routing success
- simulation clear rate
- DesignIntent fit

これで「見た目」だけでなくAlgorithm特性を定量比較できる。

---

## 19. 現在の実装

初期基盤として:

- `packages/generator-strategy-core`
- `packages/generator/src/strategies/v1-classic.js`
- `packages/generator/src/strategies/v2-recommended.js`
- `packages/generator/src/strategy-catalog.js`

を追加。

この段階ではApplication UIの既存生成pathを切り替えていない。

つまり**現在の動作を壊さず、Algorithm selector導入前に交換可能Core境界を先に固定する**。

---

## 20. 次の実装順

1. Strategy Core contractのローカルテスト
2. V1/V2 adapter equivalence確認
3. Generator selector UI
4. Delaunay + MST Core
5. BSP Core
6. Rooms + Mazes Core
7. Gameplay Graph Core
8. Cave algorithms
9. WFC
10. Algorithm comparison / benchmark UI

この順にすることで、各Coreを独立したlibraryとして積み上げられる。
