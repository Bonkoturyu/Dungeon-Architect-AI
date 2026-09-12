import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DESIGN_INTENT,
  normalizeDesignIntent,
  validateDesignIntent
} from "../src/design-intent.js";
import { parseFallbackIntent } from "../src/fallback-parser.js";

test("normalization produces a valid complete intent", () => {
  const intent = normalizeDesignIntent({ fairness: 0.9 });
  const result = validateDesignIntent(intent);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(intent.fairness, 0.9);
  assert.equal(intent.instantDeathAllowed, false);
});

test("normalization clamps numeric axes and target duration", () => {
  const intent = normalizeDesignIntent({ fairness: 4, tension: -2, targetDuration: 99999 });
  assert.equal(intent.fairness, 1);
  assert.equal(intent.tension, 0);
  assert.equal(intent.targetDuration, 1800);
});

test("normalization ignores attempts to enable instant death", () => {
  const intent = normalizeDesignIntent({ instantDeathAllowed: true });
  assert.equal(intent.instantDeathAllowed, false);
});

test("validator rejects unsupported instant-death intent", () => {
  const intent = { ...DEFAULT_DESIGN_INTENT, instantDeathAllowed: true };
  const result = validateDesignIntent(intent);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "INSTANT_DEATH_NOT_SUPPORTED"));
});

test("fallback parser recognizes greed-oriented Japanese prompt", () => {
  const intent = parseFallbackIntent("短いダンジョン。宝箱を欲張る人を引っかけたい。でも公平にして。");
  assert.equal(intent.targetDuration, 300);
  assert.ok(intent.greedPunishment >= 0.8);
  assert.ok(intent.fairness >= 0.8);
  assert.ok(intent.telegraphStrength >= 0.7);
});

test("fallback parser can express scary but low-combat intent", () => {
  const intent = parseFallbackIntent("怖いけど戦闘は少なめの探索ダンジョン");
  assert.ok(intent.tension >= 0.8);
  assert.ok(intent.combatDensity <= 0.2);
  assert.ok(intent.exploration >= 0.8);
});
