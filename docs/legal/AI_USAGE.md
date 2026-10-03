# AI Usage Register

Record AI services/models/tools used to create production code, documentation, assets, or runtime behavior.

最終更新: 2026-10-03。コード確認基準: `9c4d324d2be18e4b95c4f7d87fdeb456b6feea08`（PR #70）。ブラウザ本体と、別途制作した提出用デモ動画の利用範囲を区別する。

| ID | Tool/Model | Provider | Purpose | Date | Output type | Human review | Terms / evidence | Included in submission | Status |
|---|---|---|---|---|---|---|---|---|---|
| PROD-AI-DEV-001 | ChatGPT / GPT-5.6 Sol | OpenAI | Human-directed production development assistance: implementation, tests, documentation, review, and repository maintenance | 2026-09-12 through 2026-09-18 | source code, tests, Markdown documentation, review suggestions | Yes — user-directed changes plus production Node/Chrome evidence gates before DONE/merge | Hosted development service only; no model weights/runtime redistributed; generated output is reviewed before inclusion | Yes — reviewed source/docs only; raw private chats/prompts are not committed | Recorded |
| PROD-AI-DEV-002 | OpenAI AI development assistant（各セッションの正確なモデル名は未確認） | OpenAI | ユーザー指示による実装・テスト・レビュー・資料更新、デモ台本・字幕・編集支援 | 2026-09-19 through 2026-10-03 | source code, tests, Markdown documentation, video script/captions and editing scripts | ユーザー主導の変更・レビューと、各変更に対応する検証記録。全環境・全ゲートの一括合格を意味しない | 下記の更新範囲と根拠。DEV-001のモデル名を後続期間へ推定で引き継がない | Yes — reviewed source/docs and demo presentation; private chats/prompts excluded | Recorded |
| PROD-AI-RUN-001 | Responses API / `gpt-5.6-luna` | OpenAI | Production cloud DesignIntent / room-request generation and constrained natural-language EditCommand translation | 2026-09-13 onward | schema-constrained structured JSON | Automated independent schema/semantic validation plus user-controlled authoring application | `docs/research/DAI-042_PRODUCTION_CLOUD_PROVIDER_REVIEW_2026-09-13.md`; DAI-043/044/045/053 evidence; requests use `store:false` and server-side credential boundary | Yes — runtime service integration; no model weights are bundled | Approved |
| PROD-AI-VIDEO-001 | Kokoro package `0.9.4` / Kokoro-82M v1.0 / `af_heart`, speed `0.9` | hexgrad（ローカルCPU推論） | 150秒デモ動画の英語ナレーション合成 | 2026-10-03 | AI-generated speech mixed into MP4 | 台本・字幕・映像の対応を確認し、修正版動画をユーザー確認。技術QAと主観的音声評価は区別する | [公式モデルカード](https://huggingface.co/hexgrad/Kokoro-82M)、[公式コード](https://github.com/hexgrad/kokoro)。コード・モデルはApache-2.0。モデル・音声ファイルの同一性と出力は下記参照 | Prepared demo video only — no TTS software, model weights or generated narration bundled into browser runtime; public upload not established by this record | Recorded |

## Boundaries

- No AI-generated image, audio, font, texture, 3D model, animation, or other creative asset is bundled into the current production browser candidate. The separately prepared demo video contains the AI-generated narration disclosed as PROD-AI-VIDEO-001.
- DAI-097 audio is project-authored programmatic Web Audio synthesis defined as source-code oscillator/frequency/envelope constants; it is not an AI-generated audio asset and does not bundle generated/sample audio files.
- AI development assistance does not bypass project review gates. Production tasks are not marked DONE solely because an AI system generated code or text.
- Runtime model output is not arbitrary executable code. The current production paths accept constrained structured data and independently validate it before use.
- `OPENAI_API_KEY`, account IDs, private chats, and full sensitive prompts must not be stored in this register or the public repository.
- Provider/model selection remains reversible in server implementation. At the reviewed commit, both Pages Functions use the server-side default `gpt-5.6-luna`; a model environment override is not exposed by those endpoints. The project does not redistribute OpenAI model weights.
- TTSのコード・モデルのApache-2.0表記を、生成音声そのもののCC0宣言や第三者素材ポリシーの変更と解釈しない。動画用の制作ツール利用記録であり、ブラウザへの素材・依存関係追加を承認するものではない。

## 2026-10-03 更新範囲と根拠

- 開発支援: DAI-085–099のUI・探索・Room Events・プレイヤー成長・複数階・プログラム音声・シミュレーション、DAI-100の編集・生成方式・JSON入出力・特殊部屋・店・難易度・罠・表示調整と検証を対象に更新した。範囲・未完了ゲートは `docs/planning/DAI-100_FINAL_POLISH.md` と各 `docs/testing/` 記録に従う。支援範囲の開示であり、各行・各コミットを特定のモデルが生成したと断定するものではない。
- 直近の変更: PR #67は旧content layer／罠互換分岐の撤廃、#68は休眠敵によるGoal阻害の修正、#69はGoal完了ボタン／公開smoke URL処理の修正、#70は生成確認・JSON正規化に受入smokeを追従させた。根拠: `docs/testing/CURRENT_CONTENT_RULES_2026-10-02.md`、`GOAL_DORMANT_2026-10-02.md`、`GOAL_LAYOUT_2026-10-03.md`、`ACCEPTANCE_GAP_2026-10-03.md`（後三件も同じディレクトリ）。PR #70はruntime変更ではない。
- 実行時モデル: `packages/cloud-intent/src/cloud-intent-adapter.js` の `DEFAULT_CLOUD_INTENT_MODEL`、`openai-edit-command-adapter.js` の同定数参照、および `functions/api/design-intent.js` / `natural-edit.js` を確認した。両経路は `reasoningEffort: low`、`store: false`、構造化出力と独立検証を使用する。自然言語編集は現在、移動だけでなく `resize-room` 等の許可されたコマンドを扱う。`store: false` はZero Data Retentionの主張ではない。
- 不明なもの: 後続開発セッションの正確なモデル別内訳、完全なプロンプト履歴、総トークン数、請求額はこの記録から確定しない。過去のモデル名や推計値で補完しない。

## デモ動画の生成音声・実AI操作（2026-10-03）

- 対象: `DAI_Demo_Review_EN_2026-10-03.mp4` の修正版（150秒、1920 × 1080、30 fps）。SHA-256: `3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8`。公開URL・投稿完了・最終提出の証拠とは区別する。
- 音声: ローカルに保存したKokoro-82M v1.0と `af_heart` をCPUで使用。英語台本からspeed `0.9`、24 kHz mono PCM16の音声を作成し、編集して動画に収録した。ゲーム内Web Audioとは別物で、ゲーム映像そのものは実際のブラウザ操作を録画したもの。
- モデルSHA-256: `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4`。音声ファイル `af_heart.pt` SHA-256: `0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff`。ローカル制作記録のインストール済みバージョン、音声manifest・技術QA・動画配送記録と照合した。モデル／音声重みは本リポジトリに収録しない。
- 撮影時のUI操作はGenerate 1回、AI edit 1回。2階生成と `resize-room` の適用・Undoを観察した。生成のcloud利用は画面出力からの推定であり、生のprovider応答を直接検査した証拠とは区別する。
- 撮影用台帳ではprovider試行を最大3回分予約したが、実際の再試行数・トークン数・請求額は未観測。保守的予算上限32.10円は予約見積りで、実請求額ではない。動画修正時に追加の有料AI操作は行っていない。ローカルTTSによる音声合成に有料APIは使用していない。
- 本更新は利用事実の記録のみ。正式なWindows Chrome受入、全smoke再実行、公開動画URL、最終freezeや提出手続きの完了を意味しない。

Status values used here: `Recorded` for disclosed development or video-production assistance and `Approved` for a reviewed production runtime integration.

## 動画制作依存関係のレビュー補足

`PROD-AI-VIDEO-001` の `Recorded` はAI利用の開示であり、第三者ソフトウェアの制作用途承認とは別。[TTS toolchain review](TTS_TOOLCHAIN_REVIEW_2026-10-03.md) と [dependency register](THIRD_PARTY_DEPENDENCIES.md) の `PROD-DEP-TTS-001` に、正確なバージョン・取得元・ハッシュ・ライセンス・配布境界を補足した。既存のユーザー承認済みオフライン動画制作範囲について技術レビューを補完した。公開・提出・ソフトウェア／モデルの再配布を本追記で許可しない。
