# Room Events配置の現行検査条件（2026-10-04）

## 背景

[Windows r2](WINDOWS_PR75_R2_FINAL_LOCAL_2026-10-04.md)の実測対象はPR #75の `1d9cbb426408e080568a04ea9e44870309339d07`、tree `2dde5e7513c4191c31b566d2eca8287ae2d36be8`。全体は4 PASS / 1 FAIL / 19 NOT_RUNで、Owner UIの61判定中60件がPASS、旧 `roomEventStackCentered` だけがFAILだった。

実測はイベント中心 `(720, 380)`、viewport中心 `(720, 484)`。水平は一致し、垂直差は104pxである。現行CSSの `top: calc(50% - 104px)` と一致している。これは多数のEntityや店の商品一覧が出口パッドを覆わないための配置であり、reticleは引き続きviewport中央にある。

2026-09-23の[配置仕様](../planning/PLAY_UI_STACK_LAYOUT.md)・[過去の合格記録](PLAY_UI_STACK_LAYOUT_VALIDATION.md)および9月28日のevent-feedback記録は、当時のviewport中央配置を前提としていた。歴史的結果を保持した上で、現行版へ適用する検査条件をここに分けて記録する。**今回runtimeのCSS・配置・ゲーム挙動は変更していない。**

## 独立した判定条件

既存24段階runner内のOwner UI（段階5）とEvent feedback（段階11）を対象とする。新しい `scripts/room-event-layout-checks.mjs` は次を検査する。

1. Room Eventsの中心Xはviewport中心Xから±3px以内
2. 中心Yはviewport中心Yから**104px上**、許容差±3px
3. Room Eventsの実矩形がviewport内に収まる
4. イベントと出口パッドが両方実表示され、`events.bottom < exits.top` の正の隙間がある

期待値104pxは独立定数であり、実測中心やcomputed CSSから期待値を作らない。中心は実矩形から再計算する。hidden、祖先の非表示、opacity 0、ゼロ寸法、欠落・非有限値を合格にしない。800px以下は別のCSS配置になるため、このdesktop判定の対象外として合格にしない。対象browser smokeは1440×900のdesktopである。

罠や敵が未解決の間は出口がhiddenになるため、そのゼロ矩形を「重ならない」証拠にはしない。

- Owner UI: 既存のキーボード移動後の配置確認を維持する。さらにローカルの最小fixtureを再読込し、Start→中央の部屋→敵の処理を実UIで行う。未開封宝箱と出口パッドが同時表示された状態で4条件を必須検査する
- Event feedback: intro中は配置の3条件を検査する。宝箱へ移動してblockerを解決した後、宝箱を開く直前に両方の実表示矩形を取得し、4条件を必須検査する
- intro初期のopacity 0と競合しないよう、正のcomputed opacityを待ってから配置を測る。Event feedbackではintro classも同時に要求する

元の敵・罠・宝箱・階移動・結果・多言語・編集等のassertは維持する。旧「viewport中心」という2条件の名称と定義を置き換え、両方へ出口非重複の必須gateを追加した。未表示のイベントを任意とする既存Owner条件は保持するが、追加fixtureでの同時表示検査は省略できない。

## 証拠と確認結果

両smokeの結果JSONへ、実矩形、表示状態、期待offset、実測offset、出口とのgap、各条件の結果を保存する。r2では出口との同時表示矩形が記録されていないため、r2だけから非重複までPASSとはしない。

実行環境はLinux / Node.js `v24.19.0` / npm `11.9.0`。

| 確認 | 結果 |
|---|---|
| `node --test tests/tooling/room-event-layout-checks.test.js` | 13/13 PASS |
| `npm run test:tooling` | 62/62 PASS |
| 変更JS/MJSの `node --check` | 4/4 PASS |
| 変更箇所の末尾空白検査 | PASS |
| 独立レビュー | opacity初期フレームの競合を修正後、追加指摘なし |
| runtime・依存・既存fixtureの差分 | 0 |

13件の回帰は正常配置に加え、旧0px中央、逆方向offset、水平ずれ、許容差超過、出口との重なり／接触、viewport外、hidden・ゼロ・欠落・NaN、非表示祖先、狭い画面を拒否する。Readerと両smokeの接続・測定順序も検査する。

## 未検証・歴史的runnerの境界

本変更のfocused確認時点では、変更後の実ブラウザと24段階全体は未実行だった。後続の [Windows r3](WINDOWS_PR75_R3_FINAL_LOCAL_2026-10-04.md) で `8df3aeb9aeeaf31a228efbec8e901bbc2c7aa531` の24/24段階がPASSし、Owner UI／Event feedbackの104px上方配置と可視出口との非重複も実DOMで確認された。当時のNode geometry検査と後続のbrowser実測は別の証拠として保持する。

同類の旧中心条件は、24段階外の `run-play-ui-stack-layout-smoke.mjs` と歴史的 `run-dai-099-public-smoke.mjs` にも残っている。本変更ではそれらを現行版へ再認定せず、過去の対象版に関する記録として区別する。公開deployment、実provider、動画、最終提出を合格へ変更するものではない。
