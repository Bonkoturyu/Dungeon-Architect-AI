# DAI-099 Refreshed Demo Video

## Status

**DONE. FINAL CAPTURE / VISUAL REVIEW ACCEPTED.**

The historical DAI-082 49.5-second M8 video remains historical evidence only.

The refreshed capture was produced from the public candidate after:

1. DAI-097 Audio is merged;
2. DAI-098 multi-floor simulation/balance is merged;
3. the DAI-099 runtime candidate is deployed;
4. refreshed public E2E passes with matching build fingerprint.

## Hard requirement

The final demo video must be **strictly under 180 seconds**.

Internal scripted target: **under 165 seconds**, leaving safety margin for final edits.

## Required current-runtime evidence

The refreshed video must visibly demonstrate:

- Dungeon Architect AI live public page;
- plain-language Generate;
- a **2-floor** generated run;
- valid current authoring surface;
- one manual room edit and Undo;
- one constrained natural-language Edit;
- current **▶ Test** choice;
- current centered Room Event dialog when encountered;
- current directional **CHOOSE EXIT** controls;
- current lower HUD with **LV / HP / EXP / G**;
- current programmatic Player/Enemy presentation when encountered;
- Floor 1 → Floor 2 progression;
- cleared **Floor 2/2** Result;
- Return to Edit.

Audio does not need to be captured for acceptance, but the current 🔊/🔇 control may remain visible.

## Recording source

Use only the refreshed public candidate:

`https://dungeon-architect-ai.pages.dev/`

The public candidate must first pass DAI-099 refreshed public E2E and build-fingerprint matching.

## Automated runner

Run:

```powershell
npm run demo:refreshed-video
```

The runner:

- opens visible Chrome;
- forces fullscreen/maximized presentation;
- suppresses browser translation/extensions noise;
- records only the browser viewport with ffmpeg/gdigrab when available;
- generates two floors using the live cloud path;
- demonstrates manual Edit + Undo;
- demonstrates constrained natural-language Edit;
- starts ▶ Test;
- uses current Room Event buttons and CHOOSE EXIT controls;
- advances through both floors;
- shows cleared Result;
- returns to Edit;
- stops recording and probes the MP4 when ffprobe is available.

Artifacts:

- `artifacts/dai-099-video/dai-099-refreshed-demo.mp4`
- `artifacts/dai-099-video/dai-099-recording-run.json`
- `artifacts/dai-099-video/dai-099-recording-end.png`

## Automated acceptance boundaries

The runner requires:

- HTTPS source;
- live cloud generation;
- two floors;
- successful natural-language Edit;
- current ▶ Test flow;
- Room Event/combat shown;
- second floor shown;
- run cleared;
- Return to Edit;
- zero browser/page/request/HTTP errors;
- scripted interaction duration under 165 seconds;
- when ffmpeg capture is active: viewport capture present, at least 1280×720, and MP4 duration under 180 seconds.

## Manual visual review result

Automation cannot certify final presentation quality by itself. The final MP4 was manually reviewed and the following checks were accepted:

- no browser tabs/address bar;
- no Windows taskbar;
- no terminal;
- no DevTools;
- no translation popup;
- no API key or private data;
- UI text is readable;
- generated dungeon is visually coherent;
- Room Event and Player/Enemy presentation are visible;
- Floor 2/2 Result is visibly understandable;
- no misleading narration claims unrestricted natural-language editing, physics locomotion, or unsupported mobile behavior.

Accepted final MP4: `artifacts/dai-099-video/dai-099-refreshed-demo.mp4`.

- duration: **59.9 seconds**;
- resolution: **1920×1080**;
- frame rate: **30 fps**;
- size: **808130 bytes**;
- SHA-256: `deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7`;
- automated runner: PASS;
- manual visual review: ACCEPTED.
