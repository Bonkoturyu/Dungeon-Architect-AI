export const AUDIO_PRESENTATION_VERSION = "2.0";
export const AUDIO_REACTIVE_INTENSITY_VERSION = "1";

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
    Object.freeze({ frequency: 659.25, duration: 0.16, offset: 0.15, gain: 0.045, type: "triangle" }),
  ]),
  "play-start": Object.freeze([
    Object.freeze({ frequency: 146.83, duration: 0.10, offset: 0.00, gain: 0.07, type: "triangle" }),
    Object.freeze({ frequency: 220.00, duration: 0.13, offset: 0.08, gain: 0.06, type: "triangle" }),
    Object.freeze({ frequency: 293.66, duration: 0.14, offset: 0.16, gain: 0.045, type: "sine" }),
  ]),
  "mystery-start": Object.freeze([
    Object.freeze({ frequency: 174.61, duration: 0.08, offset: 0.00, gain: 0.06, type: "triangle" }),
    Object.freeze({ frequency: 261.63, duration: 0.09, offset: 0.05, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 349.23, duration: 0.11, offset: 0.10, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 523.25, duration: 0.13, offset: 0.16, gain: 0.035, type: "triangle" }),
  ]),
  move: Object.freeze([
    Object.freeze({ frequency: 196.00, duration: 0.055, offset: 0.00, gain: 0.035, type: "triangle" }),
  ]),
  combat: Object.freeze([
    Object.freeze({ frequency: 110.00, duration: 0.08, offset: 0.00, gain: 0.08, type: "sawtooth" }),
    Object.freeze({ frequency: 82.41, duration: 0.11, offset: 0.045, gain: 0.06, type: "square" }),
    Object.freeze({ frequency: 146.83, duration: 0.07, offset: 0.11, gain: 0.04, type: "triangle" }),
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
    Object.freeze({ frequency: 587.33, duration: 0.14, offset: 0.21, gain: 0.032, type: "triangle" }),
  ]),
  "run-clear": Object.freeze([
    Object.freeze({ frequency: 261.63, duration: 0.10, offset: 0.00, gain: 0.06, type: "sine" }),
    Object.freeze({ frequency: 329.63, duration: 0.10, offset: 0.08, gain: 0.055, type: "sine" }),
    Object.freeze({ frequency: 392.00, duration: 0.16, offset: 0.16, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 523.25, duration: 0.24, offset: 0.24, gain: 0.04, type: "triangle" }),
  ]),
  "run-fail": Object.freeze([
    Object.freeze({ frequency: 123.47, duration: 0.12, offset: 0.00, gain: 0.065, type: "triangle" }),
    Object.freeze({ frequency: 92.50, duration: 0.20, offset: 0.09, gain: 0.055, type: "triangle" }),
    Object.freeze({ frequency: 61.74, duration: 0.25, offset: 0.21, gain: 0.035, type: "sine" }),
  ]),
  "return-edit": Object.freeze([
    Object.freeze({ frequency: 246.94, duration: 0.07, offset: 0.00, gain: 0.035, type: "sine" }),
    Object.freeze({ frequency: 329.63, duration: 0.10, offset: 0.06, gain: 0.025, type: "triangle" }),
  ]),
});

const MODE_PROGRAMS = Object.freeze({
  edit: Object.freeze([
    Object.freeze({
      gain: 0.010,
      type: "sine",
      stepSeconds: 4.0,
      sequence: Object.freeze([110.00, 123.47, 98.00, 110.00]),
    }),
    Object.freeze({
      gain: 0.0055,
      type: "triangle",
      stepSeconds: 1.5,
      sequence: Object.freeze([220.00, null, 261.63, 246.94, null, 329.63, 293.66, 246.94]),
    }),
    Object.freeze({
      gain: 0.0035,
      type: "sine",
      stepSeconds: 3.0,
      sequence: Object.freeze([329.63, 293.66, 392.00, 329.63]),
    }),
  ]),
  play: Object.freeze([
    Object.freeze({
      gain: 0.0125,
      type: "triangle",
      stepSeconds: 3.0,
      sequence: Object.freeze([73.42, 82.41, 65.41, 73.42]),
    }),
    Object.freeze({
      gain: 0.0068,
      type: "triangle",
      stepSeconds: 1.25,
      sequence: Object.freeze([146.83, null, 174.61, 164.81, 220.00, null, 196.00, 174.61]),
    }),
    Object.freeze({
      gain: 0.0036,
      type: "sine",
      stepSeconds: 2.5,
      sequence: Object.freeze([220.00, 246.94, 196.00, 220.00]),
    }),
  ]),
  "result-cleared": Object.freeze([
    Object.freeze({
      gain: 0.010,
      type: "sine",
      stepSeconds: 3.0,
      sequence: Object.freeze([130.81, 146.83, 164.81, 196.00]),
    }),
    Object.freeze({
      gain: 0.0065,
      type: "triangle",
      stepSeconds: 1.5,
      sequence: Object.freeze([261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 261.63]),
    }),
    Object.freeze({
      gain: 0.004,
      type: "sine",
      stepSeconds: 3.0,
      sequence: Object.freeze([392.00, 440.00, 523.25, 392.00]),
    }),
  ]),
  "result-failed": Object.freeze([
    Object.freeze({
      gain: 0.011,
      type: "sine",
      stepSeconds: 3.5,
      sequence: Object.freeze([65.41, 61.74, 55.00, 61.74]),
    }),
    Object.freeze({
      gain: 0.005,
      type: "triangle",
      stepSeconds: 1.75,
      sequence: Object.freeze([123.47, 110.00, null, 98.00, 92.50, null, 82.41, 73.42]),
    }),
  ]),
});

const MODE_SEQUENCE_STEPS = 72;
const MODE_CROSSFADE_SECONDS = 0.45;
const BGM_LOOP_SCHEDULER_INTERVAL_MS = 15000;
const BGM_LOOP_SCHEDULE_AHEAD_SECONDS = 180;
const REACTIVE_INTENSITY_RAMP_SECONDS = 0.28;
const MASTER_GAIN = 0.72;

function clamp01(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

export function deriveReactiveAudioIntensity({
  mode = "edit",
  designIntent = null,
  enemyCount = 0,
  armedTrapCount = 0,
  hpRatio = 1,
} = {}) {
  if (!isSupportedMode(mode)) {
    throw new RangeError(`Unsupported audio mode: ${mode}`);
  }

  const tension = clamp01(designIntent?.tension, 0.5);
  const combatDensity = clamp01(designIntent?.combatDensity, 0.5);
  const trapDensity = clamp01(designIntent?.trapDensity, 0.5);
  const targetDifficulty = clamp01(designIntent?.targetDifficulty, 0.5);
  const pressure = clamp01(
    tension * 0.35 +
    combatDensity * 0.25 +
    trapDensity * 0.2 +
    targetDifficulty * 0.2,
  );

  const enemies = normalizedCount(enemyCount);
  const traps = normalizedCount(armedTrapCount);
  const healthStress = 1 - clamp01(hpRatio, 1);

  let reason = mode;
  let intensity;

  if (mode === "edit") {
    intensity = 0.12 + pressure * 0.12;
    reason = "edit";
  } else if (mode === "result-cleared") {
    intensity = 0.22 + pressure * 0.08;
    reason = "result-cleared";
  } else if (mode === "result-failed") {
    intensity = 0.38 + pressure * 0.12;
    reason = "result-failed";
  } else {
    const encounterBoost =
      Math.min(0.42, enemies * 0.34) +
      Math.min(0.28, traps * 0.22);
    const stressBoost = healthStress * 0.14;
    intensity = clamp01(
      0.28 + pressure * 0.28 + encounterBoost + stressBoost,
    );
    reason = enemies > 0
      ? "encounter"
      : traps > 0
        ? "danger"
        : healthStress >= 0.45
          ? "low-health"
          : "exploration";
  }

  intensity = clamp01(intensity);
  return Object.freeze({
    version: AUDIO_REACTIVE_INTENSITY_VERSION,
    mode,
    reason,
    pressure,
    intensity,
    enemyCount: enemies,
    armedTrapCount: traps,
    hpRatio: clamp01(hpRatio, 1),
    bgmMultiplier: 0.82 + intensity * 0.36,
    seMultiplier: 0.94 + intensity * 0.12,
    rampSeconds: REACTIVE_INTENSITY_RAMP_SECONDS,
  });
}

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

function normalizedLevel(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
  return number;
}

function scheduleProgramVoice(
  oscillator,
  gain,
  definition,
  startAt,
  { resetGain = false } = {},
) {
  const sequence = definition.sequence;
  const stepSeconds = definition.stepSeconds;
  let scheduledUntil = startAt;

  if (resetGain) {
    gain.gain.setValueAtTime(0, startAt);
  }

  for (let step = 0; step < MODE_SEQUENCE_STEPS; step += 1) {
    const value = sequence[step % sequence.length];
    const at = startAt + step * stepSeconds;
    scheduledUntil = at + stepSeconds;

    if (value == null) {
      gain.gain.linearRampToValueAtTime(
        0,
        at + Math.min(0.08, stepSeconds / 4),
      );
      continue;
    }

    oscillator.frequency.setValueAtTime(value, at);
    gain.gain.linearRampToValueAtTime(
      definition.gain,
      at + Math.min(0.12, stepSeconds / 4),
    );
  }

  return scheduledUntil;
}

export function createProgrammaticAudio({
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
  clock = () => Date.now(),
  initialBgmVolume = 0.58,
  initialSeVolume = 0.78,
  setIntervalFn = globalThis.setInterval ?? null,
  clearIntervalFn = globalThis.clearInterval ?? null,
} = {}) {
  let context = null;
  let masterGain = null;
  let bgmGain = null;
  let seGain = null;
  let reactiveBgmGain = null;
  let reactiveSeGain = null;
  let muted = false;
  let unlocked = false;
  let unlockPromise = null;
  let pendingCues = [];
  let desiredMode = "edit";
  let activeMode = null;
  let modeVoices = [];
  let cueHistory = [];
  let modeHistory = ["edit"];
  let bgmVolume = normalizedLevel(initialBgmVolume, "initialBgmVolume");
  let seVolume = normalizedLevel(initialSeVolume, "initialSeVolume");
  let motifScheduledSeconds = 0;
  let bgmLoopSchedulerHandle = null;
  let bgmLoopExtensionCount = 0;
  let reactiveIntensity = deriveReactiveAudioIntensity({ mode: "edit" });

  let available = typeof AudioContextCtor === "function";

  function ensureGraph() {
    if (!available || context) return context;

    context = new AudioContextCtor();
    masterGain = context.createGain();
    bgmGain = context.createGain();
    seGain = context.createGain();
    reactiveBgmGain = context.createGain();
    reactiveSeGain = context.createGain();

    masterGain.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, context.currentTime);
    bgmGain.gain.setValueAtTime(bgmVolume, context.currentTime);
    seGain.gain.setValueAtTime(seVolume, context.currentTime);
    reactiveBgmGain.gain.setValueAtTime(
      reactiveIntensity.bgmMultiplier,
      context.currentTime,
    );
    reactiveSeGain.gain.setValueAtTime(
      reactiveIntensity.seMultiplier,
      context.currentTime,
    );

    bgmGain.connect(reactiveBgmGain);
    seGain.connect(reactiveSeGain);
    reactiveBgmGain.connect(masterGain);
    reactiveSeGain.connect(masterGain);
    masterGain.connect(context.destination);
    return context;
  }

  function retireVoices(voices) {
    if (!context || voices.length === 0) return;
    const now = context.currentTime;
    for (const voice of voices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(
          Number.isFinite(voice.gain.gain.value) ? voice.gain.gain.value : 0,
          now,
        );
        voice.gain.gain.linearRampToValueAtTime(0, now + MODE_CROSSFADE_SECONDS);
        voice.oscillator.stop(now + MODE_CROSSFADE_SECONDS + 0.03);
        voice.oscillator.onended = () => {
          safeDisconnect(voice.oscillator);
          safeDisconnect(voice.gain);
        };
      } catch {
        try {
          voice.oscillator.stop();
        } catch {
          // Already stopped.
        }
      }
    }
  }

  function stopLoopScheduler() {
    if (
      bgmLoopSchedulerHandle != null &&
      typeof clearIntervalFn === "function"
    ) {
      clearIntervalFn(bgmLoopSchedulerHandle);
    }
    bgmLoopSchedulerHandle = null;
  }

  function maintainLoopSchedule() {
    if (!unlocked || !context || modeVoices.length === 0) return false;

    const now = context.currentTime;
    let extended = false;

    for (const voice of modeVoices) {
      if (voice.scheduledUntil < now) {
        voice.scheduledUntil = now;
      }

      while (
        voice.scheduledUntil - now <=
        BGM_LOOP_SCHEDULE_AHEAD_SECONDS
      ) {
        voice.scheduledUntil = scheduleProgramVoice(
          voice.oscillator,
          voice.gain,
          voice.definition,
          voice.scheduledUntil,
        );
        bgmLoopExtensionCount += 1;
        extended = true;
      }
    }

    motifScheduledSeconds = Math.max(
      0,
      ...modeVoices.map(
        (voice) => voice.scheduledUntil - now,
      ),
    );
    return extended;
  }

  function ensureLoopScheduler() {
    if (
      bgmLoopSchedulerHandle != null ||
      typeof setIntervalFn !== "function"
    ) {
      return;
    }

    bgmLoopSchedulerHandle = setIntervalFn(
      maintainLoopSchedule,
      BGM_LOOP_SCHEDULER_INTERVAL_MS,
    );
    bgmLoopSchedulerHandle?.unref?.();
  }

  function stopModeVoices() {
    stopLoopScheduler();
    retireVoices(modeVoices);
    modeVoices = [];
    activeMode = null;
    motifScheduledSeconds = 0;
  }

  function startModeVoices(mode) {
    if (!unlocked || !context || !isSupportedMode(mode)) return false;
    if (activeMode === mode && modeVoices.length > 0) {
      ensureLoopScheduler();
      maintainLoopSchedule();
      return true;
    }

    const previous = modeVoices;
    modeVoices = [];
    retireVoices(previous);

    const now = context.currentTime;
    let scheduledUntil = now;
    for (const definition of MODE_PROGRAMS[mode]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = definition.type;
      const firstFrequency = definition.sequence.find((value) => value != null) ?? 110;
      oscillator.frequency.setValueAtTime(firstFrequency, now);
      oscillator.connect(gain);
      gain.connect(bgmGain);
      const voiceScheduledUntil = scheduleProgramVoice(
        oscillator,
        gain,
        definition,
        now,
        { resetGain: true },
      );
      scheduledUntil = Math.max(
        scheduledUntil,
        voiceScheduledUntil,
      );
      oscillator.start(now);
      modeVoices.push({
        oscillator,
        gain,
        definition,
        scheduledUntil: voiceScheduledUntil,
      });
    }

    activeMode = mode;
    motifScheduledSeconds = Math.max(0, scheduledUntil - now);
    ensureLoopScheduler();
    maintainLoopSchedule();
    return true;
  }

  function unlock() {
    if (!available) return Promise.resolve(false);
    if (unlockPromise) return unlockPromise;

    unlockPromise = (async () => {
      try {
        const unlockingContext = ensureGraph();
        if (unlockingContext.state === "suspended" && typeof unlockingContext.resume === "function") {
          await unlockingContext.resume();
        }
        if (context !== unlockingContext) return false;
        unlocked = context.state === "running" || context.state === "interrupted";
        if (unlocked) {
          startModeVoices(desiredMode);
          for (const event of pendingCues.splice(0)) {
            event.scheduled = scheduleCue(event.cue);
          }
        } else {
          pendingCues = [];
        }
        return unlocked;
      } catch {
        available = false;
        dispose();
        return false;
      }
    })().finally(() => { unlockPromise = null; });
    return unlockPromise;
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

  function setReactiveIntensity(profile) {
    if (
      !profile ||
      typeof profile !== "object" ||
      profile.version !== AUDIO_REACTIVE_INTENSITY_VERSION ||
      !isSupportedMode(profile.mode)
    ) {
      throw new TypeError("reactive intensity profile is invalid");
    }

    for (const field of [
      "pressure",
      "intensity",
      "hpRatio",
      "bgmMultiplier",
      "seMultiplier",
      "rampSeconds",
    ]) {
      if (!Number.isFinite(profile[field])) {
        throw new TypeError(`reactive intensity ${field} must be finite`);
      }
    }

    reactiveIntensity = Object.freeze({
      version: AUDIO_REACTIVE_INTENSITY_VERSION,
      mode: profile.mode,
      reason: String(profile.reason ?? "unknown"),
      pressure: clamp01(profile.pressure),
      intensity: clamp01(profile.intensity),
      enemyCount: normalizedCount(profile.enemyCount),
      armedTrapCount: normalizedCount(profile.armedTrapCount),
      hpRatio: clamp01(profile.hpRatio, 1),
      bgmMultiplier: Math.max(0.82, Math.min(1.18, profile.bgmMultiplier)),
      seMultiplier: Math.max(0.94, Math.min(1.06, profile.seMultiplier)),
      rampSeconds: Math.max(
        0,
        Math.min(1, profile.rampSeconds),
      ),
    });

    if (context && reactiveBgmGain && reactiveSeGain) {
      const now = context.currentTime;
      const end = now + reactiveIntensity.rampSeconds;
      for (const [param, value] of [
        [reactiveBgmGain.gain, reactiveIntensity.bgmMultiplier],
        [reactiveSeGain.gain, reactiveIntensity.seMultiplier],
      ]) {
        param.cancelScheduledValues(now);
        param.setValueAtTime(
          Number.isFinite(param.value) ? param.value : value,
          now,
        );
        param.linearRampToValueAtTime(value, end);
      }
    }

    return reactiveIntensity;
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (context && masterGain) {
      masterGain.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, context.currentTime);
    }
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function setBgmVolume(value) {
    bgmVolume = normalizedLevel(value, "bgmVolume");
    if (context && bgmGain) {
      bgmGain.gain.setValueAtTime(bgmVolume, context.currentTime);
    }
    return bgmVolume;
  }

  function setSeVolume(value) {
    seVolume = normalizedLevel(value, "seVolume");
    if (context && seGain) {
      seGain.gain.setValueAtTime(seVolume, context.currentTime);
    }
    return seVolume;
  }

  function playCue(cue) {
    const notes = AUDIO_CUES[cue];
    if (!notes) throw new RangeError(`Unsupported audio cue: ${cue}`);

    const event = {
      cue,
      at: clock(),
      scheduled: false,
    };
    cueHistory = [...cueHistory, event].slice(-48);

    if (!unlocked || !context) {
      if (unlockPromise && available) pendingCues = [...pendingCues, event].slice(-48);
      return false;
    }
    event.scheduled = scheduleCue(cue);
    return event.scheduled;
  }

  function scheduleCue(cue) {
    const notes = AUDIO_CUES[cue];
    const base = context.currentTime;
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = base + note.offset;
      const endAt = startAt + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(
        note.gain,
        startAt + Math.min(0.018, note.duration / 3),
      );
      gain.gain.linearRampToValueAtTime(0, endAt);

      oscillator.connect(gain);
      gain.connect(seGain);
      oscillator.onended = () => {
        safeDisconnect(oscillator);
        safeDisconnect(gain);
      };
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
      bgmVolume,
      seVolume,
      reactiveIntensityVersion: AUDIO_REACTIVE_INTENSITY_VERSION,
      reactiveIntensity: reactiveIntensity.intensity,
      reactiveReason: reactiveIntensity.reason,
      reactivePressure: reactiveIntensity.pressure,
      reactiveEnemyCount: reactiveIntensity.enemyCount,
      reactiveArmedTrapCount: reactiveIntensity.armedTrapCount,
      reactiveHpRatio: reactiveIntensity.hpRatio,
      reactiveBgmMultiplier: reactiveIntensity.bgmMultiplier,
      reactiveSeMultiplier: reactiveIntensity.seMultiplier,
      reactiveRampSeconds: reactiveIntensity.rampSeconds,
      crossfadeSeconds: MODE_CROSSFADE_SECONDS,
      motifScheduledSeconds,
      bgmLooping:
        bgmLoopSchedulerHandle != null &&
        modeVoices.length > 0,
      bgmLoopScheduleAheadSeconds:
        BGM_LOOP_SCHEDULE_AHEAD_SECONDS,
      bgmLoopSchedulerIntervalMs:
        BGM_LOOP_SCHEDULER_INTERVAL_MS,
      bgmLoopExtensionCount,
      lastCue: cueHistory.at(-1)?.cue ?? null,
      cueHistory: cueHistory.map((entry) => ({ ...entry })),
      modeHistory: [...modeHistory],
    };
  }

  function dispose() {
    pendingCues = [];
    stopModeVoices();
    try {
      context?.close?.()?.catch?.(() => {});
    } catch {
      // Best-effort teardown.
    }
    context = null;
    masterGain = null;
    bgmGain = null;
    seGain = null;
    reactiveBgmGain = null;
    reactiveSeGain = null;
    unlocked = false;
  }

  return Object.freeze({
    unlock,
    setMode,
    setReactiveIntensity,
    setMuted,
    toggleMuted,
    setBgmVolume,
    setSeVolume,
    playCue,
    getState,
    dispose,
  });
}
