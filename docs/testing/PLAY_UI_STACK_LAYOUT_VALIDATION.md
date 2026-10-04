# Play UI Stack Layout Validation

Date: 2026-09-23 JST  
Branch: `feat/play-ui-stack-layout`

## 2026-10-04 現行版への適用範囲

以下は2026-09-23の対象版に対する過去の合格記録であり、現行版の全検査PASSを意味しない。現行desktop UIのRoom Eventsは水平中央・viewport中央から104px上で、出口パッドとの非重複を優先する。[現在の判定条件](ROOM_EVENT_PLACEMENT_CHECKS_2026-10-04.md)は別記録へ分離した。本書の歴史的結果は書き換えない。

## Owner-requested scope

This follow-up refines Play-mode UI hierarchy after DAI-096:

- directional controls at the lower center;
- visible status immediately below the directional pad;
- visible status order: `LV → HP current/max → EXP current/required → G`;
- larger/readable status typography with a dark backplate;
- room-local Enemy / Chest / Trap / Recovery actions stacked at the viewport center;
- stable early/authored order for room-event dialogs;
- Play/Result errors centered above the room-event stack with a stronger backplate;
- Edit-mode lower-center blocked-operation notice preserved;
- Result panel kept separate.

## Acceptance command

```powershell
.\scripts\run-play-ui-stack-layout-validation.ps1
```

Final result:

```text
[PLAY-UI] ALL ACCEPTANCE GATES PASSED.
```

## Acceptance gates

All 8 gates passed:

1. Play UI stack layout smoke
2. START-gate browser smoke
3. Exploration UX browser smoke
4. Room-event browser smoke
5. Multi-floor browser smoke
6. Programmatic characters smoke
7. Owner UI regression smoke
8. Hosting build

## Focused UI invariants

The focused smoke verifies:

- bottom HUD centered near viewport bottom;
- directional pad immediately above stats;
- visible status order exactly `LV, HP, EXP, G`;
- visible status font size at least 16 px;
- non-transparent status backplate;
- hidden auxiliary MOVE / MAP / FLOOR metrics;
- Room Event stack centered;
- deterministic event order;
- readable Room Event backplate;
- Error centered over Room Events with higher z-index;
- readable Error backplate;
- no console/page/request/HTTP errors.

## Acceptance

Owner-requested Play UI stack layout is accepted.

This is a follow-up polish change and does not replace the existing DAI-085 / DAI-087 / DAI-095 / DAI-096 functional contracts.
