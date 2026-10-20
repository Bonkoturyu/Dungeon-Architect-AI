import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { resolveChromePath } from './browser-smoke-support.mjs';
import { generateDungeonSpecV3 } from '../packages/generator/src/dungeon-generator.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';
import { TRAP_RULES_V1 } from '../packages/play-core/src/trap-avoidance.js';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { handleDesignIntentRequest } from '../functions/api/design-intent.js';
import { getMessage, LANGUAGE_OPTIONS } from '../apps/editor-slice/i18n.js';

const output = path.resolve(process.env.TRAP_ARTIFACT_DIR || 'artifacts/trap-avoidance/ui');
fs.mkdirSync(output, { recursive: true });
const port = 4197, url = process.env.DAI_SMOKE_URL || `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
const vite = process.env.DAI_SMOKE_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
const checks = [], errors = []; let browser;
function fixture({ legacy = false, armor = false, goal = false, seed = 2 } = {}) {
  const spec = generateDungeonSpecV3({ seed, roomCount: 3, routeChoice: 0 });
  if (legacy) delete spec.trapRules;
  else spec.trapRules = { ...TRAP_RULES_V1 };
  const roomId = goal ? 'room-003' : 'room-002';
  spec.entities.push({ id: 'trap-test', type: 'trap', roomId, warning: 'floor-cracks', damage: 6 });
  if (armor) {
    spec.equipmentRules = { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 };
    spec.entities.push({ id: 'budget', type: 'treasure', roomId: 'room-001', goldReward: 10, rewardItem: false },
      { id: 'shop', type: 'shop', roomId: 'room-001', offers: [{ id: 'armor', type: 'armor', price: 10, stock: 1, tier: 2 }] });
  }
  return spec;
}
try {
  if (!process.env.DAI_SMOKE_URL) for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ executablePath: resolveChromePath(), headless: process.env.TRAP_HEADLESS === '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  if (process.env.EXPECTED_DEPLOY_SHA) {
    await page.goto(new URL('build-info.json', url).href);
    const info = JSON.parse(await page.locator('body').innerText());
    const localInfo = JSON.parse(fs.readFileSync('dist/build-info.json', 'utf8'));
    assert.equal(info.commitSha, process.env.EXPECTED_DEPLOY_SHA);
    assert.equal(info.runtimeSourceSha256, localInfo.runtimeSourceSha256);
    fs.writeFileSync(path.join(output, 'build-info.json'), JSON.stringify(info, null, 2));
    checks.push('deployed-commit-and-runtime-source-match');
  }
  const open = async () => { await page.goto(url); await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready); await page.evaluate(() => window.__DAI_ONBOARDING__?.close()); };
  const state = () => page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const start = async (specs) => {
    await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
    const imported = await page.evaluate((data) => window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(data), JSON.stringify(createFullDungeonExport(specs)));
    assert.equal(imported.ok, true); assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon()), true);
    await page.waitForFunction(() => document.querySelector('#actionFeedback').hidden);
  };
  const move = async (id) => { assert.equal(await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.movePlayToRoom(id), id), true); };
  const language = async (id) => {
    const button = page.locator('[data-language-cycle]').first();
    for (let i = 0; i < 5 && await button.getAttribute('data-current-language') !== id; i++) await button.click();
    assert.equal(await button.getAttribute('data-current-language'), id);
  };
  await open();
  for (const { id } of LANGUAGE_OPTIONS) {
    await language(id);
    for (const [seed, outcome, hp] of [[0, 'avoided', 20], [2, 'triggered', 14]]) {
      const spec = fixture({ seed });
      await start([spec]); await move('room-002');
      const card = page.locator('.room-event[data-entity-id="trap-test"]');
      assert.equal(await card.locator('button').count(), 1);
      assert.equal(await card.locator('[data-action="avoid-trap"]').innerText(), getMessage(id, 'action.avoid'));
      assert.equal(await page.locator('[data-action="trigger-trap"]').count(), 0);
      assert.match(await card.innerText(), /70%/);
      assert.equal(await card.locator('.room-event-note').evaluate((node) => getComputedStyle(node).whiteSpace), 'normal');
      assert.equal(await card.locator('.room-event-note').evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true);
      assert.ok((await card.innerText()).includes(getMessage(id, 'trap.failureDamage', { damage: 6 })));
      if (id === 'ja' && seed === 2) await page.screenshot({ path: path.join(output, 'trap-choice-ja.png') });
      await card.locator('button').click();
      const after = await state();
      assert.equal(after.play.playerState.hp, hp);
      assert.ok(after.play.events.some((event) => event.type === `trap-${outcome}` && event.trapId === 'trap-test'));
      assert.equal(await page.locator('#actionFeedback').innerText(), `${getMessage(id, 'entity.trap').toUpperCase()} · ${getMessage(id, outcome === 'triggered' ? 'trap.triggered' : 'trap.avoided', { damage: 6 })}`);
      if (id === 'ja') await page.screenshot({ path: path.join(output, `trap-${outcome}-ja.png`) });
      assert.equal(await page.locator('[data-action="avoid-trap"]').count(), 0);
      assert.equal(after.play.gameplayCounters.interactions, 1);
      await move('room-001'); await move('room-002'); assert.equal(await page.locator('[data-action="avoid-trap"]').count(), 0);
      assert.deepEqual((await state()).play.snapshot, spec);
      checks.push(`${id}-${outcome}-single-action-feedback-repeat-reentry-snapshot`);
    }
  }
  await language('ja');
  await start([fixture({ armor: true })]);
  await page.locator('[data-action="open-treasure"]').click();
  await page.locator('[data-action="buy-offer"][data-offer-id="armor"]').click(); await move('room-002');
  assert.ok((await page.locator('.room-event').innerText()).includes(getMessage('ja', 'trap.failureDamage', { damage: 4 })));
  await page.locator('[data-action="avoid-trap"]').click(); assert.equal((await state()).play.playerState.hp, 16); checks.push('armor-visible-and-applied');
  await open(); await start([fixture()]); await move('room-002'); await page.locator('[data-action="avoid-trap"]').click();
  assert.equal((await state()).play.playerState.hp, 14); checks.push('reload-import-identical-failure');
  await start([fixture({ legacy: true })]); await move('room-002'); assert.match(await page.locator('.room-event').innerText(), /70%/);
  assert.deepEqual((await state()).play.snapshot.trapRules, TRAP_RULES_V1);
  await page.locator('[data-action="avoid-trap"]').click(); assert.equal((await state()).play.playerState.hp, 14); checks.push('missing-rules-import-normalizes-to-current-fixed-failure');
  await start([fixture({ goal: true })]); await move('room-002'); await move('room-003'); assert.equal((await state()).mode, 'play');
  await page.locator('[data-action="avoid-trap"]').click(); await page.locator('[data-action="complete-goal"]').click(); assert.equal((await state()).mode, 'result'); checks.push('goal-trap-resolves-before-completion');
  await start([fixture(), { ...fixture(), id: 'trap-smoke-floor-2' }]);
  for (const expectedHp of [14, 8]) { await move('room-002'); await page.locator('[data-action="avoid-trap"]').click(); assert.equal((await state()).play.playerState.hp, expectedHp); await move('room-003'); }
  assert.equal((await state()).mode, 'result'); checks.push('two-floor-hp-carry');
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
  const excluded = ['monster-house', 'trap-house', 'shop'].map((kind) => ({ kind, presence: 'exclude', roomCount: null, entityCount: null, floorNumber: null, roomId: null, offers: [] }));
  await page.route('**/api/design-intent', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, selectedProvider: 'fixture', intent: DEFAULT_DESIGN_INTENT, roomRequests: excluded, difficulty: 'easy', warnings: [] }) }));
  await page.locator('button[data-workflow-tab="create"]').click(); await page.check('#generationAuto');
  await page.fill('#generationPrompt', 'Easy dungeon with no special rooms');
  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt()), true);
  const exported = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getFullDungeonExport());
  assert.ok(exported.floors.every(({ dungeon }) => dungeon.trapRules.version === TRAP_RULES_V1.version)); checks.push('new-browser-generation-enables-rules');
  await page.unroute('**/api/design-intent');
  await page.route('**/api/design-intent', async (route) => {
    const response = await handleDesignIntentRequest(new Request('https://fixture.test/api/design-intent', { method: 'POST', body: route.request().postData() }), {});
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  for (const [id, prompt] of [['en', 'Start in a normal room and make the Goal random and add a shop'], ['ja', 'スタートは通常の部屋、ゴールはランダム、さらに店を追加']]) {
    await language(id); await page.locator('button[data-workflow-tab="create"]').click(); await page.check('#generationManual'); await page.fill('#generationPrompt', prompt);
    const before = await page.evaluate(() => JSON.stringify(window.__DAI_EDITOR_SLICE__.getFullDungeonExport()));
    await page.evaluate(() => { window.__pendingTrapGeneration = window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt(); });
    await page.locator('dialog.special-room-review').waitFor();
    assert.equal(await page.locator('select[name="endpoint-start"]').inputValue(), 'normal');
    assert.equal(await page.locator('select[name="endpoint-goal"]').inputValue(), 'random');
    assert.equal(await page.locator('select[name="presence-shop"]').inputValue(), 'include');
    await page.locator('dialog').getByRole('button', { name: getMessage(id, 'roomReview.cancel'), exact: true }).click();
    assert.equal(await page.evaluate(() => window.__pendingTrapGeneration), false);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__DAI_EDITOR_SLICE__.getFullDungeonExport())), before);
    checks.push(`${id}-fallback-trailing-shop-stays-independent`);
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'smoke.json'), JSON.stringify({ generatedAt: new Date().toISOString(), visible: process.env.TRAP_HEADLESS !== '1', checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, errors, output }));
} finally { if (browser) await browser.close(); if (vite) vite.kill('SIGTERM'); }
