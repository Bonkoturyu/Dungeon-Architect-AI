import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// UI・音・イベントの既存fixtureは通常部屋を前提とする。ランダム特殊部屋への
// 置換だけを明示的に除外し、難易度・敵/罠・現行70%回避ルールは変更しない。
export function normalRoomRequests() {
  return [
    ...['monster-house', 'trap-house', 'shop'].map((kind) => ({
      kind, presence: 'exclude', roomCount: null, entityCount: null,
      floorNumber: null, roomId: null, offers: [],
    })),
    ...['start', 'goal'].map((targetRole) => ({
      kind: 'normal', targetRole, presence: 'include', roomCount: 1,
      entityCount: null, floorNumber: null, roomId: null, offers: [],
    })),
  ];
}

// 実際のManual確認UIを通す。自動選択やDOMからの強制closeで省略しない。
export async function confirmManualGeneration(page) {
  assert.equal(await page.locator('#generationManual').isChecked(), true,
    'The smoke must exercise the current Manual generation default.');
  const dialog = page.locator('dialog.special-room-review');
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  const submit = dialog.locator('button[type="submit"]');
  assert.equal(await submit.isEnabled(), true, 'The reviewed plan must be valid.');
  await submit.click();
  await dialog.waitFor({ state: 'detached', timeout: 30_000 });
  return { mode: 'manual', dialogObserved: true, planSubmitted: true };
}

// 途中例外でも小さなJSONを残す。失敗を隠さず、呼出側が元の例外を再throwする。
export async function captureBrowserFailure({ page, error, outputDir }) {
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    passed: false,
    error: { name: error?.name ?? 'Error', message: String(error?.message ?? error) },
    url: null,
    state: null,
    captureErrors: [],
  };
  try {
    if (page && !page.isClosed()) {
      evidence.url = page.url();
      evidence.state = await page.evaluate(() => {
        const state = window.__DAI_EDITOR_SLICE__?.getState?.();
        const dialog = document.querySelector('dialog.special-room-review');
        return {
          ready: window.__DAI_EDITOR_SLICE__?.ready ?? false,
          mode: state?.mode ?? null,
          generationBusy: state?.generationBusy ?? null,
          generationStatus: document.querySelector('#generationStatus')?.textContent ?? null,
          generationManual: document.querySelector('#generationManual')?.checked ?? null,
          generationAuto: document.querySelector('#generationAuto')?.checked ?? null,
          generatorStrategyId: state?.generatorStrategyId ?? null,
          roomCount: state?.rooms?.length ?? null,
          lastGeneration: state?.lastGeneration ? {
            seed: state.lastGeneration.seed,
            roomCount: state.lastGeneration.roomCount,
            floorCount: state.lastGeneration.floorCount,
          } : null,
          reviewDialog: dialog ? {
            open: dialog.open,
            heading: dialog.querySelector('h2')?.textContent ?? null,
            alert: dialog.querySelector('[role="alert"]')?.textContent ?? null,
            submitDisabled: dialog.querySelector('button[type="submit"]')?.disabled ?? null,
            selections: Object.fromEntries([...dialog.querySelectorAll('select[name]')]
              .map((select) => [select.name, select.value])),
          } : null,
        };
      });
    }
  } catch (captureError) {
    evidence.captureErrors.push(String(captureError?.message ?? captureError));
  }
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'browser-smoke-failure.json'),
      JSON.stringify(evidence, null, 2) + '\n');
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(outputDir, 'browser-smoke-failure.png'), fullPage: true });
    }
  } catch (captureError) {
    console.error('Failure evidence capture:', String(captureError?.message ?? captureError));
  }
  return evidence;
}
