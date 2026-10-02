import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { handleDesignIntentRequest } from '../functions/api/design-intent.js';
import { getMessage } from '../apps/editor-slice/i18n.js';

const output = path.resolve(process.env.GENERATION_SETTINGS_ARTIFACT_DIR || 'artifacts/generation-settings-ui');
fs.mkdirSync(output, { recursive: true });
const port = 4198;
const url = process.env.DAI_SMOKE_URL || `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
const vite = process.env.DAI_SMOKE_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
const checks = [], errors = [];
const request = (kind, extra = {}) => ({ kind, presence: 'include', roomCount: 1, entityCount: null, floorNumber: null, roomId: null, offers: [], ...extra });
const safeRequests = ['monster-house', 'trap-house', 'shop'].map((kind) => request(kind, { presence: 'exclude', roomCount: null }))
  .concat(['start', 'goal'].map((targetRole) => request('normal', { targetRole })));
let requests = [], apiDifficulty = 'easy', actualFallback = false, browser;
try {
  if (!process.env.DAI_SMOKE_URL) for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (process.env.EXPECTED_DEPLOY_SHA) {
    await page.goto(new URL('build-info.json', url).href);
    const deployed = JSON.parse(await page.locator('body').innerText());
    const local = JSON.parse(fs.readFileSync('dist/build-info.json', 'utf8'));
    assert.equal(deployed.commitSha, process.env.EXPECTED_DEPLOY_SHA);
    assert.equal(deployed.runtimeSourceSha256, local.runtimeSourceSha256);
    fs.writeFileSync(path.join(output, 'build-info.json'), JSON.stringify(deployed, null, 2));
    checks.push('deployed-commit-and-runtime-source-match');
  }
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/api/design-intent', async (route) => {
    if (actualFallback) {
      const response = await handleDesignIntentRequest(new Request('https://example.test/api/design-intent', { method: 'POST', body: route.request().postData() }), {});
      return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, selectedProvider: 'fixture', intent: { ...DEFAULT_DESIGN_INTENT, targetDuration: 480 }, roomRequests: requests, difficulty: apiDifficulty, warnings: [] }) });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready);
  await page.evaluate(() => window.__DAI_ONBOARDING__?.close());
  const exportJson = () => page.evaluate(() => window.__DAI_EDITOR_SLICE__.getFullDungeonExport());
  const createTab = () => page.locator('button[data-workflow-tab="create"]').click();
  const begin = async () => {
    await page.evaluate(() => { window.__pendingGeneration = window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt(); });
    await page.locator('dialog.special-room-review').waitFor();
  };
  const cancel = async () => { await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.__pendingGeneration), false); };
  const confirm = async () => { await page.locator('dialog button[type="submit"]').click(); assert.equal(await page.evaluate(() => window.__pendingGeneration), true, await page.locator('#generationStatus').innerText()); };
  const language = async (id) => {
    const control = page.locator('[data-language-cycle]').first();
    for (let i = 0; i < 5 && await control.getAttribute('data-current-language') !== id; i++) await control.click();
    assert.equal(await control.getAttribute('data-current-language'), id);
  };
  await page.fill('#generationPrompt', 'Random settings 0');
  await page.selectOption('#generatorStrategy', 'algorithm-lab.bsp');
  const original = await exportJson();
  for (const id of ['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko']) {
    await language(id);
    assert.equal(await page.locator('#generationDifficulty').inputValue(), 'prompt');
    for (const key of ['easy', 'normal', 'hard']) assert.equal(await page.locator(`#generationDifficulty option[value="${key}"]`).textContent(), getMessage(id, `roomReview.${key}`));
    assert.equal(await page.locator('#generationDifficulty option[value="prompt"]').textContent(), getMessage(id, 'create.difficultyPrompt'));
    assert.equal(await page.locator('#generationDifficultyHint').textContent(), getMessage(id, 'create.difficultyHint'));
    await page.locator('#generateDungeon').scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => ({ select: document.querySelector('#generationDifficulty').getBoundingClientRect().toJSON(), button: document.querySelector('#generateDungeon').getBoundingClientRect().toJSON() }));
    assert.ok(layout.select.bottom <= layout.button.top && layout.button.top - layout.select.bottom < 170);
    if (id === 'ja') await page.screenshot({ path: path.join(output, 'generation-difficulty-ja.png') });
    await begin();
    assert.equal(await page.locator('dialog select[name="difficulty"]').count(), 0);
    assert.equal(await page.locator('[data-review-difficulty]').getAttribute('data-review-difficulty'), 'easy');
    assert.equal(await page.locator('dialog [data-plan-id]').count(), 0);
    assert.equal(await page.locator('.room-review-random-note').textContent(), getMessage(id, 'roomReview.randomHidden'));
    assert.equal(await page.locator('#generationDifficulty').isDisabled(), true);
    if (id === 'ja') await page.screenshot({ path: path.join(output, 'random-review-ja.png') });
    await cancel();
    assert.deepEqual(await exportJson(), original);
    assert.equal(await page.locator('#generationDifficulty').isEnabled(), true);
    checks.push(`${id}-difficulty-location-and-random-review`);
  }
  await language('en');
  await begin();
  const hiddenText = await page.locator('dialog').innerText();
  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt()), false);
  assert.equal(await page.locator('dialog.special-room-review').count(), 1);
  await page.selectOption('select[name="presence-monster-house"]', 'include');
  const count = page.locator('[data-plan-id="special-monster-house-1-1"] input[type="number"]').nth(1);
  await count.fill('2');
  await page.selectOption('select[name="presence-monster-house"]', 'random');
  assert.equal(await page.locator('dialog [data-plan-id]').count(), 0);
  await page.selectOption('select[name="presence-monster-house"]', 'include');
  assert.equal(await count.inputValue(), '2');
  await page.selectOption('select[name="endpoint-start"]', 'shop');
  assert.equal(await page.locator('[data-plan-id="endpoint-start-shop-1"]').count(), 1);
  await page.selectOption('select[name="endpoint-start"]', 'random');
  assert.equal(await page.locator('[data-plan-id^="endpoint-start-"]').count(), 0);
  await cancel(); checks.push('repeat-generation-cancel-and-explicit-random-toggles');
  await page.fill('#generationPrompt', 'Random settings 1');
  await begin(); assert.equal(await page.locator('dialog').innerText(), hiddenText); await cancel();
  checks.push('different-seeds-do-not-reveal-random-presence-or-kind');
  await page.fill('#generationPrompt', 'Random settings 0');
  await begin(); await confirm(); const manual = await exportJson();
  await createTab(); await page.check('#generationAuto');
  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt()), true);
  assert.deepEqual(await exportJson(), manual);
  assert.equal(await page.locator('dialog').count(), 0);
  checks.push('hidden-random-plans-generate-identically-in-Auto-and-Manual');

  requests = safeRequests;
  for (const mode of ['Auto', 'Manual']) for (const selected of ['easy', 'normal', 'hard', 'prompt']) {
    await createTab(); await page.check(`#generation${mode}`);
    apiDifficulty = selected === 'easy' ? 'hard' : 'easy';
    const expected = selected === 'prompt' ? apiDifficulty : selected;
    await page.selectOption('#generationDifficulty', selected);
    if (mode === 'Manual') { await begin(); assert.equal(await page.locator('[data-review-difficulty]').getAttribute('data-review-difficulty'), expected); await confirm(); }
    else assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt()), true);
    assert.equal((await exportJson()).floors[0].dungeon.difficulty, expected);
    checks.push(`${mode}-${selected}-difficulty-precedence`);
  }
  await createTab(); await page.selectOption('#generationDifficulty', 'prompt'); apiDifficulty = null;
  await begin(); assert.equal(await page.locator('[data-review-difficulty]').getAttribute('data-review-difficulty'), 'normal'); await cancel();
  checks.push('unspecified-prompt-difficulty-defaults-to-Normal');
  actualFallback = true;
  await page.fill('#generationPrompt', 'やさしいダンジョン。モンスターハウスはなし。トラップハウスはなし。店はなし。スタートは通常の部屋。ゴールは通常の部屋。');
  await page.selectOption('#generationDifficulty', 'hard'); await begin();
  assert.equal(await page.locator('[data-review-difficulty]').getAttribute('data-review-difficulty'), 'hard');
  await confirm(); assert.equal((await exportJson()).floors[0].dungeon.difficulty, 'hard');
  await createTab(); await page.selectOption('#generationDifficulty', 'prompt'); await begin();
  assert.equal(await page.locator('[data-review-difficulty]').getAttribute('data-review-difficulty'), 'easy'); await cancel();
  checks.push('real-fallback-Japanese-difficulty-and-explicit-UI-priority');
  actualFallback = false; apiDifficulty = 'easy';
  requests = [request('normal', { targetRole: 'goal', presence: 'random' }), request('shop', { targetRole: 'goal', floorNumber: 1 })];
  await page.fill('#floorCount', '2'); await begin();
  assert.equal(await page.locator('[data-plan-id="endpoint-goal-shop-1"]').count(), 1);
  assert.equal(await page.locator('[data-plan-id]').count(), 1);
  await page.selectOption('select[name="endpoint-goal-floor-1"]', 'random');
  assert.equal(await page.locator('[data-plan-id]').count(), 0);
  await cancel(); checks.push('per-floor-fixed-endpoint-visible-random-endpoints-hidden');
  await page.setViewportSize({ width: 820, height: 540 }); await language('ja'); await begin();
  for (const button of await page.locator('dialog button').all()) { const b = await button.boundingBox(); assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 820 && b.y + b.height <= 540); }
  await page.screenshot({ path: path.join(output, 'random-review-short-ja.png') }); await cancel();
  checks.push('short-viewport-confirm-cancel-accessible');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'smoke.json'), JSON.stringify({ generatedAt: new Date().toISOString(), url, visible: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ output, passed: checks.length, errors }));
} catch (error) {
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), stack: error.stack, checks, errors }, null, 2));
  throw error;
} finally { await browser?.close(); vite?.kill(); }
