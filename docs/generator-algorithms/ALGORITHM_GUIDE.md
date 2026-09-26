# Dungeon Generation Algorithm Guide

この資料は、Dungeon Architect AIで選択可能にする生成方式を、**実装者にも審査員にも分かる形**で説明するためのガイド。

既存の調査資料 `docs/research/DUNGEON_GENERATION_ALGORITHMS.md` を実装・比較向けに再編したもの。

---

# 1. Version 1 — Classic

## 一言でいうと

**StartからGoalまで必ずつながる主経路を先に作り、少しだけショートカットを追加する方式。**

## 簡単な図

```text
Start ─ 02 ─ 03 ─ 04 ─ 05 ─ Goal
          ╲________╱
          alternate route
```

空間配置は固定serpentine grid。

```text
01 02 03 04
08 07 06 05
09 10 11 12
```

## 処理

1. `room-001 ... room-N` を作る
2. 順番通りにbackbone edgeを張る
3. `routeChoice` に応じて2～4 Room先へのalternate edgeを追加
4. 固定4-column serpentine gridへ配置
5. Start / Goalを端点へ置く
6. SeedでEnemy / Treasure / Trap / Recoveryを配置
7. 最初のTreasureへhint eventを追加
8. DungeonSpec validation

## できやすいダンジョン

- 読みやすい
- 到達性が安定
- 比較的linear
- 少数のloop/shortcutを持つ
- 同じRoom数だと似た形に見える

## 強み

- 完全再現しやすい
- 構造が単純でデバッグしやすい
- routeChoiceの意味が明確
- regression baselineに向く

## 弱み

- topology variationが小さい
- branch/dead-endの表現が弱い
- fresh Seedでも見た目が似る
- 「探索型」「洞窟型」など大きな構造差を出しにくい

## Dungeon Architect AIでの役割

**Classic / Frozen baseline。**

今後も削除せず、比較・再現・回帰用に残す。

---

# 2. Version 2 — Recommended

## 一言でいうと

**V1の安全な構造を残しながら、Seedごとに部屋の並び方とサイズを変える方式。**

## 簡単な図

V1:

```text
01 02 03 04
08 07 06 05
```

V2の例:

```text
      01
      │
      02
      │
04 ─ 03
│
05
```

別Seed:

```text
05 ─ 04 ─ 03
          │
          02
          │
          01
```

## V1から変えた部分

Seedにより:

- columns
- spacing
- rotation / mirror
- first row direction
- Room width
- Room depth

を決定。

## 変えていない部分

- DesignIntent → generation profile
- sequential backbone
- alternate edge selection
- Entity count
- Entity placement rule
- first Treasure event

## できやすいダンジョン

V1より視覚的にはかなり変わるが、**graph topology自体はV1系**。

## 強み

- V1互換の安全性
- spatial variation
- Mysteryで別Dungeon感が増える
- Rendererとの相性を検証済み

## 弱み

- 大規模branch/dead-endはまだ弱い
- gameplay topologyの個性はV1を継承
- 「BSPらしい」「洞窟らしい」などAlgorithm固有の性格は持たない

## Dungeon Architect AIでの役割

**Current Recommended。**

ただしRecommendedはaliasとして扱い、将来より良いVersionへ差し替え可能にする。

---

# 3. BSP — Binary Space Partitioning

## 一言でいうと

**大きな土地を何度も二分して、その区画にRoomを置く方式。**

## 簡単な図

```text
最初
+-----------------------+
|                       |
|                       |
+-----------------------+

分割
+-----------+-----------+
|           |           |
|           |           |
+-----------+-----------+

さらに分割
+-----+-----+-----------+
|     |     |           |
+-----+-----+-----+-----+
|           |     |     |
+-----------+-----+-----+

各区画にRoom
+-----+-----+-----------+
| [A] | [B] |    [C]    |
+-----+-----+-----+-----+
|    [D]    | [E] | [F] |
+-----------+-----+-----+
```

## 処理

1. 全体boundsを用意
2. 横または縦に分割
3. 子領域を再帰分割
4. leaf領域にRoomを置く
5. sibling subtree同士をCorridorで接続
6. 必要ならextra connectionを追加

## 主要parameter

- minimum leaf size
- maximum depth
- horizontal / vertical split bias
- Room margin
- Room size range
- extra connection ratio

## できやすいダンジョン

- 整理された区画
- 建築物・地下施設のような形
- Room同士のoverlapが少ない
- 四角い構造

## 強み

- 空間利用効率が良い
- overlap管理が容易
- Room+Corridor型と相性が良い
- deterministic化しやすい

## 弱み

- 四角い区画感が強い
- topologyの意味付けは別途必要
- parameterが単純だと似た形になりやすい

## Dungeon Architect AIへの統合

BSP Coreは:

```text
Bounds
↓
Partition Tree
↓
Leaf Rooms
↓
Logical Links
```

まで担当。

AdapterがLeaf RoomとLinkをDungeonSpecへ変換する。

## DesignIntentとの対応例

- exploration ↑ → leaf count / optional links ↑
- routeChoice ↑ → extra connection ↑
- targetDuration ↑ → partition depth / room count ↑

---

# 4. Scatter + Delaunay + MST + Loops

## 一言でいうと

**Roomを自然にばらまき、「近いRoom同士の候補線」から、全体をつなぐ最小構造と必要なloopを作る方式。**

## 簡単な図

Roomを散布:

```text
      A

  B       C

       D       E

  F
```

Delaunay候補:

```text
      A
     / \
    B---C
     \ / \
      D---E
     /
    F
```

MSTで最低限つなぐ:

```text
      A
      |
      B---C
          |
          D---E
          |
          F
```

一部edgeを戻してloop:

```text
      A
     /|
    B-C
      |
      D---E
      |
      F
```

## 処理

1. Room center候補をSeedでscatter
2. Room overlapをseparation / relaxation
3. centerからDelaunay triangulation
4. edge weighted graphを作る
5. MSTで全Room接続
6. 未採用edgeの一部をloopとして戻す
7. Start / Goalを選ぶ
8. Corridorを接続
9. gameplay semanticsを割り当てる

## 主要parameter

- scatter radius
- Room size range
- separation iterations
- edge weight rule
- loop ratio
- Start/Goal distance preference

## できやすいダンジョン

- 自然に散らばったRoom
- irregularな探索構造
- shortcutやloop
- Seed差が大きい

## 強み

- spatial variationが大きい
- MSTで接続性を保証しやすい
- loop率を独立調整できる
- V1/V2のrouteChoice思想と相性が良い

## 弱み

- gameplay sequenceを直接保証しにくい
- separationが不安定だと品質差が出る
- corridor routingとの組み合わせ検証が重要

## Dungeon Architect AIでの位置づけ

**Algorithm Labで最初に実装する有力候補。**

理由:

- DungeonSpecのRoom/Corridor modelへ自然に変換できる
- spatial差が一目で分かる
- routeChoiceへ対応しやすい
- Renderer routeabilityを共通gateで検証できる

---

# 5. Rooms + Mazes

## 一言でいうと

**大きなRoomを置いた残りの隙間をMazeで埋め、最後に全部つなぐ方式。**

## 簡単な図

```text
+----------------------+
| [Room]  ─┐ ┌─┐      |
|          │ │ └──┐   |
| ┌───┐    │ └─┐  │   |
| │   └────┘   │[Room]|
| └────────────┘      |
+----------------------+
```

## 処理

1. non-overlapping Room配置
2. 空き領域へmaze carving
3. Room region / Maze region間のconnector候補検出
4. region同士を接続
5. extra connectorを一部残す
6. dead-endを必要に応じて削除

## 主要parameter

- Room attempt count
- Room size range
- maze algorithm
- extra connector chance
- dead-end pruning ratio

## できやすいダンジョン

- Roomと複雑な通路の混合
- 探索密度が高い
- corridorの存在感が強い
- classic roguelike感

## 強み

- 探索が面白くなりやすい
- RoomとMazeを両立
- loop量も調整可能
- 見た目のvariationが大きい

## 弱み

- tile-grid表現が自然
- 現在のbox RoomベースDungeonSpecへのAdapterが必要
- corridor cellをどうlogical Room/Corridorへ集約するか設計が必要

## Dungeon Architect AIへの統合

Algorithm Coreはcell/region IRを返し、Adapterで:

```text
Region
→ Room
Connector path
→ Corridor
```

へ変換する。

---

# 6. Random Walk / Drunkard's Walk

## 一言でいうと

**酔っ払いが歩いた跡を床にしていくような方式。**

## 簡単な図

```text
Start
  ↓
  ↓ → → ↓
        ← ↓
        ← ← →
```

歩いたセルをfloorへする。

## 処理

1. wall grid初期化
2. walker開始位置を決定
3. Seed PRNGで方向を選ぶ
4. 移動先をfloor化
5. target floor ratioまで繰り返す

## できやすいダンジョン

- organic
- irregular
- narrow / wide領域が混ざる
- cave-like

## 強み

- 実装が簡単
- variationが高い
- 生成領域が自然に連結しやすい
- cave表現に向く

## 弱み

- Room conceptが弱い
- exact branch数の制御が難しい
- Start/Goal距離やreward structureの高水準制御が弱い

## Dungeon Architect AIへの統合

全面topologyより、**Cave floor generator**として扱う方が自然。

Cell region extractionでRoom/Regionへ変換してDungeonSpecへ接続する。

---

# 7. Cellular Automata

## 一言でいうと

**最初に作ったノイズを、近所の壁の数を見ながら何度もならして洞窟にする方式。**

## 簡単な図

初期:

```text
##.#..#
.#..###
###....
..##.#.
```

数回平滑化:

```text
####...
###....
##.....
...###.
```

## 処理

1. cellを確率でwall/floor初期化
2. 各cellの近傍wall数を数える
3. ruleで次状態を決める
4. 数iteration繰り返す
5. connected component解析
6. disconnected regionを除去または接続
7. Start/Goalを配置

## 主要parameter

- initial wall ratio
- birth/survival threshold
- iteration count
- minimum region size
- connectivity repair

## できやすいダンジョン

- 洞窟
- irregular chamber
- narrow neck
- natural terrain

## 強み

- caveらしい
- parameterで密度を変えやすい
- visual identityが強い

## 弱み

- disconnected regionが発生しやすい
- global gameplay controlが弱い
- DungeonSpecへのregion extractionが必要

## Dungeon Architect AIへの統合

Random Walkと同様、tile/cell IRからRegion Graphを作るAdapterが重要。

---

# 8. Maze Carving

## 一言でいうと

**全セルを迷路として必ずつなぐ方式。**

代表:

- Recursive Backtracking
- Prim
- Kruskal
- Eller
- Hunt-and-Kill
- Wilson

## 簡単な図

```text
+---+---+---+
| S |       |
+   +---+   +
|       |   |
+---+   +   +
|       | G |
+---+---+---+
```

## 特徴

Algorithmにより癖が違う。

### Recursive Backtracking

- 長いcorridorができやすい
- depth-first的

### Prim

- branchが多くなりやすい

### Kruskal

- regionを統合していく
- spanning treeとして理解しやすい

## 強み

- connectivity保証が強い
- algorithm比較が分かりやすい
- corridor主体の探索に向く

## 弱み

- Room主体のDungeonとは違う
- perfect mazeはloopがない
- gameplay semanticsは別レイヤー

## Dungeon Architect AIへの統合

Algorithm Lab内でMaze subtypeまで選べる構成にできる。

```text
Maze
├─ Recursive Backtracking
├─ Prim
└─ Kruskal
```

---

# 9. Gameplay Graph / Graph Grammar

## 一言でいうと

**地形より先に「プレイヤーにどんな順番で体験させるか」を設計する方式。**

## 簡単な図

```text
Start
  │
  ▼
Combat
  │
  ├──────► Risky Reward
  │          │
  │◄─────────┘
  ▼
Puzzle / Gate
  │
  ▼
Boss
  │
  ▼
Goal
```

## 処理

1. DesignIntentを高水準ruleへ変換
2. gameplay node生成
3. grammar/ruleでgraph展開
4. constraint validation
5. Room Graphへ変換
6. spatial embedding
7. Entity/Event割当

## できやすいダンジョン

- 意味のあるbranch
- reward detour
- challenge progression
- intended pacing
- intentional backtracking

## 強み

- Prompt / DesignIntentとの相性が非常に良い
- gameplay意味付けが強い
- Simulatorで評価しやすい
- topologyを高水準制御できる

## 弱み

- rule設計が複雑
- geometry embeddingは別問題
- grammar増加に伴いvalidationが重要

## Dungeon Architect AIでの位置づけ

**将来のRecommended候補として最も重要。**

理由:

Dungeon Architect AIは既に:

- DesignIntent
- DungeonSpec
- Simulator
- AI prompt

を持つ。

そのため:

```text
Prompt
→ DesignIntent
→ Gameplay Graph
→ Spatial Strategy
→ DungeonSpec
→ Simulation
```

という構造へ自然に進化できる。

---

# 10. Wave Function Collapse — WFC

## 一言でいうと

**隣り合ってよい部品のルールを守りながら、候補を少しずつ確定する方式。**

## 簡単な図

最初:

```text
[ABC][ABC][ABC]
[ABC][ A ][ABC]
[ABC][ABC][ABC]
```

中央がAなら周囲の候補を制約:

```text
[AB ][ B ][BC ]
[AB ][ A ][BC ]
[AB ][ B ][BC ]
```

さらにcollapseしていく。

## 処理

1. cellごとに可能tile集合を設定
2. entropyの低いcellを選択
3. 1候補へcollapse
4. adjacency ruleを伝播
5. contradictionならretry/backtrack
6. 全cell確定まで繰り返す

## できやすいもの

- authored styleを保ったlocal structure
- modular room
- tile decoration
- architectural detail

## 強み

- 局所ルールの一貫性
- sample/style反映
- 2D/3D module双方に適用可能

## 弱み

- global Start→Goal保証が弱い
- contradiction処理が必要
- rule authoringが難しい
- topology generatorとして単独利用しづらい

## Dungeon Architect AIへの統合

全Dungeon topologyではなく:

```text
Gameplay Graph
↓
Room placement
↓
WFC local room/module generation
```

のようなlocal generatorとして特に有効。

---

# 11. Hybrid + Simulation Selection

## 一言でいうと

**1回だけ作らず、複数候補を作ってSimulatorで最も意図に合うものを選ぶ方式。**

## 簡単な図

```text
             ┌─ Candidate A ─ Sim ─ score 0.71
DesignIntent ├─ Candidate B ─ Sim ─ score 0.88 ← select
             ├─ Candidate C ─ Sim ─ score 0.62
             └─ Candidate D ─ Sim ─ score 0.79
```

## 処理

1. base Seedからcandidate Seedを派生
2. N個生成
3. validation
4. simulation
5. metrics取得
6. DesignIntent fit評価
7. best candidate採用

## 評価例

- Start→Goal距離
- branch count
- dead-end count
- cycle rank
- expected damage
- reward distribution
- clear rate
- target duration
- exploration fit
- combat fit

## 強み

- 品質をruleだけに頼らない
- DesignIntentへの一致度を上げやすい
- 各Algorithmと組み合わせられる

## 弱み

- 実行時間増加
- score設計が必要
- deterministic candidate selectionの設計が必要

## Dungeon Architect AIでの位置づけ

既存Simulatorを活かせるため、最終的な本命構成候補。

---

# 12. 比較表

|方式|空間variation|topology制御|DesignIntent適性|接続性|主用途|
|---|---:|---:|---:|---:|---|
|V1 Classic|低|中|中|非常に強い|baseline|
|V2 Recommended|中～高|中|中|非常に強い|current default candidate|
|BSP|中|中|中|接続方法次第|room layout|
|Delaunay + MST|高|中～高|高|強い|organic room graph|
|Rooms + Mazes|高|中|中|強くできる|exploration|
|Random Walk|高|低|低|比較的強い|cave|
|Cellular Automata|高|低|低～中|repair必要|cave|
|Maze|中～高|中|中|強い|corridor exploration|
|Gameplay Graph|高|非常に高い|非常に高い|設計次第で強い|semantic topology|
|WFC|local高|global低|中～高|global別途|local module|
|Hybrid + Simulation|基盤次第|高|非常に高い|高|best-of-N|

---

# 13. 選択UIで伝えるべき説明

ユーザーには専門用語だけを見せない。

例:

### Version 1 — Classic

「安定した主経路と少数の分岐を持つ、再現性重視のクラシック方式」

### Version 2 — Recommended

「Classicの安定性を保ちながら、Seedごとに部屋配置とサイズを変化」

### BSP

「空間を区画分けして部屋を配置。整理された施設型ダンジョン向き」

### Delaunay + MST

「部屋を自然に散らし、近い部屋を効率よく接続。探索型に向く」

### Rooms + Mazes

「部屋の間を迷路で埋める。通路探索が多いRoguelike型」

### Random Walk

「ランダムに掘り進んだ軌跡から洞窟を作る」

### Cellular Automata

「ノイズを平滑化して自然な洞窟地形を作る」

### Gameplay Graph

「戦闘・報酬・分岐など、プレイ体験を先に設計する」

### WFC

「部品同士の接続ルールを守って局所構造を組み立てる」

---

# 14. 実装優先順位

Algorithm Labの最初の実装順として:

1. Delaunay + MST + Loops
2. BSP
3. Rooms + Mazes
4. Gameplay Graph
5. Maze Carving
6. Random Walk
7. Cellular Automata
8. WFC
9. Hybrid + Simulation Selection

を推奨する。

最初の3つは現在のRoom/Corridor中心DungeonSpecへ比較的自然に落とせるため、共通Strategy境界の検証にも向いている。

---

# 15. Sources

詳細な原典・URLは:

`docs/research/DUNGEON_GENERATION_ALGORITHMS.md`

を参照。

主な参照:

- van der Linden, Lopes, Bidarra — Procedural Generation of Dungeons
- van der Linden, Lopes, Bidarra — Designing Procedurally Generated Levels
- Shaker et al. — Constructive generation methods for dungeons and levels
- RogueBasin — BSP / Random Walk / Cellular Automata
- Bob Nystrom — Rooms and Mazes
- Jamis Buck — Maze generation
- Maxim Gumin — Wave Function Collapse
- public Delaunay + MST dungeon implementations
