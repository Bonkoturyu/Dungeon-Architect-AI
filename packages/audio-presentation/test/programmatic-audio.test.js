import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_CUES,
  AUDIO_MODES,
  AUDIO_REACTIVE_INTENSITY_VERSION,
  createProgrammaticAudio,
  deriveReactiveAudioIntensity,
} from "../src/programmatic-audio.js";

class FakeAudioParam {
  constructor() {
    this.value = 0;
  }
  setValueAtTime(value) {
    this.value = value;
  }
  linearRampToValueAtTime(value) {
    this.value = value;
  }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor() {
    this.connected = [];
    this.disconnected = false;
  }
  connect(target) {
    this.connected.push(target);
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeGainNode extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam();
  }
}

class FakeOscillatorNode extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.type = "sine";
    this.frequency = new FakeAudioParam();
    this.started = [];
    this.stopped = [];
  }
  start(at = 0) {
    this.started.push(at);
    this.context.startedOscillators += 1;
  }
  stop(at = 0) {
    this.stopped.push(at);
    this.context.stoppedOscillators += 1;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 10;
    this.state = "suspended";
    this.destination = new FakeNode();
    this.startedOscillators = 0;
    this.stoppedOscillators = 0;
    this.gains = [];
    this.oscillators = [];
  }
  createGain() {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeOscillatorNode(this);
    this.oscillators.push(node);
    return node;
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
}

test("catalog exposes the required DAI-097 modes and cues", () => {
  assert.deepEqual(AUDIO_MODES, [
    "edit",
    "play",
    "result-cleared",
    "result-failed",
  ]);

  for (const cue of [
    "generated",
    "play-start",
    "mystery-start",
    "move",
    "combat",
    "treasure",
    "trap-avoid",
    "trap-trigger",
    "recovery",
    "floor-advance",
    "run-clear",
    "run-fail",
    "return-edit",
  ]) {
    assert.ok(Array.isArray(AUDIO_CUES[cue]), cue);
    assert.ok(AUDIO_CUES[cue].length >= 1, cue);
  }
});

test("audio presentation stays inert until unlock then starts desired BGM", async () => {
  const audio = createProgrammaticAudio({ AudioContextCtor: FakeAudioContext });

  audio.setMode("play");
  assert.deepEqual(audio.getState(), {
    version: "2.0",
    provenance: "project-authored-programmatic-web-audio",
    available: true,
    unlocked: false,
    contextState: "not-created",
    muted: false,
    desiredMode: "play",
    activeMode: null,
    activeBgmVoices: 0,
    bgmVolume: 0.58,
    seVolume: 0.78,
    reactiveIntensityVersion: "1",
    reactiveIntensity: 0.18,
    reactiveReason: "edit",
    reactivePressure: 0.5,
    reactiveEnemyCount: 0,
    reactiveArmedTrapCount: 0,
    reactiveHpRatio: 1,
    reactiveBgmMultiplier: 0.8848,
    reactiveSeMultiplier: 0.9616,
    reactiveRampSeconds: 0.28,
    crossfadeSeconds: 0.45,
    motifScheduledSeconds: 0,
    lastCue: null,
    cueHistory: [],
    modeHistory: ["edit", "play"],
  });

  assert.equal(await audio.unlock(), true);
  const state = audio.getState();
  assert.equal(state.contextState, "running");
  assert.equal(state.unlocked, true);
  assert.equal(state.activeMode, "play");
  assert.equal(state.activeBgmVoices, 3);
  assert.ok(state.motifScheduledSeconds > 120);
});

test("mode changes replace BGM voices without changing authored game state", async () => {
  const audio = createProgrammaticAudio({ AudioContextCtor: FakeAudioContext });
  await audio.unlock();

  assert.equal(audio.getState().activeMode, "edit");
  assert.equal(audio.getState().activeBgmVoices, 3);

  audio.setMode("result-cleared");
  assert.equal(audio.getState().activeMode, "result-cleared");
  assert.equal(audio.getState().activeBgmVoices, 3);

  audio.setMode("result-failed");
  assert.equal(audio.getState().activeMode, "result-failed");
  assert.equal(audio.getState().activeBgmVoices, 2);
  assert.deepEqual(audio.getState().modeHistory, [
    "edit",
    "result-cleared",
    "result-failed",
  ]);
});

test("mute toggles independently from cue bookkeeping", async () => {
  let now = 100;
  const audio = createProgrammaticAudio({
    AudioContextCtor: FakeAudioContext,
    clock: () => now++,
  });

  await audio.unlock();
  assert.equal(audio.setMuted(true), true);
  assert.equal(audio.getState().muted, true);

  assert.equal(audio.playCue("treasure"), true);
  assert.equal(audio.getState().lastCue, "treasure");
  assert.deepEqual(audio.getState().cueHistory.at(-1), {
    cue: "treasure",
    at: 100,
    scheduled: true,
  });

  assert.equal(audio.toggleMuted(), false);
  assert.equal(audio.getState().muted, false);
});

test("BGM and SE mix levels are independently adjustable and bounded", async () => {
  const audio = createProgrammaticAudio({
    AudioContextCtor: FakeAudioContext,
    initialBgmVolume: 0.4,
    initialSeVolume: 0.65,
  });

  assert.equal(audio.getState().bgmVolume, 0.4);
  assert.equal(audio.getState().seVolume, 0.65);

  await audio.unlock();
  assert.equal(audio.setBgmVolume(0.25), 0.25);
  assert.equal(audio.setSeVolume(0.9), 0.9);
  assert.equal(audio.getState().bgmVolume, 0.25);
  assert.equal(audio.getState().seVolume, 0.9);

  assert.throws(() => audio.setBgmVolume(-0.1), /between 0 and 1/);
  assert.throws(() => audio.setSeVolume(1.1), /between 0 and 1/);
});

test("mode changes schedule long-form motifs and retire previous voices", async () => {
  const audio = createProgrammaticAudio({ AudioContextCtor: FakeAudioContext });
  await audio.unlock();
  const edit = audio.getState();
  assert.equal(edit.activeMode, "edit");
  assert.ok(edit.motifScheduledSeconds > 120);

  audio.setMode("play");
  const play = audio.getState();
  assert.equal(play.activeMode, "play");
  assert.equal(play.crossfadeSeconds, 0.45);
  assert.ok(play.motifScheduledSeconds > 120);
});

test("reactive intensity derives bounded exploration and danger profiles", () => {
  assert.equal(AUDIO_REACTIVE_INTENSITY_VERSION, "1");

  const calm = deriveReactiveAudioIntensity({
    mode: "play",
    designIntent: {
      tension: 0.2,
      combatDensity: 0.2,
      trapDensity: 0.2,
      targetDifficulty: 0.2,
    },
    hpRatio: 1,
  });
  const encounter = deriveReactiveAudioIntensity({
    mode: "play",
    designIntent: {
      tension: 0.9,
      combatDensity: 0.9,
      trapDensity: 0.8,
      targetDifficulty: 0.85,
    },
    enemyCount: 1,
    armedTrapCount: 1,
    hpRatio: 0.45,
  });

  assert.equal(calm.reason, "exploration");
  assert.equal(encounter.reason, "encounter");
  assert.ok(encounter.intensity > calm.intensity);
  assert.ok(encounter.bgmMultiplier > calm.bgmMultiplier);
  assert.ok(encounter.seMultiplier > calm.seMultiplier);
  assert.ok(encounter.bgmMultiplier <= 1.18);
  assert.ok(encounter.seMultiplier <= 1.06);
  assert.equal(encounter.rampSeconds, 0.28);
});

test("reactive intensity returns toward exploration after room danger resolves", () => {
  const intent = {
    tension: 0.7,
    combatDensity: 0.75,
    trapDensity: 0.6,
    targetDifficulty: 0.65,
  };
  const danger = deriveReactiveAudioIntensity({
    mode: "play",
    designIntent: intent,
    enemyCount: 1,
    armedTrapCount: 1,
    hpRatio: 0.8,
  });
  const exploration = deriveReactiveAudioIntensity({
    mode: "play",
    designIntent: intent,
    enemyCount: 0,
    armedTrapCount: 0,
    hpRatio: 0.8,
  });

  assert.equal(danger.reason, "encounter");
  assert.equal(exploration.reason, "exploration");
  assert.ok(danger.intensity > exploration.intensity);
});

test("reactive intensity layer does not rewrite user BGM or SE mix values", async () => {
  const audio = createProgrammaticAudio({
    AudioContextCtor: FakeAudioContext,
    initialBgmVolume: 0.34,
    initialSeVolume: 0.86,
  });

  const danger = deriveReactiveAudioIntensity({
    mode: "play",
    designIntent: {
      tension: 0.9,
      combatDensity: 0.9,
      trapDensity: 0.8,
      targetDifficulty: 0.8,
    },
    enemyCount: 1,
    armedTrapCount: 1,
    hpRatio: 0.5,
  });

  const beforeUnlock = audio.setReactiveIntensity(danger);
  assert.equal(beforeUnlock.reason, "encounter");
  assert.equal(audio.getState().bgmVolume, 0.34);
  assert.equal(audio.getState().seVolume, 0.86);
  assert.equal(audio.getState().reactiveReason, "encounter");

  await audio.unlock();
  const active = audio.getState();
  assert.equal(active.bgmVolume, 0.34);
  assert.equal(active.seVolume, 0.86);
  assert.equal(active.reactiveIntensity, danger.intensity);
  assert.equal(active.reactiveBgmMultiplier, danger.bgmMultiplier);
  assert.equal(active.reactiveSeMultiplier, danger.seMultiplier);

  const exploration = deriveReactiveAudioIntensity({
    mode: "play",
    designIntent: {
      tension: 0.9,
      combatDensity: 0.9,
      trapDensity: 0.8,
      targetDifficulty: 0.8,
    },
    hpRatio: 1,
  });
  audio.setReactiveIntensity(exploration);
  assert.equal(audio.getState().reactiveReason, "exploration");
  assert.ok(
    audio.getState().reactiveIntensity <
    active.reactiveIntensity,
  );
  assert.equal(audio.getState().bgmVolume, 0.34);
  assert.equal(audio.getState().seVolume, 0.86);
});

test("reactive result and edit profiles remain bounded and mode-specific", () => {
  const edit = deriveReactiveAudioIntensity({ mode: "edit" });
  const cleared = deriveReactiveAudioIntensity({ mode: "result-cleared" });
  const failed = deriveReactiveAudioIntensity({ mode: "result-failed" });

  assert.equal(edit.reason, "edit");
  assert.equal(cleared.reason, "result-cleared");
  assert.equal(failed.reason, "result-failed");
  assert.ok(edit.intensity < failed.intensity);
  for (const profile of [edit, cleared, failed]) {
    assert.ok(profile.intensity >= 0 && profile.intensity <= 1);
    assert.ok(profile.bgmMultiplier >= 0.82 && profile.bgmMultiplier <= 1.18);
    assert.ok(profile.seMultiplier >= 0.94 && profile.seMultiplier <= 1.06);
  }
});

test("invalid reactive intensity input fails closed", () => {
  const audio = createProgrammaticAudio({ AudioContextCtor: FakeAudioContext });
  assert.throws(
    () => audio.setReactiveIntensity(null),
    /reactive intensity profile is invalid/,
  );
  assert.throws(
    () => audio.setReactiveIntensity({
      version: "1",
      mode: "play",
      reason: "bad",
      pressure: Number.NaN,
      intensity: 0.5,
      enemyCount: 0,
      armedTrapCount: 0,
      hpRatio: 1,
      bgmMultiplier: 1,
      seMultiplier: 1,
      rampSeconds: 0.28,
    }),
    /must be finite/,
  );
});

test("cues before unlock are recorded as unscheduled and invalid names fail closed", () => {
  const audio = createProgrammaticAudio({
    AudioContextCtor: FakeAudioContext,
    clock: () => 7,
  });

  assert.equal(audio.playCue("move"), false);
  assert.deepEqual(audio.getState().cueHistory, [{
    cue: "move",
    at: 7,
    scheduled: false,
  }]);

  assert.throws(() => audio.playCue("missing"), /Unsupported audio cue/);
  assert.throws(() => audio.setMode("missing"), /Unsupported audio mode/);
});

test("audio presentation reports unavailable cleanly without Web Audio", async () => {
  const audio = createProgrammaticAudio({ AudioContextCtor: null });

  assert.equal(await audio.unlock(), false);
  audio.setMode("play");
  assert.equal(audio.playCue("play-start"), false);

  const state = audio.getState();
  assert.equal(state.available, false);
  assert.equal(state.unlocked, false);
  assert.equal(state.contextState, "not-created");
  assert.equal(state.desiredMode, "play");
  assert.equal(state.lastCue, "play-start");
  assert.equal(state.cueHistory.at(-1).scheduled, false);
});
