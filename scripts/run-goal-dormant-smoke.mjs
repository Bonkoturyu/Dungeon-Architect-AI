import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { generateDungeonSpec } from '../packages/generator/src/dungeon-generator.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';

const output = path.resolve(process.env.GOAL_DORMANT_ARTIFACT_DIR || 'artifacts/goal-dormant/ui');
fs.mkdirSync(output, { recursive: true });
const port = 4198, url = process.env.DAI_SMOKE_URL || `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
const vite = process.env.DAI_SMOKE_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
const checks = [], errors = [], layouts = []; let browser;
function fixture(activation = 'none') {
  const spec = generateDungeonSpec({ seed: 0, roomCount: 3, routeChoice: 0 });
  spec.entities.push({ id: 'sleeping-enemy', type: 'enemy', roomId: 'room-003', initiallyActive: false });
  if (activation === 'mixed') spec.entities.push({ id: 'awake-enemy', type: 'enemy', roomId: 'room-003' });
  if (activation === 'trap') spec.entities.push({ id: 'trap-test', type: 'trap', roomId: 'room-003' });
  if (activation === 'treasure') spec.entities.push({ id: 'wake-chest', type: 'treasure', roomId: 'room-003' });
  if (['entry', 'false-flag', 'treasure'].includes(activation)) spec.events.push({
    id: 'wake', trigger: activation === 'treasure' ? { type: 'on_open_treasure', entityId: 'wake-chest' } : { type: 'on_enter_room', roomId: 'room-003' },
    conditions: activation === 'false-flag' ? [{ type: 'flag', key: 'never-set', value: true }] : [{ type: 'one_shot' }],
    actions: [{ type: 'spawn_enemy_group', enemyIds: ['sleeping-enemy'] }],
  });
  return spec;
}
try {
  if (vite) for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  if (process.env.EXPECTED_DEPLOY_SHA) {
    const response = await page.request.get(new URL('/build-info.json', url).href);
    assert.equal(response.ok(), true, 'build-info request must succeed');
    const info = await response.json();
    assert.equal(info.commitSha, process.env.EXPECTED_DEPLOY_SHA);
    assert.equal(info.runtimeSourceSha256, JSON.parse(fs.readFileSync('dist/build-info.json', 'utf8')).runtimeSourceSha256);
    fs.writeFileSync(path.join(output, 'build-info.json'), JSON.stringify(info, null, 2));
    checks.push('deployed-commit-and-runtime-source-match');
  }
  await page.goto(url); await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready);
  await page.evaluate(() => window.__DAI_ONBOARDING__?.close());
  const state = () => page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const start = async (specs) => {
    await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
    const result = await page.evaluate((json) => window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(json), JSON.stringify(createFullDungeonExport(specs)));
    assert.equal(result.ok, true);
    assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon()), true);
    await page.waitForFunction(() => document.querySelector('#actionFeedback').hidden);
  };
  const enterGoal = async () => {
    for (const roomId of ['room-002', 'room-003']) assert.equal(await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.movePlayToRoom(id), roomId), true);
    assert.equal((await state()).mode, 'play');
    await page.waitForFunction(() => !document.querySelector('#roomEventBar').classList.contains('is-event-intro'));
  };
  const finish = page.locator('[data-action="complete-goal"]');
  const assertFinished = async () => { await finish.click(); assert.equal((await state()).mode, 'result'); };
  const language = async (id) => {
    const button = page.locator('[data-language-cycle]').first();
    for (let i = 0; i < 5 && await button.getAttribute('data-current-language') !== id; i++) await button.click();
    assert.equal(await button.getAttribute('data-current-language'), id);
  };
  const assertGoalLayout = async (id, phase) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.locator('.room-event[data-kind="goal"]').evaluate((card) => {
        const button = card.querySelector('[data-action="complete-goal"]');
        const note = card.querySelector('span');
        const range = document.createRange(); range.selectNodeContents(button);
        return {
          card: card.getBoundingClientRect().toJSON(),
          button: button.getBoundingClientRect().toJSON(),
          note: note.getBoundingClientRect().toJSON(),
          textLines: range.getClientRects().length,
          cardOverflow: card.scrollWidth - card.clientWidth,
          noteOverflow: note.scrollWidth - note.clientWidth,
        };
      });
      const label = `${id}-${phase}-${viewport.width}x${viewport.height}`;
      assert.equal(layout.textLines, 1, `${label}: completion label must stay on one line`);
      assert.ok(layout.note.right <= layout.button.left, `${label}: note must not overlap button`);
      assert.ok(layout.button.right <= layout.card.right && layout.button.bottom <= layout.card.bottom, `${label}: button must fit card`);
      assert.ok(layout.cardOverflow <= 1 && layout.noteOverflow <= 1, `${label}: no horizontal overflow`);
      layouts.push({ id, phase, viewport, ...layout });
      if (id === 'ja' && phase === 'blocked') await page.screenshot({ path: path.join(output, `goal-blocked-ja-${viewport.width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    checks.push(`${id}-${phase}-goal-layout-three-desktop-viewports`);
  };
  for (const id of ['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko']) {
    await language(id); await start([fixture()]); await enterGoal();
    assert.equal(await page.locator('[data-action="clear-enemy"]').count(), 0);
    assert.equal(await finish.isEnabled(), true);
    await assertGoalLayout(id, 'ready');
    if (id === 'ja') await page.screenshot({ path: path.join(output, 'dormant-goal-ready-ja.png') });
    await assertFinished(); checks.push(`${id}-old-json-dormant-goal-finishes`);
    await start([fixture('mixed')]); await enterGoal();
    assert.equal(await finish.isDisabled(), true);
    await assertGoalLayout(id, 'blocked');
    await page.locator('[data-action="clear-enemy"]').click(); await assertFinished();
  }
  await language('ja');
  await start([fixture('false-flag')]); await enterGoal();
  assert.equal(await finish.isEnabled(), true); await assertFinished(); checks.push('false-activation-condition-does-not-block');
  for (const activation of ['entry', 'mixed']) {
    await start([fixture(activation)]); await enterGoal();
    assert.equal(await page.locator('[data-action="clear-enemy"]').count(), 1);
    assert.equal(await finish.isDisabled(), true);
    await page.locator('[data-action="clear-enemy"]').click();
    assert.equal(await finish.isEnabled(), true); await assertFinished(); checks.push(`${activation}-active-enemy-still-blocks`);
  }
  await start([fixture('treasure')]); await enterGoal();
  assert.equal(await finish.isEnabled(), true);
  await page.locator('[data-action="open-treasure"]').click();
  assert.equal(await finish.isDisabled(), true);
  assert.equal(await page.locator('[data-action="clear-enemy"]').count(), 1);
  await page.waitForFunction(() => document.querySelector('#actionFeedback').hidden);
  await page.screenshot({ path: path.join(output, 'treasure-activated-goal-blocked-ja.png') });
  await page.locator('[data-action="clear-enemy"]').click(); await assertFinished(); checks.push('treasure-activation-reblocks-before-combat');
  await start([fixture('trap')]); await enterGoal();
  assert.equal(await finish.isDisabled(), true);
  await page.locator('[data-action="avoid-trap"]').click(); await assertFinished(); checks.push('armed-trap-still-blocks');
  await start([fixture(), { ...fixture('entry'), id: 'next-floor' }]); await enterGoal(); await finish.click();
  assert.equal((await state()).mode, 'play'); await enterGoal();
  assert.equal(await finish.isDisabled(), true);
  await page.locator('[data-action="clear-enemy"]').click(); await assertFinished(); checks.push('two-floor-dormant-and-active-goals');
  await page.reload(); await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready); await page.evaluate(() => window.__DAI_ONBOARDING__?.close());
  await start([fixture()]); await enterGoal(); await assertFinished(); checks.push('reload-and-reimport-clears-again');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'smoke.json'), JSON.stringify({ visible: true, checks, errors, layouts }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, errors, output }));
} finally { if (browser) await browser.close(); if (vite) vite.kill('SIGTERM'); }
