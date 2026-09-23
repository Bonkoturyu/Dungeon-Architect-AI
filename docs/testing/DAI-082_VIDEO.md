# DAI-082 Demo Video

## Status

**REFRESH REQUIRED.** The 2026-09-19 corrected-corridor capture remains accepted historical evidence for the pre-polish candidate. DAI-085–088 changed the judge-facing Play UX, so a new public-demo capture is required after redeployment and refreshed DAI-081 public E2E.

## Official requirement

The hackathon production requirements require a **demo video under 3 minutes**.

No additional video-format, narration, resolution, or audio requirement is recorded in the current repository requirements.

## Recording source

Use only the verified public candidate:

https://dungeon-architect-ai.pages.dev/

Do not record isolated test harnesses in a way that implies they are the judge-facing product.

## Target length

- hard submission limit: **< 180 seconds**;
- internal target: **120–150 seconds**;
- leave at least 20–30 seconds of safety margin for titles/cuts.

## Shot plan

| Target time | Visual | Point to communicate |
| --- | --- | --- |
| 0:00–0:08 | Product title / live demo opening | “Dungeon Architect AI — Describe. Edit. Play.” |
| 0:08–0:32 | Type generation prompt and Generate | Plain language becomes validated design intent and a 3D dungeon |
| 0:32–0:48 | Hold generated dungeon + `✓ Valid` state | Deterministic rooms/entities and Play eligibility |
| 0:48–1:05 | Select/move one room, then Undo | Manual authoring works directly on the generated dungeon |
| 1:05–1:30 | Type verified natural-language edit and apply | AI performs one constrained safe edit through EditCommand |
| 1:30–2:00 | ▶ Test, resolve Room Events, navigate with CHOOSE EXIT | Same generated dungeon is immediately explorable under Fog of War |
| 2:00–2:12 | `✓ CLEARED` Result + metrics | Result proves the loop reaches Goal and working interactions executed |
| 2:12–2:22 | Return to Edit | Authoring state remains available after Play |
| 2:22–2:30 | End card | Live URL + “Describe. Edit. Play.” |

The recording runner intentionally targets the central 0:08–2:22 interaction segment. Title/end cards may be added in the editor.

## Narration draft

> Dungeon Architect AI turns plain-language design intent into a playable 3D dungeon in the browser.
>
> I’ll ask for a fair but tense five-minute dungeon with exploration and dangerous rewards. The request is translated through the cloud AI path into validated DesignIntent, then the browser deterministically builds the DungeonSpec.
>
> The result is immediately validated. I can also edit it directly: rooms and entities use explicit authoring commands with Undo and Redo.
>
> Natural-language editing uses the same safe command boundary. Here I ask to move the treasure to the room containing the goal, and the AI returns one constrained EditCommand instead of arbitrary runtime code.
>
> Once validation passes, ▶ Test freezes the current authored dungeon into an execution snapshot. Play reveals only explored rooms, Room Events expose working logic, and the directional exit pad maps the route as I move toward the goal.
>
> Returning to Edit restores the authoring view so the same generated dungeon can be changed again.
>
> Dungeon Architect AI: Describe. Edit. Play.

This is intentionally shorter than the full 150-second visual budget so narration can breathe and editing can use pauses.

## Automated recording runner

Run:

```powershell
git fetch origin
git switch feat/dai-082-demo-video-corrected
git pull --ff-only origin feat/dai-082-demo-video-corrected
npm ci --ignore-scripts --no-audit --no-fund
npm run demo:video
```

The runner:

1. opens the public HTTPS candidate in visible Chrome;
2. detects `ffmpeg` / `ffprobe` from PATH;
3. when ffmpeg is available, forces Chrome fullscreen through CDP, disables extensions/translation UI, computes the page viewport screen rectangle, and records only that viewport region with `gdigrab` at 30 fps;
4. performs Generate;
5. demonstrates one manual room edit and Undo;
6. performs the verified natural-language edit;
7. selects Play, starts ▶ Test, resolves blocking Room Events, and traverses visible exit controls to Goal;
8. shows the `✓ CLEARED` Result and Return to Edit;
9. stops ffmpeg cleanly and probes the resulting MP4 duration.

If ffmpeg is unavailable or `DAI_RECORD_WITH_FFMPEG=0`, the runner falls back to manual OBS / Windows capture.

It writes:

- `artifacts/video/dai-082-demo-capture.mp4` when ffmpeg is available;
- `artifacts/video/dai-082-recording-run.json`;
- `artifacts/video/dai-082-recording-end.png`.

The JSON records scripted-run checks and ffprobe duration metadata when available. Final visual/content approval still requires reviewing the MP4 itself.

## Recording recommendations

Use the supported judging environment already accepted for the project:

- Windows;
- desktop Google Chrome;
- 1440 × 900 or comparable desktop presentation.

Automatic ffmpeg capture uses H.264 (`libx264`), 30 fps, CRF 20, `yuv420p`, and `faststart`. Chrome is forced to fullscreen through CDP, extensions/translation UI are disabled, and ffmpeg records only the page viewport. The runner now fails if the resulting page viewport is narrower than 1280×720 or if its left edge appears trimmed. Recommended capture settings for any manual alternative are:

- 1080p or native window resolution;
- 30 fps;
- browser window only;
- no DevTools;
- no terminal/API-key window in the captured region.

These are recording recommendations, not hackathon requirements.

## Final production evidence

Final reviewed capture:

- source: `https://dungeon-architect-ai.pages.dev/`;
- MP4 duration: **49.5 seconds**;
- resolution: **1920×1080**;
- frame rate: **30 fps**;
- video SHA-256: `98ff93bb95491ea38ec7700f3d2313b99f6aa9a70aa4b2c1dceaff441a6ee25d`;
- recording-run JSON SHA-256: `aa37f503689e42b0f688668a62b27f8ed42e412bda1d651bed8d451018f1dd64`;
- recording-end PNG SHA-256: `7d735b7d1d430920637a0fe4714e740ed49f05514750984394d2c4ae3009eb93`;
- video-plan JSON SHA-256: `3dcd7f003ec5d31c3111099de1886781bfdac17dc2dc84686921dadb61f62fbb`.

Automated run checks passed for:

- public HTTPS;
- live cloud generation;
- valid generated dungeon;
- natural-language edit;
- cleared Result;
- Return to Edit;
- zero browser/page/request/HTTP errors;
- script duration below 165 seconds;
- actual capture created;
- browser-viewport-only capture;
- viewport at least 1280×720;
- left edge not trimmed;
- actual capture under 180 seconds.

Visual review of the MP4 confirmed:

- no Chrome tabs/address bar;
- no Windows taskbar or terminal;
- no translation popup;
- the full `DAI Editor / Play Gate` title is visible;
- corrected DAI-026 orthogonal corridor geometry is visible and continuous;
- Generate is shown;
- manual room move and Undo are shown;
- the natural-language treasure relocation request is shown;
- the historical START / Play flow is shown (superseded by the DAI-085–088 `▶ Test` / exit-pad UX for the refreshed capture);
- the historical `RESULT: cleared` state is shown (superseded by `✓ CLEARED` for the refreshed capture);
- Return to Edit is shown;
- no provider key/private data is visible.

The final capture is intentionally concise at 49.5 seconds. The hackathon requirement is only that the demo video be under 3 minutes; no minimum duration, narration, or audio requirement is recorded in the current official-requirements snapshot.

## Historical M8 completion gate — 2026-09-19

The reviewed 49.5-second M8 capture remains valid historical evidence for the candidate that existed at that time. It demonstrated:

- public HTTPS candidate;
- DESCRIBE → GENERATE;
- manual room Edit and Undo;
- one constrained natural-language Edit;
- the then-current START / Play flow reaching a cleared Result;
- Return to Edit;
- no browser chrome, desktop taskbar, terminal, translation popup, provider key, or private data;
- duration strictly below 180 seconds.

It **does not** demonstrate the later DAI-085–096 / 2026-09-23 judge-facing Play UI, including the current ▶ Test / Mystery presentation, centered Room Event stack, programmatic Player/Enemy presentation, multi-floor run behavior, or the current lower-center Play HUD.

## Refreshed DAI-099 video gate — PENDING

Before final submission, DAI-099 must capture and visually approve a new public-demo video using the refreshed deployed candidate.

Required checks for that refreshed capture:

- actual duration strictly below 180 seconds;
- source is the refreshed public candidate;
- DESCRIBE → GENERATE is visibly demonstrated;
- manual Edit remains visibly demonstrated;
- constrained natural-language Edit remains visibly demonstrated;
- current validation / Play choice is visible;
- current ▶ Test flow is shown;
- current Room Event dialog stack and directional exit controls are shown;
- current Player/Enemy presentation is visible where encountered;
- current Result is shown after a successful run;
- Return to Edit is shown;
- no browser chrome, desktop taskbar, terminal, translation popup, provider key, or private data;
- no claim exceeds the documented production behavior.

Until those checks are performed against the refreshed public candidate, the submission video status remains **REFRESH REQUIRED**.

## Boundaries

- the video is a demonstration, not a substitute for public-demo acceptance;
- PCE Perspective/Combat selection remains Pending Evidence;
- room-graph locomotion must not be narrated as physics/collision gameplay;
- the current AI partial-edit path must not be narrated as unrestricted natural-language editing.
