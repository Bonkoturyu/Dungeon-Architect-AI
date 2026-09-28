import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATMOSPHERE_VERSION,
  createAtmosphereProfile,
  mixHexColor,
} from '../src/atmosphere.js';

const tense = {
  tension: 0.95,
  exploration: 0.25,
  fairness: 0.45,
  deception: 0.8,
  telegraphStrength: 0.45,
  trapDensity: 0.85,
  targetDifficulty: 0.9,
  rewardDensity: 0.5,
};

const readable = {
  tension: 0.25,
  exploration: 0.95,
  fairness: 0.9,
  deception: 0.15,
  telegraphStrength: 0.95,
  trapDensity: 0.2,
  targetDifficulty: 0.35,
  rewardDensity: 0.55,
};

test('atmosphere color mixing is deterministic and bounded', () => {
  assert.equal(mixHexColor(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(mixHexColor(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(mixHexColor(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(mixHexColor(0x123456, 0xabcdef, -1), 0x123456);
  assert.equal(mixHexColor(0x123456, 0xabcdef, 2), 0xabcdef);
});

test('missing DesignIntent preserves the legacy no-fog presentation', () => {
  const profile = createAtmosphereProfile(null, { mode: 'edit' });
  assert.equal(profile.version, ATMOSPHERE_VERSION);
  assert.equal(profile.enabled, false);
  assert.equal(profile.backgroundColor, 0x202834);
  assert.equal(profile.fog.enabled, false);
  assert.equal(profile.ambient.intensity, 1.5);
  assert.equal(profile.sun.intensity, 1.4);
  assert.equal(profile.roomCurrentEmissiveIntensity, 0.5);
});

test('high tension produces stronger atmosphere than high-readability intent', () => {
  const pressure = createAtmosphereProfile(tense, { mode: 'play' });
  const clarity = createAtmosphereProfile(readable, { mode: 'play' });

  assert.ok(pressure.pressure > clarity.pressure);
  assert.ok(pressure.clarity < clarity.clarity);
  assert.ok(pressure.fog.strength > clarity.fog.strength);
  assert.ok(pressure.fog.far < clarity.fog.far);
  assert.ok(pressure.ambient.intensity < clarity.ambient.intensity);
});

test('edit atmosphere is attenuated relative to play', () => {
  const edit = createAtmosphereProfile(tense, { mode: 'edit' });
  const play = createAtmosphereProfile(tense, { mode: 'play' });

  assert.equal(edit.effectScale, 0.4);
  assert.equal(play.effectScale, 1);
  assert.ok(edit.fog.far > play.fog.far);
  assert.ok(edit.ambient.intensity > play.ambient.intensity);
});

test('result atmosphere keeps bounded continuity', () => {
  const result = createAtmosphereProfile(tense, { mode: 'result' });
  assert.equal(result.effectScale, 0.75);
  assert.ok(result.fog.near >= 26);
  assert.ok(result.fog.far >= result.fog.near + 60);
  assert.ok(result.ambient.intensity >= 1.08);
  assert.ok(result.sun.intensity >= 1.12);
});

test('telegraph and fairness preserve current-room readability', () => {
  const low = createAtmosphereProfile({
    ...readable,
    fairness: 0.1,
    telegraphStrength: 0.1,
  }, { mode: 'play' });
  const high = createAtmosphereProfile({
    ...readable,
    fairness: 1,
    telegraphStrength: 1,
  }, { mode: 'play' });

  assert.ok(high.roomCurrentEmissiveIntensity > low.roomCurrentEmissiveIntensity);
  assert.ok(high.roomCurrentEmissiveIntensity <= 0.82);
  assert.ok(high.sun.intensity <= 1.72);
});
