# Sample Prompts

## Verified public generation prompt — historical M8

The historical M8 public candidate has end-to-end evidence for:

```text
Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.
```

Historical verified path:

`DESCRIBE → cloud DesignIntent → deterministic DungeonSpec → START → Goal → Result`

That historical public run generated a valid five-room dungeon and completed it in four moves.

## Verified public generation prompt — refreshed DAI-099

The refreshed candidate uses:

```text
Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.
```

Verified refreshed path:

`DESCRIBE → cloud DesignIntent → deterministic 2-floor DungeonRunSpec → ▶ Test → Room Events / CHOOSE EXIT → Floor 2 → Result`

This prompt is **refreshed verified public evidence** from the DAI-099 production public smoke with matching commit and runtime-source fingerprint.

## Verified public natural-language edit

```text
Move the treasure to the room that contains the goal.
```

Historical M8 verified behavior:

- translated into one constrained `move-entity` command;
- applied to the generated authoring spec;
- START remained valid;
- public `/api/natural-edit` returned HTTP 200.

DAI-099 revalidated this same constrained request with a fresh HTTP 200 on the current 2-floor runtime before freeze.

## DesignIntent regression corpus

The cloud DesignIntent pipeline also retains a frozen ten-case regression corpus with beginner/short, danger, greed, low-combat, learnability, fairness, exploration, contradictory, unsupported-code and mixed-language cases.

Representative examples:

### Beginner / short

```text
初心者が5分くらいで遊べる、短くて分かりやすいダンジョン。危険は見てから判断できるようにして。
```

### Greed punishment

```text
宝箱を欲張って開けるほど危険になる。報酬は魅力的だけど、欲張りには代償があるダンジョン。
```

### Scary / low combat

```text
怖くて緊張する探索ダンジョン。ただし戦闘は少なく、雰囲気と罠で怖さを出して。
```

### Mean but fair

```text
意地悪でプレイヤーを迷わせるけれど、公平で、注意深ければ見抜けるダンジョン。
```

### Mixed language / format

```text
⚔️🏰 5 min / beginner OK / scary / low combat pls。寄り道は少し欲しい。
```

Complete corpus:

`spec/design-intent/fixtures/dai-045-prompt-regression-v1.json`

The corpus also includes contradictory and arbitrary-code requests. The DesignIntent path remains schema-constrained and does not convert prompt text into executable runtime code.


## DAI-090 unexpected-prompt verification

The frozen public runtime also passed a 20-case post-freeze regression covering malformed JSON, empty/non-string/oversize input, contradictory requests, code-injection-style requests, secret-exfiltration requests, unsupported natural edits, nonexistent IDs, and mixed-language/symbol input.

Verification materials:

`spec/prompt-regression/fixtures/dai-090-unexpected-prompt-v1.json`

`docs/testing/DAI-090_UNEXPECTED_PROMPT_REGRESSION.md`
