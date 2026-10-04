# Generate / Edit 異常入力 API handler 統合検証 — 2026-10-04

## 結果と対象

**ローカル・offline の追加39ケースが39/39 PASS。公開/live の異常入力E2Eは未実施。**

- 基準実装: `main` `8bcce65246663bc16625a0f915ec2f202c63b5e4`
- 実行日: 2026-10-04 UTC、Node.js `v24.19.0`、Linux
- 追加試験: [`tests/hosting/api-boundary-integration.test.js`](../../tests/hosting/api-boundary-integration.test.js)
- runtime、backend、ゲーム仕様の変更はない。追加39ケースでは新規不具合を検出していない。
- Generate は現UIと同じ `includeRoomRequests: true`、Edit は11種類のコマンドと Room geometry / Corridor context を対象にする。

## 補った境界

既存の Function テストは、主要な正常応答や障害を `generate` / `route` の差し替えで確認していた。adapter 単体テストには11コマンドの詳細検証があるが、HTTP request を起点に実adapterの検証結果が実handlerのHTTP応答へつながることをまとめて確認する試験が不足していた。

追加試験は次の本番実装をそのまま通す。

- Generate: `handleDesignIntentRequest` → `routeDesignIntent` → `generateOpenAIRoomDesign` → `createOpenAIHttpTransport`
- Edit: `handleNaturalEditRequest` → `generateOpenAIEditCommand` → `createOpenAIHttpTransport`

置換するのは transport の `fetchImpl` だけで、合成 provider HTTP 応答を返す。`globalThis.fetch` も試験ごとに失敗するよう置換するため、依存注入の漏れで公開APIへPOSTしない。実APIキー、ネットワーク接続、provider課金は不要。

| 境界 | ケース数 | 確認した結果 |
|---|---:|---|
| 両APIのbody / prompt制限 | 18 | 宣言body超過、過少申告を含む実body超過、ヘッダーなしUTF-8多バイト超過は400。ちょうど16 KiB / 64 KiBは正常通過。欠落・空白・object・文字数超過promptはprovider呼出し0回で拒否。ちょうど12,000 / 4,000文字は通過 |
| Edit context異常 | 3 | Room配列欠落、null Room、不正Corridor幅をprovider呼出し0回・422で拒否 |
| 現契約の正常対照 | 2 | Generateのintent / roomRequests / difficulty / warningsを保持。Editの構造コマンド `set-corridor-doors`、11command schema、geometry / topologyを実handler経由で確認 |
| Generateの継続的不正出力・障害 | 5 | 非JSON、コードの追加field、不正特殊部屋数、refusal、429はschema-validなdeterministic fallbackに収束。refusalは1回、その他は2回で打切り |
| Generateの一時的障害 | 1 | 429後の1回のretryで現room-design応答へ回復 |
| Editの敵対的provider出力 | 6 | 非JSON、コードの追加field、非対応command、複数command配列、架空Corridor ID、Goal部屋削除を422で拒否。応答に適用可能なcommandを返さない |
| Editのprovider障害 | 4 | 429→429、provider 503 / transport例外→502、未完了応答→422。各1回で終了 |
| **合計** | **39** | **39 PASS / 0 FAIL / 0 SKIP** |

Generate の不正prompt応答は `400 / PROMPT_INVALID`、Edit は既存契約どおり `422 / CLOUD_EDIT_REQUEST_INVALID`。これを揃える動作変更はしていない。

## 既存試験との分担

- [`DAI-090_UNEXPECTED_PROMPTS.md`](DAI-090_UNEXPECTED_PROMPTS.md): 固定20promptの意味適合・公開Generate検証。既存runnerは `{ prompt }` を送る。このoffline試験はそれを変更せず、現UIのroom-design分岐とEditの異常HTTP境界を補う。
- `packages/cloud-intent/test/`: 11commandの個別制約、Room/Corridorの細かな幾何・参照検証、router retry/timeout等は既存単体テストの担当。今回その網羅表は複製せず、代表的な拒否をhandlerまで通す。
- [`DAI-074_SECRET_PRIVACY_AUDIT.md`](DAI-074_SECRET_PRIVACY_AUDIT.md): credential / prompt 非漏えい、公開build・履歴走査、context情報の最小化は既存監査の担当。今回新たな漏えい監査の合格を主張しない。
- 旧候補 `027b0f3` のGenerate/Edit 20ケースpublic E2Eは旧候補の証拠として扱い、現契約のlive結果へ読み替えない。

## 実行結果

| コマンド | 結果 |
|---|---|
| `node --test --test-reporter=tap tests/hosting/api-boundary-integration.test.js` | 39/39 PASS |
| `npm run test:hosting` | 53/53 PASS（新規39を含む） |
| `npm run test:cloud-intent` | 46/46 PASS |
| `node --check tests/hosting/api-boundary-integration.test.js` | PASS |

新規ファイルは既存の `test:hosting` globに含まれるため、`npm test` / `validate:dai-100-final-local` のNode段階に自動で入る。package.jsonや全体runnerの変更は不要。上表はfocused実行結果であり、全24段階suiteの合格を示すものではない。

## この追加検証の充足判定

今回の不足は、既存のvalidator / routerの異常結果が現API handlerのHTTP応答まで正しく接続されるか、という決定的な実装境界だった。この範囲は上記39ケースで充足と判定する。合成provider応答を使うことで、不正JSON、schema逸脱、refusal、429等を確実に再現でき、同じ異常の発生を実モデルに期待して公開POSTする必要はない。

そのため、この追加検証のための公開異常POST・追加課金は行わない。公開環境の正常Generate / Editの疎通確認や、DAI-090の実モデル意味適合とは別の判定である。公開edge設定、実モデルの敵対promptへの応答品質、公開異常E2Eまで検証済みと拡張しない。

## 証拠の限界・残る検証

- 実provider / 公開Pages Functions / ブラウザUIはこの試験では呼んでいない。
- 敵対的な自然文と合成の不正provider出力を入力し、実装の拒否・回復境界を検証した。実モデルがprompt injectionを常に無視する、自然文の意味を正しく解釈する、という証明ではない。
- Edit試験の終点は安全なcommandまたはHTTP error。Editor適用、Undo/Redo、Play状態、Start→Goal到達性はそれぞれ既存Editor / browser試験の担当。
- 公開異常入力E2Eを実施する場合は、公開POSTと費用の許可を別途確認し、対象buildを固定してこのローカル結果とは別に記録する。
