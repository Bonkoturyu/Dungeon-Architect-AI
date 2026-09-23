import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_CUES,
  AUDIO_MODES,
  createProgrammaticAudio,
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
    version: "1.0",
    provenance: "project-authored-programmatic-web-audio",
    available: true,
    unlocked: false,
    contextState: "not-created",
    muted: false,
    desiredMode: "play",
    activeMode: null,
    activeBgmVoices: 0,
    lastCue: null,
    cueHistory: [],
    modeHistory: ["edit", "play"],
  });

  assert.equal(await audio.unlock(), true);
  const state = audio.getState();
  assert.equal(state.contextState, "running");
  assert.equal(state.unlocked, true);
  assert.equal(state.activeMode, "play");
  assert.equal(state.activeBgmVoices, 2);
});

test("mode changes replace BGM voices without changing authored game state", async () => {
  const audio = createProgrammaticAudio({ AudioContextCtor: FakeAudioContext });
  await audio.unlock();

  assert.equal(audio.getState().activeMode, "edit");
  assert.equal(audio.getState().activeBgmVoices, 2);

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
