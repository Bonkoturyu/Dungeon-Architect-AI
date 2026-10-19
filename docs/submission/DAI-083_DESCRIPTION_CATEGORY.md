# DAI-083 Submission Description / Focus Category

## Status

**DONE.** The short description and final focus category are frozen for the current submission candidate and passed deterministic metadata/public-doc validation on 2026-09-19.

## Official submission requirement

The organizer asks for:

- a short-written description explaining what was built;
- the problem or opportunity explored;
- how AI is used;
- a chosen focus category.

Current public sources do not state a character or word limit for the short description.

## Focus category

**AI 3D Scene Generation**

Public category source:

- Kaggle competition track: https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract
- Victoria VR build-period guidance: https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3

The public Kaggle track describes this category as tools that transform plain-language prompts into 3D environments, objects, layouts, or full interactive scenes directly in the browser.

Dungeon Architect AI matches that definition through verified production behavior:

- plain-language dungeon request;
- cloud AI → validated `DesignIntent`;
- deterministic `DesignIntent → DungeonSpec`;
- rendered low-poly 3D dungeon in the browser;
- manual and constrained natural-language editing;
- validation;
- immediate browser Play / Result loop.

## Primary short description

Use this text when the form accepts approximately 500 characters or more:

> Dungeon Architect AI is a browser-based tool that turns plain-language game-design intent into a validated, editable, playable low-poly 3D dungeon. It addresses the gap between describing a level and building a functional prototype: an LLM converts the prompt into structured DesignIntent, deterministic generation produces a DungeonSpec, and the same browser experience lets users edit, validate, and play the result. AI also supports constrained natural-language edits without generating arbitrary runtime code.

Measured length:

- 513 characters;
- 70 whitespace-delimited words.

## Compact fallback

Use this only if the final form exposes a tighter limit:

> Dungeon Architect AI turns plain-language design intent into validated, editable, playable low-poly 3D dungeons in the browser, using AI for structured DesignIntent generation and constrained natural-language edits.

Measured length:

- 215 characters;
- 27 whitespace-delimited words.

## Claim boundaries

The submission text intentionally does **not** claim:

- arbitrary free-form runtime-code generation;
- unrestricted multi-command natural-language editing;
- physics-character locomotion;
- final Perspective / Combat selection;
- mobile support;
- persistent accounts or cloud project storage.

## Production evidence basis

The chosen metadata is grounded in the current production candidate:

- DAI-081 public hosted flow: DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT;
- DAI-026 corrected continuous orthogonal corridor presentation;
- DAI-082 final public-demo video;
- current production README / Judge Quick Start / Known Limitations.

## Production validation evidence

Reviewed DAI-083 metadata evidence:

- generated: `2026-09-19T07:20:44.087Z`;
- Node.js: `v24.15.0`;
- `passed = true`;
- all 8 metadata checks passed;
- category: `AI 3D Scene Generation`;
- primary description: 513 characters / 70 words;
- compact fallback: 215 characters / 27 words;
- decision closure and checklist closure both passed;
- evidence JSON SHA-256: `1458ca9cd1ec00aca0ac23547df1f55aafc217c50763ef0a1d9db3b53585d6cb`.

The accompanying public-document revalidation also passed all 12 checks with no missing local links or placeholder findings.

Public-doc evidence JSON SHA-256:

`c9dbc48df13f980fba8161fcff282716d797def70eabcd095c215d9f24f420d1`

## 2026-10-19 再確認

説明文とカテゴリは変更しない。公開候補 `806d70c` の画面で、説明文が述べる流れ（自然言語の依頼 → 検証済みDesignIntent → 決定的なDungeonSpec → 3D表示 → 手動とAIの単一コマンド編集 → 検証 → Play / Result）がすべて現存することを、[公開候補の記録](../testing/PUBLIC_CANDIDATE_806D70C_2026-10-19.md)と照合した。上の「Production evidence basis」にあるDAI-081 / DAI-082は当時の根拠で、現在の提出動画は [DEMO_STORYBOARD](DEMO_STORYBOARD.md) の150秒版である。説明文はGLB書き出しに触れていないが、主張を狭める方向の省略なので再開条件には当たらない。

## Reopen conditions

Reopen DAI-083 if:

1. the final submission form exposes a focus-category list that does not contain `AI 3D Scene Generation`;
2. the final form imposes a description limit below 513 characters and the compact fallback is still too long;
3. production behavior changes enough that the wording becomes inaccurate;
4. organizer guidance changes the required submission metadata.
