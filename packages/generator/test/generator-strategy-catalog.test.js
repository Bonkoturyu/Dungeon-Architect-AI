import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  generateDungeonFromDesignIntentV1,
} from '../src/versions/v1/design-intent-generator.js';
import {
  generateDungeonFromDesignIntentV2,
} from '../src/versions/v2/design-intent-generator.js';
import {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  GENERATOR_STRATEGY_BSP_LAB_ID,
  GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
  GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  RECOMMENDED_GENERATOR_STRATEGY_ID,
  createBuiltinGeneratorStrategyRegistry,
} from '../src/strategy-catalog.js';

const request = {
  seed: 20260926,
  prompt: 'strategy catalog fixture',
  intent: {
    ...DEFAULT_DESIGN_INTENT,
    targetDuration: 420,
    routeChoice: 0.65,
  },
};

test('built-in strategy catalog exposes versioned strategies plus accepted Algorithm Lab entries without coupling the core registry to implementations', () => {
  const registry = createBuiltinGeneratorStrategyRegistry();
  assert.deepEqual(
    registry.list().map((entry) => entry.id),
    [
      GENERATOR_STRATEGY_V1_CLASSIC_ID,
      GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
      GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
      GENERATOR_STRATEGY_BSP_LAB_ID,
      GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
      GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
    ],
  );
  assert.equal(
    RECOMMENDED_GENERATOR_STRATEGY_ID,
    GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  );
});

test('Version 1 strategy adapter preserves the frozen V1 generator output', async () => {
  const registry = createBuiltinGeneratorStrategyRegistry();
  const direct = generateDungeonFromDesignIntentV1(
    request.intent,
    request,
  );
  const adapted = await registry.generate(
    GENERATOR_STRATEGY_V1_CLASSIC_ID,
    request,
  );

  assert.deepEqual(adapted.spec, direct.spec);
  assert.equal(adapted.provenance.generatorVersion, '1');
  assert.equal(adapted.provenance.strategyId, GENERATOR_STRATEGY_V1_CLASSIC_ID);
});

test('Version 2 strategy adapter preserves the accepted V2 generator output', async () => {
  const registry = createBuiltinGeneratorStrategyRegistry();
  const direct = generateDungeonFromDesignIntentV2(
    request.intent,
    request,
  );
  const adapted = await registry.generate(
    GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
    request,
  );

  assert.deepEqual(adapted.spec, direct.spec);
  assert.equal(adapted.provenance.generatorVersion, '2');
  assert.equal(
    adapted.provenance.strategyId,
    GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  );
});
