import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { confirmManualGeneration, normalRoomRequests, captureBrowserFailure } from '../../scripts/browser-smoke-support.mjs';
import { validateRoomRequests } from '../../packages/intent/src/room-requests.js';
import { createRoomPlanConfig } from '../../apps/editor-slice/room-plan-review.js';
import { DEFAULT_DESIGN_INTENT } from '../../packages/intent/src/design-intent.js';
import { createBuiltinGeneratorStrategyRegistry } from '../../packages/generator/src/strategy-catalog.js';
import { applyRoomContentLayer } from '../../packages/generator/src/room-content-layer.js';
import { TRAP_RULES_V1 } from '../../packages/core/src/trap-rules.js';
import { startPlaySession } from '../../packages/play-core/src/play-session.js';
import { getTrapAvoidanceChance } from '../../packages/play-core/src/interaction-runtime.js';

function manualPage({ checked = true, enabled = true, missingDialog = false, staysOpen = false } = {}) {
  const calls = [];
  const submit = {
    async isEnabled() { calls.push('enabled'); return enabled; },
    async click() { calls.push('submit'); },
  };
  const dialog = {
    async waitFor({ state }) {
      calls.push(state);
      if ((state === 'visible' && missingDialog) || (state === 'detached' && staysOpen)) throw new Error(`dialog not ${state}`);
    },
    locator(selector) { assert.equal(selector, 'button[type="submit"]'); return submit; },
  };
  return {
    calls,
    locator(selector) {
      if (selector === '#generationManual') return { async isChecked() { return checked; } };
      assert.equal(selector, 'dialog.special-room-review'); return dialog;
    },
  };
}

test('Manual smoke submits the visible valid plan and waits for actual dialog removal', async () => {
  const page = manualPage();
  assert.deepEqual(await confirmManualGeneration(page), { mode: 'manual', dialogObserved: true, planSubmitted: true });
  assert.deepEqual(page.calls, ['visible', 'enabled', 'submit', 'detached']);
});

test('Manual smoke fails rather than silently choosing Auto or bypassing a missing modal', async () => {
  await assert.rejects(confirmManualGeneration(manualPage({ checked: false })), /Manual/);
  await assert.rejects(confirmManualGeneration(manualPage({ missingDialog: true })), /dialog not visible/);
});

test('invalid or unclosed manual plans cannot be reported as confirmed', async () => {
  const page = manualPage({ enabled: false });
  await assert.rejects(confirmManualGeneration(page), /reviewed plan must be valid/);
  assert.equal(page.calls.includes('submit'), false);
  await assert.rejects(confirmManualGeneration(manualPage({ staysOpen: true })), /dialog not detached/);
});

test('normal-room fixture is valid and explicit without changing difficulty or chance rules', () => {
  const requests = normalRoomRequests();
  assert.equal(validateRoomRequests(requests).valid, true);
  const config = createRoomPlanConfig({ requests, floorCount: 2, seed: 123, roomsPerFloor: 7 });
  assert.equal(config.difficulty, 'normal');
  assert.deepEqual(config.difficultyProfile, { enemyDamage: 4, trapDamage: 6, recoveryHealing: 8 });
  assert.deepEqual(config.roomPlans, []);
  assert.deepEqual(config.presenceSpec.policies, { 'monster-house': 'exclude', 'trap-house': 'exclude', shop: 'exclude' });
  assert.deepEqual(config.presenceSpec.endpointPolicies, { start: 'normal', goal: 'normal' });
  requests[0].presence = 'include';
  assert.equal(normalRoomRequests()[0].presence, 'exclude');
});

for (const strategyId of ['version-2-spatial', 'version-3-special-rooms']) {
  test(`${strategyId}: explicit normal-room smoke fixture retains gameplay threats and current rules deterministically`, async () => {
    const registry = createBuiltinGeneratorStrategyRegistry();
    const intent = { ...DEFAULT_DESIGN_INTENT, targetDuration: 420, combatDensity: 0.75, trapDensity: 0.75, rewardDensity: 0.75 };
    const config = createRoomPlanConfig({ requests: normalRoomRequests(), floorCount: 1, seed: 123, roomsPerFloor: 7 });
    const request = { seed: 123, id: 'smoke-normal-fixture', prompt: 'Normal-room UI regression', intent, options: config };
    const generate = async () => applyRoomContentLayer(await registry.generate(strategyId, request), intent, config);
    const first = await generate();
    assert.deepEqual(await generate(), first);
    assert.deepEqual(first.spec.trapRules, TRAP_RULES_V1);
    assert.equal(getTrapAvoidanceChance(startPlaySession(first.spec).session), 0.7);
    assert.ok(first.spec.rooms.every(({ kind }) => !kind || kind === 'normal'));
    for (const type of ['enemy', 'trap', 'treasure']) assert.ok(first.spec.entities.some((entry) => entry.type === type), type);
    assert.ok(first.diagnostics.profile.routeViability.witness.playerState.hp > 0);
  });
}

test('failure evidence remains available when the browser failed before a page was created', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-smoke-failure-'));
  try {
    const error = new Error('original launch failure');
    const result = await captureBrowserFailure({ error, outputDir });
    assert.equal(result.passed, false);
    assert.equal(result.error.message, error.message);
    assert.equal(result.state, null);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, 'browser-smoke-failure.json'), 'utf8')), result);
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('diagnostic failure does not mask the original smoke error', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-smoke-failure-'));
  try {
    const page = { isClosed: () => false, url: () => 'http://127.0.0.1:4194/', evaluate: async () => { throw new Error('page gone'); }, screenshot: async () => {} };
    const result = await captureBrowserFailure({ page, error: new Error('original timeout'), outputDir });
    assert.equal(result.error.message, 'original timeout');
    assert.deepEqual(result.captureErrors, ['page gone']);
    assert.equal(result.url, 'http://127.0.0.1:4194/');
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }); }
});

test('all refreshed legacy Generate smokes confirm Manual and preserve the failure boundary', () => {
  const scripts = ['run-owner-ui-review-smoke.mjs', 'run-dai-087-room-events-smoke.mjs', 'run-dai-096-programmatic-characters-smoke.mjs', 'run-dai-097-audio-presentation-smoke.mjs', 'run-dai-100-motion-feedback-smoke.mjs', 'run-dai-100-event-feedback-smoke.mjs', 'run-dai-100-result-focus-smoke.mjs', 'run-dai-100-atmosphere-smoke.mjs'];
  for (const name of scripts) {
    const source = fs.readFileSync(new URL(`../../scripts/${name}`, import.meta.url), 'utf8');
    assert.match(source, /roomRequests: normalRoomRequests\(\)/, name);
    assert.match(source, /await page\.click\(['"]#generateDungeon['"]\);\s*(?:const manualConfirmation = )?await confirmManualGeneration\(page\);/, name);
    assert.match(source, /catch \(error\) \{\s*await captureBrowserFailure\(\{ page, error, outputDir \}\);\s*throw error;/, name);
  }
  const owner = fs.readFileSync(new URL('../../scripts/run-owner-ui-review-smoke.mjs', import.meta.url), 'utf8');
  assert.match(owner, /Version 3 — Recommended \(Special rooms\)/);
  assert.match(owner, /Version 2 — Previous spatial version/);
  assert.doesNotMatch(owner, /Version 2 — Recommended/);
  assert.match(owner, /state\.lastGeneration\?\.roomCount === 5/);
});
