import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  getMessage,
  getNextLanguage,
  resolveMessageFromCatalogs,
  setLanguage,
} from '../../apps/editor-slice/i18n.js';

test('English is the stable default UI language and cycle order is deterministic', () => {
  setLanguage('en');
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.deepEqual(
    LANGUAGE_OPTIONS.map((option) => option.id),
    ['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko'],
  );
  assert.equal(getNextLanguage('en'), 'ja');
  assert.equal(getNextLanguage('ja'), 'zh-Hans');
  assert.equal(getNextLanguage('zh-Hans'), 'zh-Hant');
  assert.equal(getNextLanguage('zh-Hant'), 'ko');
  assert.equal(getNextLanguage('ko'), 'en');
});

test('message lookup is keyed by stable IDs rather than rendered text', () => {
  assert.equal(getMessage('en', 'tabs.create'), '✨ Create');
  assert.equal(getMessage('ja', 'tabs.create'), '✨ 作成');
  assert.equal(getMessage('zh-Hans', 'tabs.create'), '✨ 创建');
  assert.equal(getMessage('zh-Hant', 'tabs.create'), '✨ 建立');
  assert.equal(getMessage('ko', 'tabs.create'), '✨ 생성');
});

test('missing localized messages fall back to the default English catalog', () => {
  const catalogs = {
    en: {
      'example.present': 'English fallback',
      'example.variable': 'Rooms: {count}',
    },
    ja: {},
  };

  assert.equal(
    resolveMessageFromCatalogs(catalogs, 'ja', 'example.present'),
    'English fallback',
  );
  assert.equal(
    resolveMessageFromCatalogs(catalogs, 'ja', 'example.variable', { count: 5 }),
    'Rooms: 5',
  );
});

test('unknown language identifiers fail safely to English messages', () => {
  assert.equal(getMessage('unsupported-language', 'tabs.create'), '✨ Create');
});
