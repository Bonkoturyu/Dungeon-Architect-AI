import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MARKER_COLORS } from '../src/three-renderer-adapter.js';

function rgb(hex) {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

function distance(a, b) {
  const left = rgb(a);
  const right = rgb(b);
  return Math.hypot(
    left.r - right.r,
    left.g - right.g,
    left.b - right.b,
  );
}

test('gameplay marker palette keeps all primary meanings visually separated', () => {
  assert.deepEqual(DEFAULT_MARKER_COLORS, {
    start: 0x22c55e,
    goal: 0x3b82f6,
    enemy: 0xef4444,
    treasure: 0xeab308,
    trap: 0x8b5cf6,
    recovery: 0xf472b6,
  });

  assert.ok(distance(DEFAULT_MARKER_COLORS.goal, DEFAULT_MARKER_COLORS.recovery) >= 150);
  assert.ok(distance(DEFAULT_MARKER_COLORS.enemy, DEFAULT_MARKER_COLORS.trap) >= 150);
  assert.ok(distance(DEFAULT_MARKER_COLORS.goal, DEFAULT_MARKER_COLORS.treasure) >= 150);
});
