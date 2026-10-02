import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { LANGUAGE_OPTIONS, MESSAGE_CATALOGS, getMessage } from '../../apps/editor-slice/i18n.js';

test('trap attempt, chances, success and failure have explicit entries in all five locales', () => {
  for (const { id } of LANGUAGE_OPTIONS) for (const key of ['action.avoid', 'trap.chance', 'trap.failureDamage', 'trap.avoided', 'trap.triggered']) {
    assert.ok(Object.hasOwn(MESSAGE_CATALOGS[id], key), `${id}:${key}`);
    assert.ok(getMessage(id, key, { chance: 70, damage: 6 }).length > 0);
  }
  assert.equal(getMessage('ja', 'action.avoid'), '回避を試みる');
});

test('route conflict guidance names the current Manual setting in all five locales', () => {
  for (const { id } of LANGUAGE_OPTIONS) {
    const message = getMessage(id, 'roomReview.viabilityConflict');
    assert.ok(message.includes(getMessage(id, 'create.manual')), `${id}:${message}`);
    assert.doesNotMatch(message, /Auto|OFF|关闭|關閉/);
  }
});

test('browser exposes no deliberate trap-trigger action and selects feedback from actual outcome', () => {
  const source = readFileSync(new URL('../../apps/editor-slice/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /['"]trigger-trap['"]/);
  assert.match(source, /result\.avoidance\?\.outcome === 'triggered'/);
  assert.match(source, /getTrapAvoidanceChance\(playSession\)/);
});
