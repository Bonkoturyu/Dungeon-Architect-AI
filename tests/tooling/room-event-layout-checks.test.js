import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { evaluateRoomEventLayout, readRoomEventLayout } from '../../scripts/room-event-layout-checks.mjs';

function element(left, top, width, height) {
  return {
    rect: { left, right: left + width, top, bottom: top + height, width, height },
    hidden: false,
    display: 'block',
    visibility: 'visible',
    visible: true,
  };
}

function sample() {
  return {
    events: element(500, 280, 440, 200),
    viewport: element(0, 68, 1440, 832),
    exits: element(600, 520, 240, 220),
    eventCenterX: 720,
    eventCenterY: 380,
    viewportCenterX: 720,
    viewportCenterY: 484,
    windowWidth: 1440,
    windowHeight: 900,
  };
}

function shift(rect, x, y) {
  rect.left += x;
  rect.right += x;
  rect.top += y;
  rect.bottom += y;
}

test('104px上・水平中央・viewport内・出口非重複のdesktop配置は合格する', () => {
  const input = sample();
  const unchanged = structuredClone(input);
  assert.deepEqual(evaluateRoomEventLayout(input), {
    expectedOffsetPx: 104,
    actualOffsetPx: 104,
    tolerancePx: 3,
    gapPx: 40,
    checks: { horizontalCentered: true, offsetAboveViewportCenter: true, insideViewport: true, clearOfExitPad: true },
    passed: true,
  });
  assert.deepEqual(input, unchanged);
});

test('旧viewport中心0pxと逆向きoffsetは拒否し、診断中心値で矩形判定を上書きできない', () => {
  for (const delta of [104, 208]) {
    const input = sample();
    shift(input.events.rect, 0, delta);
    const result = evaluateRoomEventLayout(input);
    assert.equal(result.checks.offsetAboveViewportCenter, false);
    assert.equal(result.actualOffsetPx, 104 - delta);
    assert.equal(result.passed, false);
  }
});

test('水平ずれは拒否し、中心の許容差は両軸3pxまでに固定する', () => {
  for (const [x, y, horizontal, vertical] of [[3, 3, true, true], [-3, -3, true, true], [3.01, 0, false, true], [0, 3.01, true, false]]) {
    const input = sample();
    shift(input.events.rect, x, y);
    const result = evaluateRoomEventLayout(input);
    assert.equal(result.checks.horizontalCentered, horizontal);
    assert.equal(result.checks.offsetAboveViewportCenter, vertical);
  }
});

test('出口の重なりと接触を拒否し、正の実測gapを要求する', () => {
  for (const gap of [-1, 0, 1]) {
    const input = sample();
    input.exits = element(600, input.events.rect.bottom + gap, 240, 220);
    const result = evaluateRoomEventLayout(input);
    assert.equal(result.gapPx, gap);
    assert.equal(result.checks.clearOfExitPad, gap > 0);
    assert.equal(result.passed, gap > 0);
  }
});

test('viewport外の矩形は中心が正しくても拒否する', () => {
  const input = sample();
  input.events = element(-10, 280, 1460, 200);
  const result = evaluateRoomEventLayout(input);
  assert.equal(result.checks.horizontalCentered, true);
  assert.equal(result.checks.offsetAboveViewportCenter, true);
  assert.equal(result.checks.insideViewport, false);
  assert.equal(result.passed, false);
});

for (const key of ['events', 'viewport', 'exits']) {
  test(`${key}: hidden・CSS非表示・zero・欠落・非有限矩形を合格にしない`, () => {
    const mutations = [
      (entry) => { entry.hidden = true; },
      (entry) => { entry.visible = false; },
      (entry) => { entry.display = 'none'; },
      (entry) => { entry.visibility = 'hidden'; },
      (entry) => { entry.visibility = 'collapse'; },
      (entry) => { entry.rect.width = 0; },
      (entry) => { entry.rect.height = 0; },
      (entry) => { entry.rect.left = NaN; },
      (entry) => { entry.rect.bottom = Infinity; },
      (entry) => { delete entry.rect.top; },
      (entry) => { entry.rect = null; },
    ];
    for (const mutate of mutations) {
      const input = sample();
      mutate(input[key]);
      const result = evaluateRoomEventLayout(input);
      assert.equal(result.passed, false);
      if (key === 'events' || key === 'viewport') {
        assert.equal(result.checks.horizontalCentered, false);
        assert.equal(result.checks.offsetAboveViewportCenter, false);
        assert.equal(result.checks.insideViewport, false);
      }
      if (key === 'events' || key === 'exits') {
        assert.equal(result.checks.clearOfExitPad, false);
        assert.equal(result.gapPx, null);
      }
    }
    const input = sample();
    delete input[key];
    assert.equal(evaluateRoomEventLayout(input).passed, false);
  });
}

test('blocking中のhidden出口は中心判定から分離し、非重複PASSにはしない', () => {
  const input = sample();
  input.exits.hidden = true;
  const result = evaluateRoomEventLayout(input);
  assert.equal(result.checks.horizontalCentered, true);
  assert.equal(result.checks.offsetAboveViewportCenter, true);
  assert.equal(result.checks.insideViewport, true);
  assert.equal(result.checks.clearOfExitPad, false);
  assert.equal(result.passed, false);
});

test('800px以下と不明なwindow幅はdesktop契約の合格にしない', () => {
  for (const width of [800, 799, 0, NaN, undefined]) {
    const input = sample();
    input.windowWidth = width;
    assert.equal(evaluateRoomEventLayout(input).passed, false);
    assert.ok(Object.values(evaluateRoomEventLayout(input).checks).every((value) => value === false));
  }
  assert.equal(evaluateRoomEventLayout(undefined).passed, false);
  assert.equal(evaluateRoomEventLayout(null).passed, false);
});

function domPage(input, mutate = () => {}) {
  const elements = Object.fromEntries([
    ['#roomEventBar', input.events], ['.viewport-shell', input.viewport], ['#playExitBar', input.exits],
  ].map(([selector, entry]) => [selector, entry ? {
    hidden: entry.hidden,
    style: { display: entry.display, visibility: entry.visibility, opacity: '1' },
    parentElement: null,
    getBoundingClientRect: () => entry.rect,
  } : null]));
  mutate(elements);
  const selectors = [];
  return {
    selectors,
    async evaluate(callback) {
      return vm.runInNewContext(`(${callback.toString()})()`, {
        document: { querySelector(selector) { selectors.push(selector); return elements[selector]; } },
        window: { innerWidth: input.windowWidth, innerHeight: input.windowHeight },
        getComputedStyle: (entry) => entry.style,
      });
    },
  };
}

test('実DOM readerは指定の3要素・矩形・可視性・中心・window寸法を一度に取得する', async () => {
  const input = sample();
  const page = domPage(input);
  const result = await readRoomEventLayout(page);
  assert.deepEqual(page.selectors, ['#roomEventBar', '.viewport-shell', '#playExitBar']);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), input);
  assert.equal(evaluateRoomEventLayout(result).passed, true);
});

test('実DOM readerは欠落要素と祖先のhidden・display・visibility・opacityを拒否する', async () => {
  for (const override of [
    { hidden: true },
    { display: 'none' },
    { visibility: 'hidden' },
    { visibility: 'collapse' },
    { opacity: '0' },
  ]) {
    const page = domPage(sample(), (elements) => {
      elements['#playExitBar'].parentElement = {
        hidden: override.hidden === true,
        style: { display: 'grid', visibility: 'visible', opacity: '1', ...override },
        parentElement: null,
      };
    });
    const result = await readRoomEventLayout(page);
    assert.equal(result.exits.visible, false);
    assert.equal(evaluateRoomEventLayout(result).checks.clearOfExitPad, false);
  }
  const input = sample();
  delete input.events;
  const result = await readRoomEventLayout(domPage(input));
  assert.equal(result.events.rect, null);
  assert.equal(result.events.visible, false);
  assert.equal(result.eventCenterX, null);
  assert.equal(result.eventCenterY, null);
  assert.equal(evaluateRoomEventLayout(result).passed, false);
});

test('OwnerとEvent feedbackは共有判定と実表示出口sampleを必須gateへ接続する', () => {
  const owner = fs.readFileSync(new URL('../../scripts/run-owner-ui-review-smoke.mjs', import.meta.url), 'utf8');
  const feedback = fs.readFileSync(new URL('../../scripts/run-dai-100-event-feedback-smoke.mjs', import.meta.url), 'utf8');
  for (const source of [owner, feedback]) {
    assert.match(source, /import\s*\{\s*readRoomEventLayout,\s*evaluateRoomEventLayout\s*\}\s*from\s*['"]\.\/room-event-layout-checks\.mjs['"]/);
    assert.match(source, /await readRoomEventLayout\(page\)/);
    assert.match(source, /evaluateRoomEventLayout\(/);
    assert.doesNotMatch(source, /roomEventStackCentered|roomEventIntroPreservesCenter\s*:/);
  }
  assert.match(owner, /roomEventsLeaveVisibleExitPadClear:\s*exitClearance\.passed/);
  assert.match(owner, /eventPlacement\.checks\.horizontalCentered\s*&&\s*eventPlacement\.checks\.offsetAboveViewportCenter\s*&&\s*eventPlacement\.checks\.insideViewport/);
  const ownerExitSample = owner.slice(owner.lastIndexOf('await page.reload('), owner.indexOf('const checks ='));
  const ownerSteps = [
    'await page.reload(',
    "await page.click('#start')",
    'corridor-1',
    '[data-action="clear-enemy"]',
    'await page.locator(\'.room-event [data-action="open-treasure"]\').waitFor({ state: \'visible\' })',
    "await page.locator('#playExitBar').waitFor({ state: 'visible' })",
    "!document.querySelector('#roomEventBar').classList.contains('is-event-intro')",
    'const exitClearanceSample = await readRoomEventLayout(page)',
    'const exitClearance = evaluateRoomEventLayout(exitClearanceSample)',
  ];
  let previous = -1;
  for (const marker of ownerSteps) {
    const index = ownerExitSample.indexOf(marker);
    assert.ok(index > previous, `Owner sample must include ordered step: ${marker}`);
    previous = index;
  }
  assert.match(feedback, /treasureStackLeavesVisibleExitPadClear:\s*treasureVisit\?\.exitClearance\?\.passed === true/);
  assert.match(feedback, /introPlacement\.checks\.horizontalCentered\s*&&\s*introPlacement\.checks\.offsetAboveViewportCenter\s*&&\s*introPlacement\.checks\.insideViewport/);
  const treasureVisit = feedback.slice(feedback.indexOf('async function visitTreasure('), feedback.indexOf('async function finishFloor('));
  const treasureSteps = [
    'await resolveBlockingEvents(page)',
    'const button = page.locator(\'.room-event [data-action="open-treasure"]\').first()',
    "await page.locator('#playExitBar').waitFor({ state: 'visible' })",
    "!document.querySelector('#roomEventBar').classList.contains('is-event-intro')",
    'const layout = await readRoomEventLayout(page)',
    'const exitClearance = evaluateRoomEventLayout(layout)',
    'await button.click()',
  ];
  previous = -1;
  for (const marker of treasureSteps) {
    const index = treasureVisit.indexOf(marker);
    assert.ok(index > previous, `Treasure sample must include ordered step: ${marker}`);
    previous = index;
  }
});
