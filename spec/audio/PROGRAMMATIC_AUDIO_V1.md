# Programmatic Audio Presentation V1

## Scope

DAI-097 adds browser audio presentation without introducing any external creative-asset file.

The implementation uses the Web Audio API to synthesize:

- mode BGM for Edit, Play, cleared Result, and failed Result;
- short sound-effect cues for generation and gameplay actions.

No `.wav`, `.mp3`, `.ogg`, `.flac`, MIDI, sampled instrument, third-party music, or AI-generated audio file is required.

## Architecture boundary

Audio presentation is a disposable browser presentation layer.

- `DungeonSpec` contains no audio node, AudioContext, sample, or asset reference.
- Play Core and Run Core remain audio-independent.
- gameplay functions return state/results exactly as before;
- the Editor shell observes successful state transitions and emits presentation cues;
- audio runtime state is diagnostic/UI state only.

Implementation:

`packages/audio-presentation/src/programmatic-audio.js`

## Browser autoplay boundary

The AudioContext is not created at module load.

Before the first user gesture:

- `unlocked = false`;
- `contextState = not-created`;
- desired BGM mode may change logically without creating audio resources;
- cues may be recorded diagnostically as unscheduled.

On the first pointer/keyboard gesture, the application attempts to create/resume the AudioContext.

If Web Audio is unavailable, gameplay remains fully functional and the audio toggle is disabled.

## Modes

### Edit

Subtle two-voice low-volume ambient pad.

### Play

Lower, tenser two-voice ambient pad.

### Result — cleared

Three-voice consonant result pad.

### Result — failed

Two-voice low result pad.

Changing mode replaces the active programmatic BGM voices. Repeated UI rerenders in the same mode must not restart the BGM.

## Sound-effect cue set

| Cue | Trigger |
|---|---|
| `generated` | successful dungeon generation |
| `play-start` | Test run begins |
| `mystery-start` | Mystery run begins |
| `move` | successful room movement |
| `combat` | successful Enemy combat resolution |
| `treasure` | successful treasure open |
| `trap-avoid` | successful trap avoid |
| `trap-trigger` | successful risky trap trigger |
| `recovery` | successful Recovery use |
| `floor-advance` | cleared non-final floor advances to next floor |
| `run-clear` | run enters cleared Result |
| `run-fail` | run enters failed Result |
| `return-edit` | Result/Play returns to Edit |

Each cue is synthesized from oscillator frequency, waveform, gain envelope, offset, and duration constants authored in source code.

## Volume / mute

The header exposes one audio toggle.

- default logical state: enabled;
- before Web Audio unlock: button indicates available-but-locked state;
- muted: master gain is zero and button displays muted state;
- unmuted: master gain returns to the approved low presentation level;
- muting does not alter gameplay state or cue-history diagnostics.

V1 intentionally does not expose separate BGM/SE sliders. That can be added later if judge/user testing shows a need.

## Diagnostics

The Editor diagnostic surface exposes:

`getAudioPresentation()`

State includes:

- implementation version;
- provenance marker;
- Web Audio availability/unlocked/context state;
- muted state;
- desired/active BGM mode;
- active BGM voice count;
- recent cue history;
- recent mode history.

The diagnostic object never exposes AudioContext or Web Audio node references.

## Provenance

Provenance marker:

`project-authored-programmatic-web-audio`

The repository legal audit continues to require zero external creative-asset files.

Programmatic audio is production source code, not a third-party or AI-generated creative asset.

## Acceptance

DAI-097 acceptance requires:

1. audio unit tests pass;
2. AudioContext remains uncreated before user gesture;
3. a user gesture unlocks Web Audio in supported Chrome;
4. Edit / Play / cleared Result BGM modes transition correctly;
5. mute/unmute works;
6. Generation, Play start, Move, Combat, Treasure, Floor advance, Run clear, and Return Edit cues are exercised by browser smoke;
7. no external audio elements/files/network requests are used;
8. no browser/page/request/HTTP errors occur;
9. existing Play UI, Room Event, multi-floor, character-presentation, and owner-UI regressions remain green;
10. hosting/legal checks remain green.
