# 公開backendのlive生成とAI Edit確認 2026-10-04

## 結果

**公開backendのlive生成、live AI Edit、返された編集commandのゲーム画面への適用を確認した。**

所有者がWindowsのBrave/Chromium 154で公開デモを操作し、提供したNetworkレスポンス本文とスクリーンショットを解析した。生成は `selectedProvider: cloud`、両方のproviderは `openai`、modelは `gpt-5.6-luna`。Editは `treasure-1` をGoalのある `room-005` へ移動し、画面の適用成功と一致した。fixtureやfallbackを今回のlive成功証拠へ置き換えていない。

これは対象の生成・Edit経路に限定した確認であり、最終統合suiteのFAIL解消、Play完走、Windows Chromeブランド固有の正式受け入れ、公開buildとmainのfingerprint一致を意味しない。

## 確認方法と観測

- 対象: https://dungeon-architect-ai.pages.dev/ の同一origin `/api/design-intent` と `/api/natural-edit`
- 所有者の画面は `/api/` というURLでアプリを表示していたが、生成requestの送信先は正規の `/api/design-intent` だった。
- 今回採用した生成requestはDevTools Headersで `POST` と `200 OK`、Date `2026-10-04 08:17:02 GMT` を確認した。
- 所有者提供の生成Response本文を `validateDesignIntent` と `validateRoomRequests` で独立検証し、両方valid、errorsなし。
- Editの `ok: true`、command、provider、model、usageは提供テキストと最終画面のResponse表示で一致した。EditのHTTPステータスそのものは最終画面がResponseタブのため独立したHeaders画像では確認していない。
- 最終画面に `Applied: move-entity`、選択中のChest `treasure-1`、DetailsのRoom `room-005`、同室ContentsのGoal `goal-1` とChest `treasure-1` が表示されている。Undoが有効で、Goal Checkは `✓ Valid`。これらが返されたcommandの適用を裏付ける。
- 最終画面のNetwork一覧は初期読み込み3本と `design-intent`、`natural-edit` の計5本。最新セッションのAPI要求2本と整合する。
- 調査側は新しい有料API呼出しを行わず、資料をread-onlyで解析した。追加撮影用の生成・Editはしていない。

### 生成Response

```json
{"ok":true,"intent":{"schemaVersion":"1.0","fairness":0.5,"tension":0.6,"exploration":0.6,"greedPunishment":0.5,"routeChoice":0.5,"learnability":0.5,"combatDensity":0.5,"trapDensity":0.8,"rewardDensity":0.7,"deception":0.2,"telegraphStrength":0.6,"backtracking":0.4,"targetDifficulty":0.5,"targetDuration":300,"instantDeathAllowed":false},"roomRequests":[],"difficulty":null,"warnings":[],"selectedProvider":"cloud","meta":{"provider":"openai","model":"gpt-5.6-luna","usage":{"inputTokens":1140,"outputTokens":313,"totalTokens":1453}}}
```

### AI Edit Response

```json
{"ok":true,"command":{"type":"move-entity","entityId":"treasure-1","roomId":"room-005"},"meta":{"provider":"openai","model":"gpt-5.6-luna","usage":{"inputTokens":1618,"outputTokens":247,"totalTokens":1865}}}
```

生成endpointはfallbackでもHTTP 200を返し得るため、HTTPだけでlive判定していない。今回の `selectedProvider: cloud` と実モデル・usageを根拠にした。AI Editは成功時にprovider由来のcommandを返す実装であり、最終画面にもその内容が表示された。

## 利用量と費用

| 採用した成功Response | input tokens | output tokens | total tokens | 標準単価による試算USD |
|---|---:|---:|---:|---:|
| 生成 | 1,140 | 313 | 1,453 | 0.0006036 |
| AI Edit | 1,618 | 247 | 1,865 | 0.0006200 |
| 合計 | 2,758 | 560 | 3,318 | 0.0012236 |

OpenAI公式GPT-5.6 Lunaページの2026-10-04確認単価（input $0.20 / 1M、output $1.20 / 1M）で計算した。計画換算200円/USDでは両成功分で約0.24円。これは実請求額・実決済為替ではなく、cache read/write内訳、内部失敗試行、先行2生成のusageを含まない。

- 料金参照: https://developers.openai.com/api/docs/models/gpt-5.6-luna
- 所有者承認予算: 100円
- 先行資料には5部屋・10部屋の2つの生成履歴があり、その後に今回の1生成＋1Editを実施した。全体を「生成1回だけ」と記録しない。
- 参照runtimeでは生成は最大2provider試行、Editは1試行。把握した3生成＋1Editを含めると最大7試行を予約する。
- 出力cap合計25,088 tokens、各試行の入力を100,000 tokensまで保守的に予約し、cache write込みinput $0.25 / 1M、計画換算200円/USD＋20%の余裕を適用した予約見積りは49.23円（丸め50円）。これは他の追加呼出しがない前提の事前管理用見積りで、実測使用料ではない。既知の約6.7KBの入力requestより大きく予約している。
- 公開生成endpointは内部attemptsを省略し、usageは最終成功分だけを返す。実際の内部retry数・失敗分usage・実請求額は未確認。正確な値にはserver-sideログまたはprovider利用明細が必要である。

## 先行Full JSONの検証と扱い

最新live成功セッションより前に提供された2本のFull JSONは、runtime commit `8bcce65246663bc16625a0f915ec2f202c63b5e4` の `validateDungeonRunSpec` と `evaluateStartGate` で両方valid、Critical 0、START許可だった。構造上のStart→Goal到達性も確認した。これは実Play完走試験とは区別する。

| 項目 | 先行JSON A | 先行JSON B |
|---|---:|---:|
| Seed | 594210816 | 594210816 |
| フロア数 | 1 | 1 |
| 部屋数 | 5 | 10 |
| 通路数 | 5 | 11 |
| Entity数 | 8 | 9 |
| 敵数 | 2 | 3 |
| 宝箱数 / 罠数 / Event数 | 2 / 2 / 1 | 2 / 2 / 1 |
| treasure-1の部屋 | room-004 | room-010 |
| Goalの部屋 | room-005 | room-010 |

両JSONは部屋形状・座標・通路・敵数まで異なり、配列順を保持する構造比較で41箇所の差分がある。JSON Aへ単一 `move-entity treasure-1 → room-005` をローカル適用してもJSON Bとは一致しなかった。したがって、この2本を同一ダンジョンに対するAI Edit前後の差分証拠として扱わない。このローカル比較を有料live呼出しにも数えない。

最新成功セッションの生の前後Full JSONは未取得。今回の適用確認はcommandと同じID・移動先を示す最終ゲーム画面に基づく。

## 証拠保全と限界

所有者提供の原画像とJSONはprivateに保持し、無関係なブックマーク、認証ヘッダー等をリポジトリへ追加しない。以下は受領／保存したファイルのSHA-256であり、公開buildのfingerprintではない。

| 証拠 | SHA-256 |
|---|---|
| 先行Full JSON A | `e4ff24166f69b6335360292e738746e638e09e68b126b729996058e04b6a1d22` |
| 先行Full JSON B | `dd907003d4f95fd657608dec0c3df5f31879719a04c98764220a933f2ff83d8d` |
| 上記生成Responseを一行UTF-8＋LFで保存 | `1c2772b58c4c2074fe703531aeb35622c3bcdc3d684aabe966e8b654a6cc04b5` |
| 上記Edit Responseを一行UTF-8＋LFで保存 | `03e19bc5a95313dd1f7a0a4372db3475ccb1b3d0f92c7f38ae84ab711c2dad0d` |
| 最終適用画面 `image(20261004-082057).png` | `86d48338133fe8a7c1e9cf304860900f1256a1692b5f3712fa549b0a5fcfe71b` |

公開asset名 `index-CxdRkJ1u.js` は画面に見えるが、今回 `build-info.json` のcommit／runtime source／bundle fingerprintを照合できていない。したがって、公開backend・UIの限定live成功と、現mainとの厳密な配備一致を区別する。

先行のクラウド確認はWebGL disabledおよび通常HTTPのCloudflare 403/1010により課金呼出し前に停止した。その歴史的結果は保持し、所有者のWindowsで後から得た本live成功と混同しない。コード変更、deploy、最終統合suiteの再実行は行っていない。
