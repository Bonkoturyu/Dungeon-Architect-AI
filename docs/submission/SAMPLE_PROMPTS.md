# Sample Prompts

## Current verified judge-facing prompt

The integrated browser UI currently has one production-verified natural-language edit example:

```text
Move the treasure to the room that contains the goal.
```

Verified behavior:

- one live `gpt-5.6-luna` call;
- translated command: `move-entity / treasure-1 / room-goal`;
- applied through the same EditSession boundary as manual edits;
- Undo/Redo verified;
- API key and full prompt excluded from evidence.

Other semantically similar relocation requests may work, but they are not claimed as the frozen judge acceptance prompt.

## Backend DesignIntent regression prompts

The production cloud DesignIntent pipeline has a separate ten-case regression corpus. These prompts validate intent translation semantics and are **not yet the current editor-screen generation workflow**.

Representative examples from the frozen corpus:

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

The complete frozen corpus is in:

`spec/design-intent/fixtures/dai-045-prompt-regression-v1.json`

## Unsupported / safety regression

The corpus also contains contradictory and arbitrary-code requests. The DesignIntent path must remain schema-constrained and must not turn prompt text into executable runtime code.
