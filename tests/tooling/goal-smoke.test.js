import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

for (const script of ['run-goal-dormant-smoke.mjs', 'run-room-content-ui-smoke.mjs', 'run-dai-095-multi-floor-smoke.mjs']) test(`${script} resolves build-info from the deployment root for root and deep editor URLs`, () => {
  const source = readFileSync(new URL(`../../scripts/${script}`, import.meta.url), 'utf8');
  const buildInfoUrl = source.match(/new URL\((['"])(.*?)\1,\s*url\)\.href/);
  assert.ok(buildInfoUrl, 'the smoke must resolve its build-info URL from DAI_SMOKE_URL');
  for (const pathname of ['/', '/apps/editor-slice/index.html', '/apps/editor-slice/index.html?lang=ja#goal']) {
    assert.equal(new URL(buildInfoUrl[2], `https://example.test${pathname}`).href, 'https://example.test/build-info.json');
  }
});
