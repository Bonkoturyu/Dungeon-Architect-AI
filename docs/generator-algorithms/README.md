# Dungeon Generation Strategy Guide

このディレクトリは、Dungeon Architect AI のダンジョン生成方式を **選択可能・比較可能・再利用可能** にするための資料セット。

目的は「どのアルゴリズムが有名か」を並べることではなく、同じ Prompt / DesignIntent / Seed から異なる生成Coreを差し替え、同じ `DungeonSpec` 契約へ収束させること。

## 生成方式の3分類

### 1. Version 1 — Classic

凍結済みの基準方式。

```text
Prompt / DesignIntent
        ↓
sequential backbone
        ↓
seeded alternate edges
        ↓
fixed serpentine grid
        ↓
entities / event
        ↓
DungeonSpec
```

特徴:

- 再現性と回帰比較に強い
- Start → Goal 到達性を保証しやすい
- 同じ roomCount では空間配置が似る
- 比較基準として今後も残す

### 2. Version 2 — Recommended

現時点の推奨方式。

V1 の gameplay/topology semantics を維持しつつ、Seed により:

- columns
- spacing
- rotation / mirror
- serpentine direction
- room width / depth

を変化させる。

```text
V1 topology
   ↓
seed-driven spatial profile
   ↓
variable room geometry
   ↓
DungeonSpec
```

V1より見た目の多様性は高いが、主経路の考え方自体はV1を継承している。

### 3. Algorithm Lab

個別の生成アルゴリズムを明示的に選択する領域。

候補:

- BSP
- Rooms + Mazes
- Scatter + Delaunay + MST + Loops
- Random Walk
- Cellular Automata
- Maze Carving
- Gameplay Graph / Graph Grammar
- Wave Function Collapse
- Hybrid + Simulation Selection

Algorithm Lab の各Coreは、UI / Renderer / AI provider から独立したライブラリとして実装する。

---

## 共通処理モデル

```text
Prompt
  ↓
DesignIntent
  ↓
GeneratorStrategy
  ├─ Version 1 Classic
  ├─ Version 2 Recommended
  ├─ BSP
  ├─ Delaunay + MST
  ├─ Rooms + Mazes
  ├─ ...
  ↓
DungeonSpec
  ↓
Validation
  ↓
Renderer / Editor / Play / Simulator
```

GeneratorStrategy を差し替えても、下流の Editor / Play / Renderer / Simulator は同じ `DungeonSpec` を扱う。

## Source architecture

新しい疎結合境界:

```text
packages/generator-strategy-core/
    ↑ 依存してよい
    │
algorithm core / adapter
    │
    ↓ 登録
packages/generator/src/strategy-catalog.js
    │
    ↓
application / selector UI
```

`generator-strategy-core` は特定アルゴリズム、Three.js、Editor、Play、OpenAI APIに依存しない。

現在はES Moduleの独立packageだが、入出力をJSON互換DTOに限定しているため、将来は:

- npm package
- Web Worker
- WASM
- C ABI wrapper
- Windows DLL
- Linux .so
- macOS dylib
- Unity C# bridge

へ切り出せる構成を前提にする。

詳細は [CORE_ARCHITECTURE.md](./CORE_ARCHITECTURE.md)。

## 実装状況

| Strategy | 状態 | 用途 |
| --- | --- | --- |
| Version 1 Classic | 実装済 / Frozen | 回帰・比較・再現 |
| Version 2 Recommended | 実装済 / Accepted candidate | 現行推奨 |
| BSP | Core + Adapter実装中 / Product未登録 | Algorithm Lab / 2番目の独立Core |
| Delaunay + MST + Loops | Product accepted | Algorithm Lab / 最初の独立Core |
| Rooms + Mazes | 設計対象 | Algorithm Lab |
| Random Walk | 設計対象 | Cave系 |
| Cellular Automata | 設計対象 | Cave系 |
| Maze Carving | 設計対象 | Corridor主体 |
| Gameplay Graph | 設計対象 | DesignIntent重視 |
| WFC | 設計対象 | local geometry / module |
| Hybrid + Simulation | 将来候補 | Best-of-N / 最適化 |

## 資料

- [ALGORITHM_GUIDE.md](./ALGORITHM_GUIDE.md) — 各方式の詳細説明と簡易図解
- [CORE_ARCHITECTURE.md](./CORE_ARCHITECTURE.md) — 疎結合Core / Strategy契約 / DLL化を見据えた構成
- [DELAUNAY_MST.md](./DELAUNAY_MST.md) — Delaunay + MST + Loops の詳細・実装構成
- [BSP.md](./BSP.md) — Binary Space Partitioning の詳細・実装構成
- [README.html](./README.html) — ブラウザで見やすい総合入口
- [ALGORITHM_GUIDE.html](./ALGORITHM_GUIDE.html) — 図解付きHTML版
- [CORE_ARCHITECTURE.html](./CORE_ARCHITECTURE.html) — アーキテクチャHTML版

既存の調査原典:

- [Dungeon Generation Algorithms Research](../research/DUNGEON_GENERATION_ALGORITHMS.md)
- [Dungeon Generator Versioning](../architecture/GENERATOR_VERSIONS.md)

## 運用ルール

1. Versioned generatorは過去Versionを書き換えない。
2. Algorithm LabのCoreは独立libraryとして扱う。
3. Algorithm CoreからDOM、Three.js、Editor state、network APIを参照しない。
4. 同じ request + same algorithm version + same Seed は再現可能にする。
5. 各結果へstrategy / algorithm version / Seedのprovenanceを付与する。
6. Algorithm固有設定は `options` に閉じ込め、共通契約を壊さない。
7. Renderer向け形状とGenerator topologyを必要以上に結合しない。
8. 新Algorithmは単体テスト → DungeonSpec validation → renderer routeability → browser smoke の順で受入する。
