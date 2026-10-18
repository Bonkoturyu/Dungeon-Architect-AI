import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOMMENDED_GENERATOR_STRATEGY_ID,
  createBuiltinGeneratorStrategyRegistry,
} from '../../packages/generator/src/strategy-catalog.js';
import { LANGUAGE_OPTIONS, getMessage, getLanguage, setLanguage } from '../../apps/editor-slice/i18n.js';
import {
  generatorStrategyLabel,
  renderGeneratorStrategyOptions,
} from '../../apps/editor-slice/ui/generator-options.js';

const LABEL_KEYS = {
  'version-1-classic': 'create.generatorClassic',
  'version-2-spatial': 'create.generatorV2',
  'version-3-special-rooms': 'create.generatorV3',
  'algorithm-lab.delaunay-mst-loops': 'create.generatorDelaunayMst',
  'algorithm-lab.bsp': 'create.generatorBsp',
  'algorithm-lab.rooms-mazes': 'create.generatorRoomsMazes',
  'algorithm-lab.random-walk': 'create.generatorRandomWalk',
  'algorithm-lab.cellular-automata': 'create.generatorCellularAutomata',
  'algorithm-lab.maze-carving': 'create.generatorMazeCarving',
  'algorithm-lab.gameplay-grammar': 'create.generatorGameplayGrammar',
  'algorithm-lab.wfc': 'create.generatorWfc',
};

test('組み込みの11方式すべてに、5言語の翻訳済み表示名がある', () => {
  const strategies = createBuiltinGeneratorStrategyRegistry().list();
  // 方式を追加して表示名の対応を忘れた場合に失敗させる
  assert.deepEqual(strategies.map(({ id }) => id).sort(), Object.keys(LABEL_KEYS).sort());
  for (const { id: language } of LANGUAGE_OPTIONS) {
    if (getLanguage() !== language) setLanguage(language);
    for (const metadata of strategies) {
      const label = generatorStrategyLabel(metadata);
      assert.equal(label, getMessage(language, LABEL_KEYS[metadata.id]), `${language}:${metadata.id}`);
      assert.notEqual(label, LABEL_KEYS[metadata.id], `${language}:${metadata.id} は未翻訳のkeyを表示している`);
      assert.ok(label.trim().length > 0, `${language}:${metadata.id}`);
    }
  }
});

test('未登録の方式は displayName をそのまま表示する', () => {
  assert.equal(generatorStrategyLabel({ id: 'custom.strategy', displayName: 'Custom' }), 'Custom');
});

test('選択肢を作り直し、無効な選択は推奨方式（V3）に戻す', (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  globalThis.document = { createElement: (tag) => ({ tag, dataset: {} }) };
  const registry = createBuiltinGeneratorStrategyRegistry();
  const select = {
    value: 'removed-strategy',
    options: [],
    replaceChildren(...options) { this.options = options; },
  };

  renderGeneratorStrategyOptions({ generatorStrategySelect: select, generatorStrategyRegistry: registry });
  assert.equal(select.value, RECOMMENDED_GENERATOR_STRATEGY_ID);
  assert.deepEqual(select.options.map((option) => option.value), registry.list().map(({ id }) => id));
  assert.ok(select.options.every((option) => option.tag === 'option' && option.textContent && option.dataset.family));

  select.value = 'algorithm-lab.bsp';
  renderGeneratorStrategyOptions({ generatorStrategySelect: select, generatorStrategyRegistry: registry });
  assert.equal(select.value, 'algorithm-lab.bsp');
});
