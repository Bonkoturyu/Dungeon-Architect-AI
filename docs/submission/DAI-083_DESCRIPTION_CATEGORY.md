# DAI-083 Submission Description and Focus Category

## Current revision 2026-10-29

**Review-branch document revision, not a final submission or a change to the deployed runtime.** This revision responds to the new judging weights in the user-provided Discord announcement screenshot: ClaudiaS, #announcements, 2026-10-29. No message URL was supplied and the announcement has not been independently web-verified here.

| Judging criterion | Weight | What this copy makes explicit |
|---|---|---|
| Impact | 30% | Game creators and the gap between a level idea and a testable prototype; no measured adoption or time-saving claim |
| Generalizability Beyond Demo | 25% | Renderer-independent DungeonSpec, multiple strategies sharing editor/play, and bounded JSON/GLB outputs |
| Technical Depth | 20% | Validated AI data, explicit commands, deterministic generation and separated authoring/play state |
| Demo Quality | 25% | A followable generate, edit, validate, play and export workflow with disclosed limits |

The application scope, focus category and runtime remain unchanged. Source-document baseline: `main` at `6a4a2b1dbe957709cad86d8589ae95cafb474993`. Runtime baseline: `806d70c2be99863a2b14dbabf942422107898379`, as recorded in the [2026-10-20 freeze](FINAL_FREEZE_2026-10-20.md). The form's actual field limits and mandatory language still need confirmation; do not infer them from these versions.

## Focus category

**AI 3D Scene Generation**

The category remains the existing project decision. Its recorded external sources are the [Kaggle category page](https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract) and [build-period guidance](https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3). These links identify the original decision sources, not a new 2026-10-29 web verification.

## Primary short description

Use when the final field accepts at least the measured character count below. Use the expanded text or separate fields to supply how-to, tools and build-period details.

<!-- submission-copy:primary:start -->
> Dungeon Architect AI helps indie level designers turn level ideas into editable, playable low-poly 3D dungeon prototypes in the browser. AI produces validated design intent and one supported edit command per edit request; deterministic generators build the layout. A renderer-independent DungeonSpec connects multiple generation strategies to one editor and play loop. Full JSON supports re-editing, Layout JSON exchanges layouts, and GLB exports one floor's static appearance for other 3D tools.
<!-- submission-copy:primary:end -->

Measured length: **496 characters / 70 whitespace-delimited words**.

日本語の狙い: 冒頭でゲーム制作者と試作品づくりの課題を示し、機能の列挙だけにしない。再利用はDungeonSpec、共通editor/play、実装済みの入出力に限定する。GLBの他ツール利用は1階の静的外観であり、ゲーム機能の移植を意味しない。

## Compact fallback

Use only for a tighter short-description field. This version alone does not cover every detail requested in the earlier submission guide.

<!-- submission-copy:compact:start -->
> Dungeon Architect AI helps indie level designers prototype playable 3D dungeons in the browser, with validated AI intent, constrained editing, and reusable dungeon data across generation strategies.
<!-- submission-copy:compact:end -->

Measured length: **198 characters / 27 whitespace-delimited words**.

日本語の狙い: 対象者、成果物、AIの制約、複数方式で共用するデータという核を残す。短縮で省いた使い方・技術・制作範囲は、別欄または補足資料へ入れる。

## Expanded submission description

Use for a long-description field or split into the form's corresponding required fields. The final form's limit is not yet confirmed.

<!-- submission-copy:expanded:start -->
> Dungeon Architect AI helps indie level designers turn level ideas into editable, playable low-poly 3D dungeon prototypes in the browser. It brings generation, refinement and playtesting into one authoring workflow. The intended benefit is a shorter path from an idea to a testable level; adoption and time savings have not yet been measured.
>
> Open the demo in desktop Chrome on Windows. Describe a dungeon, choose settings, generate it, and review the plan in Manual mode. Switch to Edit to adjust rooms, corridors and entities, or request one supported natural-language edit at a time. Check validation, then use Play > Test to explore the current dungeon across floors and inspect the Result. Return to Edit to refine it.
>
> AI translates prompts into schema-validated DesignIntent or a single supported EditCommand; it does not generate or execute arbitrary runtime code. Deterministic application logic builds DungeonSpec, validates authoring changes and runs gameplay. Generation is reproducible for the same normalized input, Seed, settings, strategy and version, not necessarily for a fresh live-model response. Play uses a fixed snapshot and does not mutate authoring state.
>
> A renderer-independent DungeonSpec connects 11 selectable generation strategies to the same editor, validator and play loop. These are not 11 independent terrain algorithms: V3 shares V2 terrain. Full JSON preserves all floors' authoring data for re-editing, not in-progress play saves. Layout JSON exchanges rooms, corridors and Start/Goal roles without gameplay content. GLB exports the displayed floor's static geometry and materials for other 3D tools, without gameplay or re-import into this app. This is implemented reuse within the dungeon workflow; reuse in other domains remains a future possibility.
>
> The app uses JavaScript, Three.js, the OpenAI Responses API, and Cloudflare Pages with Pages Functions. Development and testing use Node.js, Vite and Playwright. OpenAI assistants and Claude Code supported development and documentation; GitHub Copilot provided pull-request review. The demo video uses Kokoro-generated English narration, separate from the browser runtime.
>
> During the hackathon build period, production work from September 12 through October 19 included the renderer, AI integration, deterministic generation, editing and validation, multi-floor gameplay, JSON import/export, GLB export and testing. The October 20 freeze records runtime commit 806d70c. Repository records describe earlier research as input to specifications and design decisions, with a separate production implementation rather than copied pre-production experiment source code.
<!-- submission-copy:expanded:end -->

Measured length: **2657 characters / 378 whitespace-delimited words**.

日本語の狙い: 使い方、技術、実行時AI、開発支援AI、動画音声、期間内制作範囲を分けて説明する。効果は利用者実測ではなく、実装された試作工程の統合として示す。外部ドメインへの展開は将来の可能性に留める。制作期間・clean-roomの記述は既存の記録に基づき、全ソースの独立鑑定をしたとは主張しない。

## AI role for a separate form field

<!-- submission-copy:ai_role:start -->
> AI translates a level-design prompt into schema-validated DesignIntent, or one natural-language edit request into one supported EditCommand. Independent validation and editor preflight check outputs before application. Dungeon generation and gameplay use application logic; AI does not generate or execute arbitrary runtime code. Live-model responses are not claimed to be deterministic.
<!-- submission-copy:ai_role:end -->

Measured length: **387 characters / 50 whitespace-delimited words**.

開発支援・レビュー・動画制作の開示は [AI Usage Register](../legal/AI_USAGE.md) に従う。記録にない正確なモデル名、呼出回数、費用を推定で加えない。今回の2026-10-29の文章改訂もOpenAI AIアシスタントによる支援であり、アプリruntime・素材・依存関係の追加ではない。

## Claim boundaries

- Impact is the intended benefit to indie level designers. Adoption, retention, productivity gains and time savings are unmeasured.
- Generalizability already implemented: renderer-independent DungeonSpec; multiple generation strategies feeding the common editor, validation and play workflow; Full JSON, Layout JSON and static GLB outputs. This does not demonstrate other-domain deployments or a universal 3D authoring framework.
- Eleven selectable strategies do not mean eleven independent terrain algorithms. V3 shares V2 terrain; Algorithm Lab remains experimental.
- Deterministic generation requires the same normalized input, Seed, settings, strategy and version. A fresh live-model interpretation need not be identical.
- Natural-language editing applies one supported command per request. No unrestricted multi-command natural-language editing or arbitrary free-form runtime-code generation is claimed.
- Validation is bounded. It does not prove that every possible play choice wins or that every authoring edit is automatically repaired.
- Full JSON is authoring data, not persistent play saves. Layout JSON omits gameplay content. GLB contains one displayed floor's static geometry/materials, no gameplay, and no re-import into this app.
- No physics-character locomotion, final Perspective / Combat selection, mobile support, Safari/Firefox acceptance, or persistent accounts or cloud project storage is claimed.
- Repository visibility remains private in the latest supplied status. This edit is not evidence of publication, video upload or final submission.

See [Known Limitations](KNOWN_LIMITATIONS.md) and [GLB export scope](../architecture/GLB_EXPORT.md).

## Evidence and verification scope

- [Public candidate 806d70c record](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md): historical local 24/24 stages, Node 694/694, and public E2E 22/22 with live Generate/AI Edit and two-floor completion.
- [2026-10-20 freeze](FINAL_FREEZE_2026-10-20.md): historical runtime/video identities, separate abnormal-input and DAI-090 Final evidence, rollback, and remaining publication/submission work.
- [README](../../README.md), [Judge Quick Start](JUDGE_QUICKSTART.md), [GLB export architecture](../architecture/GLB_EXPORT.md), and [AI Usage Register](../legal/AI_USAGE.md): workflow, data boundaries, technology and provenance.
- 2026-10-29 local text validation counts the marked current copy, not quoted historical text. Character counts include spaces and paragraph breaks, excluding Markdown quote markers and trailing newline; word counts use whitespace splitting.
- The 2026-09-19 metadata audit and the 2026-10-19 suite below concern earlier wording. They are not PASS evidence for this revision. The previous metadata audit hard-coded the old text and counts; retaining that text in the appendix must not be mistaken for validating the new copy.
- 2026-10-29 scoped metadata audit: 13/13 checks PASS; its focused regression tests: 7/7 PASS on cloud Linux / Node 24.22.1. Historical-only copy, markers moved into history, duplicate markers, stale counts and missing required current content fail the relevant checks.
- No new Windows browser acceptance, live-provider acceptance or whole-suite rerun is claimed for this document-only revision.

## Reopen conditions

Recheck the copy if the final form has a different category, insufficient text space, newly required fields, changed organizer guidance, or a runtime change affecting the claims. Preserve the runtime freeze unless separately authorized to change it.

## Historical description and evidence through 2026-10-19

**Historical record only.** The quoted text below is the complete previous document, including its old frozen wording, 513/215-character measurements, status and evidence. Those counts and PASS results do not apply to the revised text above.

> # DAI-083 Submission Description / Focus Category
>
> ## Status
>
> **DONE.** The short description and final focus category are frozen for the current submission candidate and passed deterministic metadata/public-doc validation on 2026-09-19.
>
> ## Official submission requirement
>
> The organizer asks for:
>
> - a short-written description explaining what was built;
> - the problem or opportunity explored;
> - how AI is used;
> - a chosen focus category.
>
> Current public sources do not state a character or word limit for the short description.
>
> ## Focus category
>
> **AI 3D Scene Generation**
>
> Public category source:
>
> - Kaggle competition track: https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract
> - Victoria VR build-period guidance: https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3
>
> The public Kaggle track describes this category as tools that transform plain-language prompts into 3D environments, objects, layouts, or full interactive scenes directly in the browser.
>
> Dungeon Architect AI matches that definition through verified production behavior:
>
> - plain-language dungeon request;
> - cloud AI → validated `DesignIntent`;
> - deterministic `DesignIntent → DungeonSpec`;
> - rendered low-poly 3D dungeon in the browser;
> - manual and constrained natural-language editing;
> - validation;
> - immediate browser Play / Result loop.
>
> ## Primary short description
>
> Use this text when the form accepts approximately 500 characters or more:
>
> > Dungeon Architect AI is a browser-based tool that turns plain-language game-design intent into a validated, editable, playable low-poly 3D dungeon. It addresses the gap between describing a level and building a functional prototype: an LLM converts the prompt into structured DesignIntent, deterministic generation produces a DungeonSpec, and the same browser experience lets users edit, validate, and play the result. AI also supports constrained natural-language edits without generating arbitrary runtime code.
>
> Measured length:
>
> - 513 characters;
> - 70 whitespace-delimited words.
>
> ## Compact fallback
>
> Use this only if the final form exposes a tighter limit:
>
> > Dungeon Architect AI turns plain-language design intent into validated, editable, playable low-poly 3D dungeons in the browser, using AI for structured DesignIntent generation and constrained natural-language edits.
>
> Measured length:
>
> - 215 characters;
> - 27 whitespace-delimited words.
>
> ## Claim boundaries
>
> The submission text intentionally does **not** claim:
>
> - arbitrary free-form runtime-code generation;
> - unrestricted multi-command natural-language editing;
> - physics-character locomotion;
> - final Perspective / Combat selection;
> - mobile support;
> - persistent accounts or cloud project storage.
>
> ## Production evidence basis
>
> The chosen metadata is grounded in the current production candidate:
>
> - DAI-081 public hosted flow: DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT;
> - DAI-026 corrected continuous orthogonal corridor presentation;
> - DAI-082 final public-demo video;
> - current production README / Judge Quick Start / Known Limitations.
>
> ## Production validation evidence
>
> Reviewed DAI-083 metadata evidence:
>
> - generated: `2026-09-19T07:20:44.087Z`;
> - Node.js: `v24.15.0`;
> - `passed = true`;
> - all 8 metadata checks passed;
> - category: `AI 3D Scene Generation`;
> - primary description: 513 characters / 70 words;
> - compact fallback: 215 characters / 27 words;
> - decision closure and checklist closure both passed;
> - evidence JSON SHA-256: `1458ca9cd1ec00aca0ac23547df1f55aafc217c50763ef0a1d9db3b53585d6cb`.
>
> The accompanying public-document revalidation also passed all 12 checks with no missing local links or placeholder findings.
>
> Public-doc evidence JSON SHA-256:
>
> `c9dbc48df13f980fba8161fcff282716d797def70eabcd095c215d9f24f420d1`
>
> ## 2026-10-19 再確認
>
> 説明文とカテゴリは変更しない。公開候補 `806d70c` の画面で、説明文が述べる流れ（自然言語の依頼 → 検証済みDesignIntent → 決定的なDungeonSpec → 3D表示 → 手動とAIの単一コマンド編集 → 検証 → Play / Result）がすべて現存することを、[公開候補の記録](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md)と照合した。上の「Production evidence basis」にあるDAI-081 / DAI-082は当時の根拠で、現在の提出動画は [DEMO_STORYBOARD](DEMO_STORYBOARD.md) の150秒版である。説明文はGLB書き出しに触れていないが、主張を狭める方向の省略なので再開条件には当たらない。
>
> ## Reopen conditions
>
> Reopen DAI-083 if:
>
> 1. the final submission form exposes a focus-category list that does not contain `AI 3D Scene Generation`;
> 2. the final form imposes a description limit below 513 characters and the compact fallback is still too long;
> 3. production behavior changes enough that the wording becomes inaccurate;
> 4. organizer guidance changes the required submission metadata.
>
