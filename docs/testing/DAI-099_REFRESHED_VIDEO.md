# DAI-099 Refreshed Demo Video

## 現在保持する動画候補（2026-10-04）

**150-second v2 を維持。新規撮影は行いません。**

- ファイル: `DAI_Demo_Review_EN_2026-10-03.mp4` の修正版
- SHA-256: `3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8`
- 150秒、1920×1080、30 fps
- Generate 1回、AI Editの `resize-room` とUndoを記録。その他の映像・音声・来歴と検証限界は [AI usage register](../legal/AI_USAGE.md) を参照
- 公開アップロード・最終提出の完了は主張しません。現UI・candidateとの整合および残る確認は [PR #74](https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74) を参照

旧M8の49.5秒動画、旧DAI-099の59.9秒動画は歴史的証拠として保持します。以下の旧撮影計画／runnerは現在の150秒v2を作成・再検証した証拠ではありません。候補の確認では matching build fingerprint と動画identityを区別します。

## 2026-10-05 runner検査の補強

- 以下のrunnerを今後使う場合、候補local buildとpassedのpublic-E2Eのcommit/sourceが一致し、録画前後の公開build-infoがそのpublic-E2Eで検証したcommit/source/bundleと一致することを必須とします
- 自動captureを無効にした場合も、今回のrun開始後に新規作成・更新されたMP4、以前と異なるSHA-256、正のfile size、ffprobeのvideo stream/MP4形式/180秒未満のdurationが必要です。interactionのみの実行や残存MP4をPASSにしません
- freeze時はrecording evidenceのcapture SHA-256/sizeと実fileを再照合します。public-doc auditの成功とsource/distの再計算も必要です
- これは検証scriptの修正であり、保持中の150秒v2の再撮影、公開、再probe、現runtimeとの一致確認を実施した記録ではありません

## 歴史的DAI-099撮影計画・自動runner（2026-09）

### Historical status

**PENDING FINAL CAPTURE / VISUAL REVIEW.**

The historical DAI-082 49.5-second M8 video remains historical evidence only.

DAI-099 requires a new capture from the refreshed public candidate after:

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

## Manual visual review still required

Automation cannot certify the final presentation quality.

Before final freeze, manually confirm:

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

上記の旧計画時点では final MP4 SHA-256 とレビュー済みdurationは **PENDING** でした。現在保持する150秒v2のidentityは冒頭に記録しており、旧runnerのPASSをその動画の再検証に読み替えません。
