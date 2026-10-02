import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_MOTION_VERSION,
  characterDefeatPose,
  characterIdlePose,
  characterMotionPhase,
} from '../src/character-motion.js';

test('character motion phase is deterministic and bounded', () => {
  const a = characterMotionPhase('enemy-1');
  const b = characterMotionPhase('enemy-1');
  const c = characterMotionPhase('enemy-2');

  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a >= 0 && a <= Math.PI * 2);
});

test('player idle pose stays subtle and changes over time', () => {
  const phase = characterMotionPhase('player');
  const a = characterIdlePose('player', 0, { phase });
  const b = characterIdlePose('player', 320, { phase });

  assert.equal(CHARACTER_MOTION_VERSION, '1');
  assert.notDeepEqual(a, b);
  assert.ok(Math.abs(b.offsetY) <= 0.03);
  assert.ok(Math.abs(b.rotationY) <= 0.02);
  assert.ok(b.scaleY > 0.98 && b.scaleY < 1.02);
});

test('enemy encounter intro adds a bounded threat pulse', () => {
  const phase = characterMotionPhase('enemy-1');
  const intro = characterIdlePose('enemy', 210, {
    phase,
    encounterIntro: true,
    encounterDurationMs: 420,
  });
  const settled = characterIdlePose('enemy', 700, {
    phase,
    encounterIntro: true,
    encounterDurationMs: 420,
  });

  assert.ok(intro.encounterPulse > 0.9);
  assert.ok(intro.scaleXz > settled.scaleXz);
  assert.equal(settled.encounterProgress, 1);
  assert.equal(settled.encounterPulse, 0);
});

test('reduced motion returns an identity idle pose', () => {
  for (const kind of ['player', 'enemy']) {
    const pose = characterIdlePose(kind, 250, {
      phase: 1.2,
      reducedMotion: true,
      encounterIntro: true,
    });
    assert.deepEqual(pose, {
      offsetY: 0,
      rotationY: 0,
      scaleXz: 1,
      scaleY: 1,
      leftArmDeltaZ: 0,
      rightArmDeltaZ: 0,
      headDeltaZ: 0,
      encounterProgress: 1,
      encounterPulse: 0,
    });
  }
});

test('defeat pose shrinks and completes without overshoot', () => {
  const start = characterDefeatPose(0);
  const middle = characterDefeatPose(160);
  const end = characterDefeatPose(500);

  assert.equal(start.finished, false);
  assert.equal(start.scale, 1);
  assert.ok(middle.scale < 1 && middle.scale > 0.04);
  assert.ok(middle.offsetY > 0);
  assert.equal(end.finished, true);
  assert.ok(Math.abs(end.scale - 0.04) <= Number.EPSILON);
  assert.equal(end.progress, 1);
});

test('reduced-motion defeat completes immediately', () => {
  const pose = characterDefeatPose(0, { reducedMotion: true });
  assert.equal(pose.finished, true);
  assert.equal(pose.scale, 0);
});
