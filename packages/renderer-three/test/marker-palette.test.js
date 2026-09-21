import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MARKER_COLORS } from '../src/three-renderer-adapter.js';

test('Goal and treasure markers use clearly distinct palette entries', () => {
  assert.equal(DEFAULT_MARKER_COLORS.goal, 0x7db7ff);
  assert.equal(DEFAULT_MARKER_COLORS.treasure, 0xe2b85f);
  assert.notEqual(DEFAULT_MARKER_COLORS.goal, DEFAULT_MARKER_COLORS.treasure);
});
