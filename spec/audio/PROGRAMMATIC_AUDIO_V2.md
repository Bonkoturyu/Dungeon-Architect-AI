# Programmatic Audio Presentation V2

## Status

DAI-100 audio-polish candidate.

V2 extends DAI-097 without introducing external creative assets or changing gameplay state.

## Goals

The original DAI-097 layer proved the Web Audio boundary with quiet static pads and event cues. V2 makes the presentation deliberately musical while preserving the same lightweight browser-first architecture.

V2 adds:

- long-form deterministic mode motifs scheduled directly on Web Audio oscillator frequency automation;
- smoother mode crossfades;
- separate BGM and SE mix levels;
- compact BGM/SE controls in the header;
- stronger generated / play-start / floor-advance / clear / fail presentation cues;
- the same project-authored, zero-external-audio-asset provenance.

## Modes

The externally visible mode vocabulary remains:

- `edit`
- `play`
- `result-cleared`
- `result-failed`

Each mode now owns a small deterministic multi-voice program rather than a fixed drone.

### Edit

Calm low drone + sparse construction motif.

### Play

Lower tense bass + repeating exploration figure.

### Result — cleared

Ascending consonant motif.

### Result — failed

Descending low motif with rests.

The runtime keeps a rolling deterministic Web Audio schedule rather than stopping after one precomputed window.

When a mode begins, each voice receives an initial long-form automation chunk. A lightweight scheduler then maintains at least 180 seconds of future automation by appending additional 72-step chunks. The scheduler runs every 15 seconds, does not restart the active motif, and is cleared when voices are retired or the audio presentation is disposed.

This preserves sample-free project-authored audio while making the BGM genuinely continuous for arbitrarily long Edit/Play sessions.

## Crossfade

Changing BGM mode:

1. keeps the old voices connected;
2. cancels their future automation at the transition point;
3. fades them down over the V2 crossfade window;
4. starts the new mode voices from silence;
5. stops/disconnects retired oscillators after the fade.

Repeated UI renders in the same mode do not restart the current motif.

## Mix controls

V2 exposes independent normalized levels:

- `bgmVolume` — default `0.58`
- `seVolume` — default `0.78`

The browser header exposes compact 0–100 sliders.

Mute remains a separate master-gain control and does not overwrite the BGM/SE mix values.

No persistent browser storage is introduced; refreshing the page restores the authored defaults.

## Autoplay boundary

Unchanged from V1:

- no AudioContext is created at module load;
- first pointer/keyboard gesture unlocks Web Audio;
- gameplay remains functional if Web Audio is unavailable.

## Provenance / licensing

Implementation remains:

`packages/audio-presentation/src/programmatic-audio.js`

Provenance marker remains:

`project-authored-programmatic-web-audio`

V2 contains no:

- sampled music;
- WAV/MP3/OGG/FLAC assets;
- MIDI file;
- third-party composition;
- AI-generated audio file;
- network audio request.

All frequencies, waveforms, envelopes, motif sequences and timing constants are project source code.

## Acceptance

The first DAI-100 audio-polish gate requires:

1. audio unit tests pass;
2. V2 reports separate BGM/SE mix levels;
3. invalid mix values fail closed;
4. BGM modes maintain a continuous rolling schedule beyond the initial motif window;
5. the loop scheduler extends future oscillator automation and is cleared on disposal;
6. mode changes retain the accepted mode vocabulary and crossfade;
6. mute/unmute remains functional;
7. browser mixer sliders update runtime state;
8. gameplay cues remain wired;
9. no external audio element/request appears;
10. owner UI regression remains green;
11. production hosting build remains green;
12. legal/provenance audit remains green.

## Reactive intensity extension

DAI-100 adds a presentation-only reactive intensity layer without changing the externally visible Audio V2 mode vocabulary.

The Web Audio graph now separates user-authored mixer levels from runtime presentation intensity:

```text
BGM voices → user BGM gain → reactive BGM gain → master
SE cues    → user SE gain  → reactive SE gain  → master
```

The BGM/SE sliders continue to represent only the user mix. Reactive intensity never rewrites those values.

### Inputs

Reactive intensity is derived from:

- current audio mode;
- bounded DesignIntent pressure axes:
  - `tension`;
  - `combatDensity`;
  - `trapDensity`;
  - `targetDifficulty`;
- active Enemy count in the current Room;
- armed Trap count in the current Room;
- current Player HP ratio.

The derivation is deterministic and presentation-only.

### Presentation states

- Edit uses a low bounded intensity.
- Play without blocking danger uses an exploration intensity derived from DesignIntent.
- Active Enemy presence raises the profile to `encounter`.
- Armed Trap presence without an Enemy raises the profile to `danger`.
- Low HP adds a bounded stress component without changing gameplay.
- Resolving the Room danger automatically returns the profile toward exploration.
- Result clear/fail use bounded result-specific intensity while keeping their existing BGM modes.
- Floor advance keeps the Play motif continuous; the existing `floor-advance` cue marks the transition while the new Floor starts from its current-room intensity.

### Gain bounds

Reactive presentation gains are deliberately narrow:

- BGM multiplier: `0.82..1.18`;
- SE multiplier: `0.94..1.06`;
- transition ramp: `0.28 s`.

This avoids sudden loudness changes and keeps the user mixer authoritative.

### Runtime boundary

Reactive intensity does not mutate:

- DungeonSpec;
- Play Core state;
- Run Core state;
- Player HP or rewards;
- BGM/SE user slider values;
- audio asset provenance.

No external audio assets, Audio elements, samples, or network audio requests are introduced.

### Acceptance

Dedicated gate:

`npm run validate:dai-100-reactive-audio`

The gate covers:

1. Audio V2 + reactive-intensity unit tests;
2. the existing DAI-097/100 audio regression smoke;
3. reactive visible-Chrome exploration → encounter → resolution → Result → Edit flow;
4. browser performance regression;
5. Owner UI regression;
6. production hosting build;
7. legal/provenance audit;
8. syntax validation;
9. git diff/whitespace check.

Automated acceptance remains separate from the required owner listening review.
