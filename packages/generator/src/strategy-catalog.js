import {
  createGeneratorStrategyRegistry,
} from '../../generator-strategy-core/src/index.js';
import {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  generatorStrategyV1Classic,
} from './strategies/v1-classic.js';
import {
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  generatorStrategyV2Recommended,
} from './strategies/v2-recommended.js';
import {
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  GENERATOR_STRATEGY_BSP_LAB_ID,
  generatorStrategyDelaunayMstLab,
} from './strategies/delaunay-mst-lab.js';
import {
  GENERATOR_STRATEGY_BSP_LAB_ID,
  generatorStrategyBspLab,
} from './strategies/bsp-lab.js';
import { seedFromPromptV1 } from './versions/v1/design-intent-generator.js';

export {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
};

export const RECOMMENDED_GENERATOR_STRATEGY_ID =
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID;

export function deriveGeneratorSeedFromPrompt(prompt) {
  return seedFromPromptV1(prompt);
}

export function createBuiltinGeneratorStrategyRegistry() {
  return createGeneratorStrategyRegistry([
    generatorStrategyV1Classic,
    generatorStrategyV2Recommended,
    generatorStrategyDelaunayMstLab,
    generatorStrategyBspLab,
  ]);
}
