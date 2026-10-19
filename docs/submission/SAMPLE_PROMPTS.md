# Sample Prompts

## 現仕様の例と証拠の範囲（2026-10-04、2026-10-19更新）

以下の英語例は引き続き入力例として使用できます。Generator RecommendedはV3、Auto／Manual確認と生成直前の難易度設定が現仕様です。AI Editは11種類のうち1コマンドだけを適用します。受入の範囲と未完了の項目は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) に記録し、旧候補の成功を現候補全体の成功へ引き継ぎません。


所有者のWindows Brave/Chromiumによる限定live確認で、Generateのcloud Response、AI Editの `move-entity` Responseと画面適用を確認済みです。公開build-infoと対象mainのcommit/source/bundle一致、全公開E2E、全異常入力への合格はこの確認に含みません。根拠は [限定live確認記録](https://github.com/Bonkoturyu/Dungeon-Architect-AI/blob/3196f2bb942bbdfbcddc2481416f24d7196c5ead/docs/testing/LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md) を参照してください。公開 `build-info.json` と候補commitの一致、全公開E2Eは、2026-10-19に候補 `806d70c` で別途確認しました（[記録](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md)）。公開版の異常入力確認も同日に行いました（[記録](../testing/PUBLIC_ABNORMAL_INPUT_DAI090_2026-10-19.md)）。

## Verified public generation prompt — historical M8

The historical M8 public candidate has end-to-end evidence for:

```text
Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.
```

Historical verified path:

`DESCRIBE → cloud DesignIntent → deterministic DungeonSpec → START → Goal → Result`

That historical public run generated a valid five-room dungeon and completed it in four moves.

## Historical September DAI-099 refreshed public validation prompt

The refreshed candidate uses:

```text
Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.
```

Expected refreshed path:

`DESCRIBE → cloud DesignIntent → deterministic 2-floor DungeonRunSpec → ▶ Test → Room Events / CHOOSE EXIT → Floor 2 → Result`

当時の受入は matching build fingerprint を必要とする計画でした。旧候補027b0f3の実行記録は [PR #55](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/55) と [PR #56](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/56) に保存されています。現候補 `806d70c` の公開E2E（`scripts/run-dai-099-public-smoke.mjs`）は、このプロンプトと下の編集例をliveで使い、2026-10-19に22/22 checks PASSしました。

## Verified public natural-language edit

```text
Move the treasure to the room that contains the goal.
```

Historical M8 verified behavior:

- translated into one constrained `move-entity` command;
- applied to the generated authoring spec;
- START remained valid;
- public `/api/natural-edit` returned HTTP 200.

このrequestは現在も対応する例ですが、下記の歴史的move-entity成功だけで現在の11コマンドすべての実provider検証済みとはしません。

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
