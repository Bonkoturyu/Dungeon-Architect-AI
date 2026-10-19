# AI Usage Register

Record AI services/models/tools used to create production code, documentation, assets, or runtime behavior.

最終更新: 2026-10-19（PROD-AI-VIDEO-002と提出動画glb_v5を追記）。2026-10-18にPROD-AI-DEV-003・PROD-AI-REVIEW-001を追記。DEV-001〜002・RUN-001・VIDEO-001のコード確認基準: `9c4d324d2be18e4b95c4f7d87fdeb456b6feea08`（PR #70）。ブラウザ本体と、別途制作した提出用デモ動画の利用範囲を区別する。

| ID | Tool/Model | Provider | Purpose | Date | Output type | Human review | Terms / evidence | Included in submission | Status |
|---|---|---|---|---|---|---|---|---|---|
| PROD-AI-DEV-001 | ChatGPT / GPT-5.6 Sol | OpenAI | Human-directed production development assistance: implementation, tests, documentation, review, and repository maintenance | 2026-09-12 through 2026-09-18 | source code, tests, Markdown documentation, review suggestions | Yes — user-directed changes plus production Node/Chrome evidence gates before DONE/merge | Hosted development service only; no model weights/runtime redistributed; generated output is reviewed before inclusion | Yes — reviewed source/docs only; raw private chats/prompts are not committed | Recorded |
| PROD-AI-DEV-002 | OpenAI AI development assistant（各セッションの正確なモデル名は未確認） | OpenAI | ユーザー指示による実装・テスト・レビュー・資料更新、デモ台本・字幕・編集支援 | 2026-09-19 through 2026-10-03 | source code, tests, Markdown documentation, video script/captions and editing scripts | ユーザー主導の変更・レビューと、各変更に対応する検証記録。全環境・全ゲートの一括合格を意味しない | 下記の更新範囲と根拠。DEV-001のモデル名を後続期間へ推定で引き継がない | Yes — reviewed source/docs and demo presentation; private chats/prompts excluded | Recorded |
| PROD-AI-DEV-003 | Claude Code / Claude Opus 5.5（`claude-opus-5-5`） | Anthropic | ユーザー指示による公開前監査の補助、リポジトリ設定・資料の更新、ブラウザUIコードの限定リファクタリング | 2026-10-18 onward | `.gitignore`, Markdown documentation, refactored browser UI source, browser smoke scripts, 非公開の監査記録 | ユーザー指示・承認の範囲で変更し、関連する検証scriptを実行してから統合 | Hosted development service only; no model weights/runtime redistributed。非公開の監査記録・チャットは本リポジトリに含めない | Yes — reviewed configuration/docs and refactored UI source; private chats/audit records excluded | Recorded |
| PROD-AI-REVIEW-001 | GitHub Copilot pull request reviewer（モデル名は未確認） | GitHub | PRへの自動レビューコメント | 2026-09-12 through 2026-10-01（PR #1〜#59） | review comments on pull requests | 指摘の採否はユーザーが判断。個々の指摘がコードへ反映されたかはこの記録で確定しない | 下記「2026-10-18 更新範囲と根拠」 | No — PR上のレビューコメントのみ。生成物を直接収録したとは記録しない | Recorded |
| PROD-AI-RUN-001 | Responses API / `gpt-5.6-luna` | OpenAI | Production cloud DesignIntent / room-request generation and constrained natural-language EditCommand translation | 2026-09-13 onward | schema-constrained structured JSON | Automated independent schema/semantic validation plus user-controlled authoring application | `docs/research/DAI-042_PRODUCTION_CLOUD_PROVIDER_REVIEW_2026-09-13.md`; DAI-043/044/045/053 evidence; requests use `store:false` and server-side credential boundary | Yes — runtime service integration; no model weights are bundled | Approved |
| PROD-AI-VIDEO-001 | Kokoro package `0.9.4` / Kokoro-82M v1.0 / `af_heart`, speed `0.9` | hexgrad（ローカルCPU推論） | 150秒デモ動画の英語ナレーション合成 | 2026-10-03 | AI-generated speech mixed into MP4 | 台本・字幕・映像の対応を確認し、修正版動画をユーザー確認。技術QAと主観的音声評価は区別する | [公式モデルカード](https://huggingface.co/hexgrad/Kokoro-82M)、[公式コード](https://github.com/hexgrad/kokoro)。コード・モデルはApache-2.0。モデル・音声ファイルの同一性と出力は下記参照 | Prepared demo video only — no TTS software, model weights or generated narration bundled into browser runtime; public upload not established by this record | Recorded |
| PROD-AI-VIDEO-002 | OpenAI AIアシスタント（クラウド環境。制作セッションの正確なモデル名は未確認） | OpenAI | 提出動画glb_v5の追加制作：ffmpegでの編集、Kokoroによる追加ナレーション2本の合成の実行、BlenderでのGLB静止画の描画 | GLB Export（PR #78、2026-10-06）以後。正確な制作日は未確認 | edited MP4、AI-generated speech、rendered stills | 差し替え区間と字幕を所有者が確認。2026-10-19にv2との映像差分が2区間だけであることを確認 | 下記「提出動画glb_v5の追加制作」 | Prepared demo video only — no tool, model or session output bundled into browser runtime; public upload not established by this record | Recorded |

## Boundaries

- No AI-generated image, audio, font, texture, 3D model, animation, or other creative asset is bundled into the current production browser candidate. The separately prepared demo video contains the AI-generated narration disclosed as PROD-AI-VIDEO-001; the glb_v5 revision was edited, narrated and rendered by an AI assistant disclosed as PROD-AI-VIDEO-002.
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

## 2026-10-18 更新範囲と根拠

- PROD-AI-DEV-003: 公開前の確認作業で、Claude Code（Anthropic）を利用した。対象はリポジトリ設定（`.gitignore`）と本記録の更新、および非公開の監査記録の作成。runtime・素材・依存関係への変更は含まない。非公開の監査記録とチャットは本リポジトリに含めない。
- PROD-AI-DEV-003（同日追記）: `apps/editor-slice/main.js`の詳細HUD描画を`apps/editor-slice/ui/detail-view.js`へ、Playの出口ボタン・HUD数値・Result指標の描画を`apps/editor-slice/ui/play-view.js`へ、JSON書き出しの補助を`apps/editor-slice/ui/export-controller.js`へ、生成方式の表示名・選択肢・生成履歴の描画を`apps/editor-slice/ui/generator-options.js`へ移した（挙動を変えないリファクタリング）。また、ブラウザsmoke script 2本（`scripts/run-glb-export-smoke.mjs`の色付き出力でのVite起動判定、`scripts/run-owner-ui-review-smoke.mjs`の通路ドラッグ位置が詳細HUDに隠れる配置での候補切り替え）を修正した。公開E2E（`scripts/run-dai-099-public-smoke.mjs`）を、DAI-100以降のManual確認・画面表示・戦闘バランスに合わせて修正した。公開版の異常入力確認（`scripts/run-dai-100-public-abnormal-input-smoke.mjs`）を追加した。ユーザーの指示で、詳細HUD（Details）の見出しを、中身を折りたためるボタンにした（`apps/editor-slice/index.html`、`main.js`、`i18n.js`の5言語）。素材・依存関係・API payloadは変更していない。検証の範囲は該当PRに記録する。
- PROD-AI-REVIEW-001: GitHub APIで2026-10-18に取得したところ、`copilot-pull-request-reviewer[bot]`によるレビュー817件（2026-09-12〜2026-10-01、PR #1〜#59）と、`Copilot`による行コメント4件（2026-10-01）があった。指摘の採否と反映箇所はPRごとのユーザー判断であり、本記録では特定しない。
- 同じ取得で、`chatgpt-codex-connector[bot]`（OpenAI）によるレビュー・コメント155件（2026-09-12〜2026-10-06）を確認した。OpenAIの開発支援はPROD-AI-DEV-001〜002に記録済みである。DEV-002の期間（〜2026-10-03）より後の2026-10-04〜10-06の分も、同じ種類の自動レビューとしてここに開示する。各セッションの正確なモデル名は、引き続き未確認とする。
- 2026-10-04〜10-06のPR #71〜#79について、上記の自動レビュー以外に開発支援を受けたか、どの範囲で受けたかは、この更新では確認していない。推定では補完しない。

## デモ動画の生成音声・実AI操作（2026-10-03）

- 対象: `DAI_Demo_Review_EN_2026-10-03.mp4` の修正版（150秒、1920 × 1080、30 fps）。SHA-256: `3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8`。公開URL・投稿完了・最終提出の証拠とは区別する。
- 音声: ローカルに保存したKokoro-82M v1.0と `af_heart` をCPUで使用。英語台本からspeed `0.9`、24 kHz mono PCM16の音声を作成し、編集して動画に収録した。ゲーム内Web Audioとは別物で、ゲーム映像そのものは実際のブラウザ操作を録画したもの。
- モデルSHA-256: `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4`。音声ファイル `af_heart.pt` SHA-256: `0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff`。ローカル制作記録のインストール済みバージョン、音声manifest・技術QA・動画配送記録と照合した。モデル／音声重みは本リポジトリに収録しない。
- 撮影時のUI操作はGenerate 1回、AI edit 1回。2階生成と `resize-room` の適用・Undoを観察した。生成のcloud利用は画面出力からの推定であり、生のprovider応答を直接検査した証拠とは区別する。
- 撮影用台帳ではprovider試行を最大3回分予約したが、実際の再試行数・トークン数・請求額は未観測。保守的予算上限32.10円は予約見積りで、実請求額ではない。動画修正時に追加の有料AI操作は行っていない。ローカルTTSによる音声合成に有料APIは使用していない。
- 本更新は利用事実の記録のみ。正式なWindows Chrome受入、全smoke再実行、公開動画URL、最終freezeや提出手続きの完了を意味しない。

Status values used here: `Recorded` for disclosed development or video-production assistance and `Approved` for a reviewed production runtime integration.

## 提出動画glb_v5の追加制作

- 対象: `DAI_Demo_Review_EN_2026-10-03_glb_v5.mp4`（150秒、1920 × 1080、30 fps）。SHA-256: `161f7674bb6963df212118919601b1da284622c234e566a156ea73c93bb17f9e`。2026-10-19に提出動画として採用した。公開URL・投稿完了・最終提出の証拠とは区別する。
- 元にした動画: 上記の150秒v2（SHA-256 `3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8`）。差し替えたのは 0:24〜0:30 と 2:14〜2:25.5 の2区間（JSON / GLB書き出しの比較画面・ナレーション・字幕・強調表示）だけで、JSON側の画面には元のv2の2:21の映像を使った。ほかの映像・音声はv2を引き継ぐ。
- 制作: OpenAIのクラウドAIアシスタント（PROD-AI-VIDEO-002）が、編集・音声合成・描画を実行した。制作セッションの正確なモデル名は記録から確認できないため、別セッションのモデル名は流用しない。
- 追加ナレーション: v2と同じKokoro-82M v1.0、`af_heart`、speed `0.9` で、クラウド環境のCPUを使いオフライン合成した2本（冒頭用5.350秒、後半用9.425秒）。24 kHzで生成し、編集時に48 kHzへ変換して既存音声に音量を合わせた。有料TTSサービスは使っていない。このクラウド環境のKokoroパッケージ・モデル・音声ファイルについて、`PROD-DEP-TTS-001` のようなハッシュ照合は本記録では未確認。
- GLB静止画: アプリの3D構築とGLTFExporterの処理をNodeのテストで動かして出力したGLB（描画部分はテスト用に置き換え）。38メッシュの別サンプル階を読み込み、表示用のカメラと照明だけを加えて、Blender 4.3.2のCycles（CPU）で描画した。元の形状は変えていない。動画内に「Blenderで描画した別サンプル階」と表示している。
- 編集・書き出し: FFmpeg 7.1.5。使用したbuildの取得元と構成は記録がなく、台帳では過去の使用としてPending Evidenceのまま残す。
- アプリの追加撮影はしていない（WebGL2の制約で再撮影できなかったため、既存映像とGLBの描画画像を組み合わせた）。glb_v5の追加制作での有料API呼び出し・追加の生成・AI Editは0回と記録されている。これはv5の追加制作分の記録で、元のv2制作の利用回数とは別。
- 追加のBGMを導入した記録はない。編集していない区間の音声は、再圧縮前の時点でサンプル一致を確認したと記録されている（本リポジトリでは再検証していない）。
- 使用したツールの扱いは [dependency register](THIRD_PARTY_DEPENDENCIES.md) の `PROD-DEP-VIDEO-001`（Blender）と `PROD-DEP-VIDEO-002`（FFmpeg）を参照。

## 動画制作依存関係のレビュー補足

`PROD-AI-VIDEO-001` の `Recorded` はAI利用の開示であり、第三者ソフトウェアの制作用途承認とは別。[TTS toolchain review](TTS_TOOLCHAIN_REVIEW_2026-10-03.md) と [dependency register](THIRD_PARTY_DEPENDENCIES.md) の `PROD-DEP-TTS-001` に、正確なバージョン・取得元・ハッシュ・ライセンス・配布境界を補足した。既存のユーザー承認済みオフライン動画制作範囲について技術レビューを補完し、PyTorchを含む92件の公式配布物とbootstrap pipの実体照合を確認した。依存台帳は既存のオフライン動画制作用途だけApprovedとする。過去のインストール成功ログを復元したとの主張ではない。公開・提出・ソフトウェア／モデルの再配布を本追記で許可しない。
