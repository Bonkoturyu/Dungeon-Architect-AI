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

The current implementation schedules more than two minutes of deterministic motif automation when a mode begins. This avoids JavaScript interval timers and keeps the AudioContext graph simple.

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
4. BGM modes schedule long-form motifs;
5. mode changes retain the accepted mode vocabulary and crossfade;
6. mute/unmute remains functional;
7. browser mixer sliders update runtime state;
8. gameplay cues remain wired;
9. no external audio element/request appears;
10. owner UI regression remains green;
11. production hosting build remains green;
12. legal/provenance audit remains green.
