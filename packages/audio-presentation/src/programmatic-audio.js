export const AUDIO_PRESENTATION_VERSION = "1.0";

export const AUDIO_MODES = Object.freeze([
  "edit",
  "play",
  "result-cleared",
  "result-failed",
]);

export const AUDIO_CUES = Object.freeze({
  generated: Object.freeze([
    Object.freeze({ frequency: 392.0, duration: 0.08, offset: 0.00, gain: 0.07, type: "sine" }),
    Object.freeze({ frequency: 523.25, duration: 0.12, offset: 0.07, gain: 0.06, type: "sine" }),
  ]),
  "play-start": Object.freeze([
    Object.freeze({ frequency: 146.83, duration: 0.10, offset: 0.00, gain: 0.07, type: "triangle" }),
    Object.freeze({ frequency: 220.00, duration: 0.13, offset: 0.08, gain: 0.06, type: "triangle" }),
  ]),
  "mystery-start": Object.freeze([
    Object.freeze({ frequency: 174.61, duration: 0.08, offset: 0.00, gain: 0.06, type: "triangle" }),
    Object.freeze({ frequency: 261.63, duration: 0.09, offset: 0.05, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 349.23, duration: 0.11, offset: 0.10, gain: 0.05, type: "sine" }),
  ]),
  move: Object.freeze([
    Object.freeze({ frequency: 196.00, duration: 0.055, offset: 0.00, gain: 0.035, type: "triangle" }),
  ]),
  combat: Object.freeze([
    Object.freeze({ frequency: 110.00, duration: 0.08, offset: 0.00, gain: 0.08, type: "sawtooth" }),
    Object.freeze({ frequency: 82.41, duration: 0.11, offset: 0.045, gain: 0.06, type: "square" }),
  ]),
  treasure: Object.freeze([
    Object.freeze({ frequency: 440.00, duration: 0.07, offset: 0.00, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 659.25, duration: 0.08, offset: 0.06, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 880.00, duration: 0.11, offset: 0.12, gain: 0.045, type: "sine" }),
  ]),
  "trap-avoid": Object.freeze([
    Object.freeze({ frequency: 293.66, duration: 0.055, offset: 0.00, gain: 0.04, type: "triangle" }),
    Object.freeze({ frequency: 392.00, duration: 0.07, offset: 0.05, gain: 0.035, type: "triangle" }),
  ]),
  "trap-trigger": Object.freeze([
    Object.freeze({ frequency: 92.50, duration: 0.16, offset: 0.00, gain: 0.085, type: "sawtooth" }),
    Object.freeze({ frequency: 69.30, duration: 0.18, offset: 0.04, gain: 0.065, type: "square" }),
  ]),
  recovery: Object.freeze([
    Object.freeze({ frequency: 329.63, duration: 0.10, offset: 0.00, gain: 0.045, type: "sine" }),
    Object.freeze({ frequency: 493.88, duration: 0.12, offset: 0.08, gain: 0.04, type: "sine" }),
  ]),
  "floor-advance": Object.freeze([
    Object.freeze({ frequency: 220.00, duration: 0.08, offset: 0.00, gain: 0.05, type: "triangle" }),
    Object.freeze({ frequency: 293.66, duration: 0.08, offset: 0.07, gain: 0.045, type: "triangle" }),
    Object.freeze({ frequency: 440.00, duration: 0.11, offset: 0.14, gain: 0.04, type: "sine" }),
  ]),
  "run-clear": Object.freeze([
    Object.freeze({ frequency: 261.63, duration: 0.10, offset: 0.00, gain: 0.06, type: "sine" }),
    Object.freeze({ frequency: 329.63, duration: 0.10, offset: 0.08, gain: 0.055, type: "sine" }),
    Object.freeze({ frequency: 392.00, duration: 0.16, offset: 0.16, gain: 0.05, type: "sine" }),
  ]),
  "run-fail": Object.freeze([
    Object.freeze({ frequency: 123.47, duration: 0.12, offset: 0.00, gain: 0.065, type: "triangle" }),
    Object.freeze({ frequency: 92.50, duration: 0.20, offset: 0.09, gain: 0.055, type: "triangle" }),
  ]),
  "return-edit": Object.freeze([
    Object.freeze({ frequency: 246.94, duration: 0.07, offset: 0.00, gain: 0.035, type: "sine" }),
  ]),
});

const MODE_VOICES = Object.freeze({
  edit: Object.freeze([
    Object.freeze({ frequency: 110.00, gain: 0.014, type: "sine" }),
    Object.freeze({ frequency: 164.81, gain: 0.009, type: "sine" }),
  ]),
  play: Object.freeze([
    Object.freeze({ frequency: 73.42, gain: 0.016, type: "triangle" }),
    Object.freeze({ frequency: 110.00, gain: 0.010, type: "sine" }),
  ]),
  "result-cleared": Object.freeze([
    Object.freeze({ frequency: 130.81, gain: 0.013, type: "sine" }),
    Object.freeze({ frequency: 196.00, gain: 0.010, type: "sine" }),
    Object.freeze({ frequency: 261.63, gain: 0.007, type: "sine" }),
  ]),
  "result-failed": Object.freeze([
    Object.freeze({ frequency: 65.41, gain: 0.014, type: "sine" }),
    Object.freeze({ frequency: 92.50, gain: 0.009, type: "triangle" }),
  ]),
});

function isSupportedMode(mode) {
  return AUDIO_MODES.includes(mode);
}

function safeDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch {
    // A stopped/disconnected Web Audio node is already inert.
  }
}

export function createProgrammaticAudio({
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
  clock = () => Date.now(),
} = {}) {
  let context = null;
  let masterGain = null;
  let bgmGain = null;
  let seGain = null;
  let muted = false;
  let unlocked = false;
  let desiredMode = "edit";
  let activeMode = null;
  let modeVoices = [];
  let cueHistory = [];
  let modeHistory = ["edit"];

  const available = typeof AudioContextCtor === "function";

  function ensureGraph() {
    if (!available || context) return context;

    context = new AudioContextCtor();
    masterGain = context.createGain();
    bgmGain = context.createGain();
    seGain = context.createGain();

    masterGain.gain.setValueAtTime(muted ? 0 : 0.72, context.currentTime);
    bgmGain.gain.setValueAtTime(1, context.currentTime);
    seGain.gain.setValueAtTime(1, context.currentTime);

    bgmGain.connect(masterGain);
    seGain.connect(masterGain);
    masterGain.connect(context.destination);
    return context;
  }

  function stopModeVoices() {
    if (!context) {
      modeVoices = [];
      activeMode = null;
      return;
    }

    const now = context.currentTime;
    for (const voice of modeVoices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value ?? 0, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.05);
        voice.oscillator.stop(now + 0.06);
      } catch {
        try {
          voice.oscillator.stop();
        } catch {
          // Already stopped.
        }
      }
      safeDisconnect(voice.oscillator);
      safeDisconnect(voice.gain);
    }
    modeVoices = [];
    activeMode = null;
  }

  function startModeVoices(mode) {
    if (!unlocked || !context || !isSupportedMode(mode)) return false;
    if (activeMode === mode && modeVoices.length > 0) return true;

    stopModeVoices();

    const now = context.currentTime;
    for (const definition of MODE_VOICES[mode]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = definition.type;
      oscillator.frequency.setValueAtTime(definition.frequency, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(definition.gain, now + 0.12);
      oscillator.connect(gain);
      gain.connect(bgmGain);
      oscillator.start(now);
      modeVoices.push({ oscillator, gain });
    }
    activeMode = mode;
    return true;
  }

  async function unlock() {
    if (!available) return false;
    ensureGraph();
    if (context.state === "suspended" && typeof context.resume === "function") {
      await context.resume();
    }
    unlocked = context.state === "running" || context.state === "interrupted";
    if (unlocked) startModeVoices(desiredMode);
    return unlocked;
  }

  function setMode(mode) {
    if (!isSupportedMode(mode)) throw new RangeError(`Unsupported audio mode: ${mode}`);
    if (desiredMode !== mode) {
      desiredMode = mode;
      modeHistory = [...modeHistory, mode].slice(-24);
    }
    if (unlocked) startModeVoices(mode);
    return desiredMode;
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (context && masterGain) {
      masterGain.gain.setValueAtTime(muted ? 0 : 0.72, context.currentTime);
    }
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function playCue(cue) {
    const notes = AUDIO_CUES[cue];
    if (!notes) throw new RangeError(`Unsupported audio cue: ${cue}`);

    const event = {
      cue,
      at: clock(),
      scheduled: Boolean(unlocked && context),
    };
    cueHistory = [...cueHistory, event].slice(-48);

    if (!unlocked || !context) return false;

    const base = context.currentTime;
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = base + note.offset;
      const endAt = startAt + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(note.gain, startAt + Math.min(0.018, note.duration / 3));
      gain.gain.linearRampToValueAtTime(0, endAt);

      oscillator.connect(gain);
      gain.connect(seGain);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.01);
    }

    return true;
  }

  function getState() {
    return {
      version: AUDIO_PRESENTATION_VERSION,
      provenance: "project-authored-programmatic-web-audio",
      available,
      unlocked,
      contextState: context?.state ?? "not-created",
      muted,
      desiredMode,
      activeMode,
      activeBgmVoices: modeVoices.length,
      lastCue: cueHistory.at(-1)?.cue ?? null,
      cueHistory: cueHistory.map((entry) => ({ ...entry })),
      modeHistory: [...modeHistory],
    };
  }

  function dispose() {
    stopModeVoices();
    try {
      context?.close?.();
    } catch {
      // Best-effort teardown.
    }
    context = null;
    masterGain = null;
    bgmGain = null;
    seGain = null;
    unlocked = false;
  }

  return Object.freeze({
    unlock,
    setMode,
    setMuted,
    toggleMuted,
    playCue,
    getState,
    dispose,
  });
}
