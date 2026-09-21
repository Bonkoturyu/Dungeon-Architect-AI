# Dungeon Generation Algorithms Research

調査日: **2026-09-21**

## 目的

Dungeon Architect AIで採用できるダンジョン生成方式を整理し、

- 現行方式が何をしているか
- 一般的な生成アルゴリズムにはどのような種類があるか
- 各方式の特徴、長所、制約
- 将来のGenerator Versionで何を変更候補にできるか

を継続的に判断できる資料として残す。

現行方式そのものの固定仕様は [GENERATOR_VERSIONS.md](../architecture/GENERATOR_VERSIONS.md) を参照。

---

# 1. 現行方式 — Generator Version 1

V1は **deterministic graph-first constructive generator**。

単一の有名アルゴリズムそのものではなく、Room Graph生成、固定grid layout、Seeded entity placement、orthogonal corridor routingを組み合わせた独自ハイブリッド。

処理概要:

```text
Prompt
  ↓
DesignIntent
  ↓
Generation Profile
  ↓
Backbone Room Graph
  ↓
Seeded Alternate Cycles
  ↓
Serpentine Grid Layout
  ↓
Start / Goal
  ↓
Enemy / Chest / Trap / Recovery
  ↓
DungeonSpec Validation
  ↓
Orthogonal Corridor Rendering
```

特性:

- Seedによる再現性が高い
- Start→Goalの到達性をbackboneで保証しやすい
- routeChoiceを独立パラメータとして扱える
- GraphとGeometryが分離されているのでSimulatorと相性が良い
- 一方でRoom座標は同一roomCountならほぼ固定
- fresh SeedでもRoom全体の見た目が大きく変わりにくい
- dead-endや大規模branch、自然なRoom散布はV1では主目的ではない

特にMysteryについて、V1はfresh Seedでalternate routeやEntity placementは変化するが、serpentine Room layoutは変化しない。そのため「新しい未知のダンジョン」としての視覚差が弱い場合がある。これは将来Versionで改善候補。

---

# 2. 主なダンジョン生成アルゴリズム

## 2.1 BSP — Binary Space Partitioning

### 概要

矩形領域を縦または横に再帰分割し、最終leaf領域内へRoomを配置し、sibling領域同士をCorridorで接続する方式。

RogueBasinの基本例では、

1. 大きな矩形を水平/垂直に分割
2. 子領域をさらに再帰分割
3. leafごとにRoomを配置
4. sibling同士をCorridorで接続
5. 親階層へ戻りながら全体を接続

という構成。

### 特徴

長所:

- Room同士のoverlapを避けやすい
- 空間を無駄なく分配しやすい
- Room+Corridor型の「典型的なダンジョン」を作りやすい
- 生成時間が比較的読みやすい

制約:

- BSPらしい四角い区画感が出やすい
- topologyとgameplay意味付けを別途設計する必要がある
- 分割ルールが単純だと似た形になりやすい

Dungeon Architect AIとの関係:

- V2以降のspatial layout候補
- 現行のGraph-first topologyを維持しつつ、graph nodeをBSP leafへ割り当てるhybridも可能

Source:
https://roguebasin.com/index.php/Basic_BSP_Dungeon_generation

---

## 2.2 Random Walk / Drunkard's Walk

### 概要

wallで埋めたgrid上でwalkerをランダム方向へ移動させ、通過セルをfloorへ変える。

単一walkerで掘り続ければ、掘ったfloorはwalkerの軌跡で連結されるため、基本形では接続性を得やすい。

### 特徴

長所:

- 実装が非常に単純
- 有機的で不規則な洞窟/通路になりやすい
- variationが大きい
- Seedとの相性が良い

制約:

- Roomという高水準構造を直接持たない
- 面積・分岐・到達距離の制御が弱い
- 端へ偏る、局所的に密になるなど品質差が出やすい

Dungeon Architect AIとの関係:

- Cave floor生成やRoom内部形状には使いやすい
- 現行の「Room GraphをSimulatorでも使う」思想の全面置換より、Room内部またはFloor theme向けhybridが適する

Source:
https://roguebasin.com/index.php/Random_Walk_Cave_Generation

---

## 2.3 Cellular Automata

### 概要

まずwall/floorをランダム初期化し、近傍セル数に基づくruleを複数iteration適用して形を平滑化する。

代表的なcave生成では、3×3近傍のwall数などを使ってwall/floorを更新する。

### 特徴

長所:

- 自然な洞窟形状を作りやすい
- 実装が比較的簡単
- parameterで密度や滑らかさを調整できる

制約:

- disconnected caveが発生しうる
- Start→Goal保証にはconnected-component処理、flood fill、追加接続などが必要
- Room graphやgameplay sequenceの直接制御には弱い

Dungeon Architect AIとの関係:

- Cave Floor/biome生成候補
- graph backboneを先に作り、各graph nodeやfloor geometryをCAで作るhybridが現実的

Sources:
https://roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels
https://www.roguebasin.com/index.php/An_Improved_Method_for_Generating_Connected_Cave_Maps_Based_on_Cellular_Automata

---

## 2.4 Maze Carving — Recursive Backtracking / Prim / Kruskal / Eller etc.

### 概要

grid cellをnodeとしてmaze passageを掘る系統。

代表例:

- Recursive Backtracking
- Randomized Prim
- Randomized Kruskal
- Eller
- Hunt-and-Kill
- Wilson
- Aldous-Broder
- Recursive Division

Recursive Backtrackingは未訪問neighborへ掘り進み、行き止まりでstackを戻ることでmazeを構築する。

Kruskal系はcell/componentをdisjoint setとして扱い、異なるcomponent間のwallを選んで接続し、全cellを1つのconnected componentへまとめる。

### 特徴

長所:

- 接続性を保証しやすい
- corridor主体の探索を作りやすい
- loopを後から追加する設計と相性が良い
- algorithmごとにmazeの「癖」が変わる

制約:

- そのままだと「RoomのあるDungeon」より「Maze」になりやすい
- Enemy/Reward/Goalなどgameplay semanticsは別レイヤーが必要

Dungeon Architect AIとの関係:

- floor内の細かい通路生成
- Room間をmaze領域で接続
- multi-floorの特定floor theme
などに利用可能。

Sources:
https://weblog.jamisbuck.org/2010/12/27/maze-generation-recursive-backtracking
https://weblog.jamisbuck.org/2011/1/12/maze-generation-recursive-division-algorithm

---

## 2.5 Rooms + Mazes Hybrid

### 概要

Bob Nystromの方式では、

1. non-overlapping roomsを配置
2. 残りのsolid領域をmazeで埋める
3. RoomとMaze regionをconnectorで接続
4. 必要に応じてextra connectionを追加
5. dead-endを削る

という複合方式を取る。

### 特徴

長所:

- Roomと複雑なCorridorの両方を得られる
- 完全なmazeよりgameplay場所を作りやすい
- extra connector量でloop性を調整できる
- 見た目のvariationが大きい

制約:

- tile-grid前提になりやすい
- Room graphを直接制御したい場合は変換層が必要
- 3D box roomを抽象DungeonSpecとして扱う現行構造とは少し表現レベルが異なる

Dungeon Architect AIとの関係:

- V1の固定serpentine layoutを置換する候補
- Graph-first topologyを残し、Room placementだけこの考え方を利用するhybridも可能

Source:
https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/

---

## 2.6 Room Scatter + Delaunay Triangulation + MST + Loop Reintroduction

### 概要

よく使われるroom-first graph構築方式の一つ。

典型的なpipeline:

1. Roomをランダムscatter
2. overlapをseparation / relaxation
3. Room centerをDelaunay triangulation
4. Delaunay edgeからMinimum Spanning Treeを作り全Room接続を保証
5. 未採用edgeの一部を戻してloop/shortcutを追加
6. Corridorを生成

### 特徴

長所:

- Room位置がSeedで大きく変わる
- MSTで接続性を確保しやすい
- loop率を独立parameter化しやすい
- 「Roomが自然に散らばったDungeon」になりやすい

制約:

- Geometry起点なので、厳密なgameplay sequence制御には追加レイヤーが必要
- Room separationとCorridor routingの品質設計が必要
- Delaunay/MST implementationが追加される

Dungeon Architect AIとの関係:

**V1のrouteChoice思想と非常に相性がよい候補。**

- backbone/critical path
- MST connectivity
- routeChoiceによるloop復元
- DesignIntent-based semantics

を組み合わせられる。

参考実装例:
https://github.com/majidmanzarpour/threejs-procedural-dungeon
https://github.com/sharpaccent/Procedural-Dungeon-Generator

学術的なDungeon PCG全体整理:
https://doi.org/10.1109/TCIAIG.2013.2290371

---

## 2.7 Graph Grammar / Gameplay Grammar

### 概要

geometryを先に作るのではなく、Room、door、challenge、reward、player actionなどをgraphとして生成し、そのgraphを後から空間へ埋め込む。

van der Linden / Lopes / Bidarraの研究では、designer-authored gameplay constraintsからgraph grammarを作り、player action graphを生成し、それをDungeon layout/contentへ変換する。

### 特徴

長所:

- 「敵→鍵→扉→報酬」のような意味のあるsequenceを生成しやすい
- difficulty、length、challenge構成などdesigner controlと相性が良い
- topologyとsemanticsを先に確定できる
- Simulatorで評価しやすい

制約:

- grammar rule設計の初期コストが大きい
- graph→geometry埋め込みが別問題になる
- rule増加に伴う整合性管理が必要

Dungeon Architect AIとの関係:

**DesignIntentとSimulatorを持つ本プロジェクトには特に相性が良い。**

将来Versionで、

```text
DesignIntent
→ Gameplay Graph
→ Room Graph
→ Spatial Layout
→ DungeonSpec
→ Simulation
```

という構造へ発展できる。

Sources:
https://ojs.aaai.org/index.php/AIIDE/article/view/12592
https://research.tudelft.nl/en/publications/procedural-generation-of-dungeons/
https://www.um.edu.mt/library/oar/handle/123456789/102205

---

## 2.8 Wave Function Collapse (WFC)

### 概要

input sampleまたはtile adjacency ruleから局所制約を作り、

1. 各cellに可能なpattern/tile集合を持たせる
2. entropyが低いcellを選択
3. 1つの状態へcollapse
4. 隣接制約をpropagate
5. 全cellが決定するまで繰り返す

というconstraint-based generation。

Original WFCは、inputに現れるlocal patternだけをoutputへ許すことで「局所的に似た」出力を生成する。

### 特徴

長所:

- tile/module adjacency制約から複雑な局所構造を作れる
- authored sample/styleを反映しやすい
- 2Dだけでなく3D module生成にも展開可能

制約:

- contradictionが起こりうる
- global Start→Goal structureやgameplay progressionはWFC単独では扱いづらい
- rule set / sample qualityへ強く依存する
- constraint propagationのデバッグが比較的難しい

Dungeon Architect AIとの関係:

- Dungeon全体topologyより、Room内部、装飾、3D module組み立てに向く
- Graph Grammar / MST等でglobal structureを先に決め、WFCをlocal geometry生成に使うhybridが候補

Source:
https://github.com/mxgmn/WaveFunctionCollapse

---

# 3. Constructive / Search-based / Hybridという別の分類

Dungeon PCG研究では、単純に「BSPかWFCか」という形だけでなく、生成プロセスの性質でも分類できる。

## Constructive

一回の手続きで生成する。

例:

- V1
- BSP
- Random Walk
- Cellular Automata
- Maze carving
- Rooms + Mazes
- Delaunay + MST

特徴:

- 高速
- 再現性を作りやすい
- 実装を理解しやすい
- ただし品質保証は生成規則そのものに依存する

## Search / Optimization based

候補を生成し、fitnessで評価し、より良い候補を探索する。

評価例:

- Start→Goal距離
- branching
- dead ends
- combat density
- damage expectation
- loot distribution
- clear rate
- simulation score
- DesignIntent fit

Dungeon Architect AIには既にSimulatorがあるため、将来は「Constructive Generatorで候補生成 → Simulatorで評価 → 最良候補採用」という拡張が可能。

## Hybrid

global topologyとlocal geometryに別方式を使う。

例:

```text
Graph Grammar
→ Delaunay/MST spatial layout
→ WFC room interior
→ Simulator evaluation
```

本プロジェクトでは、このlayer separationが最も拡張しやすい。

---

# 4. Dungeon Architect AIとの比較

| 方式 | Spatial variation | Start→Goal保証 | Gameplay意味付け | DesignIntent制御 | Simulator適性 | 主な用途 |
| --- | --- | --- | --- | --- | --- | --- |
| V1 graph + serpentine | 低 | 強い | 中 | 中 | 高 | 現行baseline |
| BSP | 中 | 接続方法次第 | 低～中 | 中 | 中 | Room配置 |
| Random Walk | 高 | 掘削領域は連結しやすい | 低 | 低 | 低～中 | Cave |
| Cellular Automata | 高 | 追加処理必要 | 低 | 低～中 | 低～中 | Cave |
| Maze carving | 中～高 | 強い | 低 | 中 | 中 | Corridor主体 |
| Rooms + Mazes | 高 | 強くできる | 中 | 中 | 中 | Roguelike floor |
| Scatter + Delaunay + MST | 高 | 強い | 中 | 高 | 高 | V2 spatial候補 |
| Graph / Gameplay Grammar | topology高 | 強く設計可能 | 高 | 非常に高い | 非常に高い | semantics重視 |
| WFC | local高 | global保証は別途必要 | local中 | 中～高 | 中 | Room内部/装飾 |
| Hybrid + Simulation | 高 | 高 | 高 | 高 | 非常に高い | 将来本命構成候補 |

---

# 5. 今後のVersion候補として検討するポイント

まだVersion 2の方式は決定しない。

ただしV1で現在確認できている課題から、次Versionでは以下を比較対象にする。

1. **SeedでRoom座標そのものが変化する**
2. Start→Goalのguaranteed pathは維持
3. routeChoiceによるcycle量の制御は維持
4. DesignIntentからRoom Count / branch / difficulty / rewardを制御
5. Mysteryが視覚的にも別Dungeonに見える
6. 5～10 Floor生成へ拡張可能
7. Simulatorで全Floorを評価可能
8. Generator処理時間を測定可能
9. 同一Seed + Versionで完全再現可能
10. V1を呼び出して過去比較可能

有力な比較対象:

- V1改良型: graph-first + randomized spatial embedding
- Scatter + Delaunay + MST + loops
- Gameplay Graph / Graph Grammar + spatial embedding
- Rooms + Mazes hybrid
- Global Graph + local WFC
- 上記をSimulation scoreで選ぶhybrid

---

# 6. 参考文献・調査元

## Survey / academic

- van der Linden, Lopes, Bidarra, **Procedural Generation of Dungeons**, IEEE Transactions on Computational Intelligence and AI in Games, 2014.  
  https://doi.org/10.1109/TCIAIG.2013.2290371
- van der Linden, Lopes, Bidarra, **Designing Procedurally Generated Levels**, AIIDE, 2013.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/12592
- Shaker, Liapis, Togelius, Lopes, Bidarra, **Constructive generation methods for dungeons and levels**, 2016.  
  https://www.um.edu.mt/library/oar/handle/123456789/102205

## Practical algorithms

- RogueBasin, **Basic BSP Dungeon generation**  
  https://roguebasin.com/index.php/Basic_BSP_Dungeon_generation
- RogueBasin, **Random Walk Cave Generation**  
  https://roguebasin.com/index.php/Random_Walk_Cave_Generation
- RogueBasin, **Cellular Automata Method for Generating Random Cave-Like Levels**  
  https://roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels
- Jamis Buck, **Maze Generation: Recursive Backtracking**  
  https://weblog.jamisbuck.org/2010/12/27/maze-generation-recursive-backtracking
- Bob Nystrom, **Rooms and Mazes: A Procedural Dungeon Generator**  
  https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/
- Maxim Gumin, **WaveFunctionCollapse**  
  https://github.com/mxgmn/WaveFunctionCollapse

## Delaunay / MST implementation references

- Three.js procedural dungeon example: scatter → separate → Delaunay → MST + loops  
  https://github.com/majidmanzarpour/threejs-procedural-dungeon
- Unity procedural dungeon example using Delaunay + spanning tree  
  https://github.com/sharpaccent/Procedural-Dungeon-Generator

---

# 7. 運用ルール

新しい生成方式を試す際は、既存Versionを上書きせず、必ず新Versionとして保存する。

各Version資料には最低限以下を残す。

- Version番号
- 実装場所
- 生成pipeline
- Seedの扱い
- topology algorithm
- spatial layout algorithm
- corridor algorithmとの境界
- Entity / Event配置方式
- DesignIntent mapping
- deterministic / reproducibility条件
- 既知制約
- 前Versionとの差分
- benchmark
- representative screenshots / JSON evidence
- 採用・不採用理由

これにより、将来アルゴリズムを変更しても「どの方式で何が生成されたか」を再現・比較できる。
