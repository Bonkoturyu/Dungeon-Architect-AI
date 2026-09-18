# DAI-082 Demo Video

## Status

**IN PROGRESS.** The recording script, shot timing, narration draft, and recording-run evidence are prepared. DAI-082 remains open until an actual final video file is recorded, verified under 180 seconds, and approved for submission.

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
| 0:32–0:48 | Hold generated dungeon + PASS state | Deterministic rooms, entities, Seed and START eligibility |
| 0:48–1:05 | Select/move one room, then Undo | Manual authoring works directly on the generated dungeon |
| 1:05–1:30 | Type verified natural-language edit and apply | AI performs one constrained safe edit through EditCommand |
| 1:30–2:00 | START and traverse connected rooms | Same generated dungeon is immediately playable |
| 2:00–2:12 | Cleared Result | Result proves the loop reaches Goal |
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
> Once validation passes, START freezes the execution snapshot. I can play the generated dungeon immediately, move through connected rooms, reach the goal, and get a cleared Result.
>
> Returning to Edit restores the authoring view so the same generated dungeon can be changed again.
>
> Dungeon Architect AI: Describe. Edit. Play.

This is intentionally shorter than the full 150-second visual budget so narration can breathe and editing can use pauses.

## Automated recording runner

Run:

```powershell
git fetch origin
git switch feat/dai-082-demo-video
git pull --ff-only origin feat/dai-082-demo-video
npm ci --ignore-scripts --no-audit --no-fund
npm run demo:video
```

The runner:

1. opens the public HTTPS candidate in visible Chrome;
2. waits for the operator to start OBS / Windows capture;
3. performs Generate;
4. demonstrates one manual room edit and Undo;
5. performs the verified natural-language edit;
6. STARTs the generated dungeon and clicks through rooms to Goal;
7. shows the cleared Result and Return to Edit;
8. waits for the operator to stop recording.

It writes:

- `artifacts/video/dai-082-recording-run.json`;
- `artifacts/video/dai-082-recording-end.png`.

The JSON validates the scripted run, **not the actual recorded video file**.

## Recording recommendations

Use the supported judging environment already accepted for the project:

- Windows;
- desktop Google Chrome;
- 1440 × 900 or comparable desktop presentation.

Recommended capture settings for a compact submission file:

- 1080p or native window resolution;
- 30 fps;
- browser window only;
- no DevTools;
- no terminal/API-key window in the captured region.

These are recording recommendations, not hackathon requirements.

## Completion gate

DAI-082 may be marked DONE only after the final video file is available and all of the following are checked:

- actual duration is strictly below 180 seconds;
- the video uses the public candidate;
- DESCRIBE → GENERATE is visibly demonstrated;
- manual Edit is visibly demonstrated;
- natural-language partial Edit is visibly demonstrated;
- Validation / START is visible;
- Play reaches Goal and shows Result;
- no provider key/private data is visible;
- no claim exceeds the documented production behavior;
- the final file is suitable for the submission form or its required host.

## Boundaries

- the video is a demonstration, not a substitute for public-demo acceptance;
- PCE Perspective/Combat selection remains Pending Evidence;
- room-graph locomotion must not be narrated as physics/collision gameplay;
- the current AI partial-edit path must not be narrated as unrestricted natural-language editing.
