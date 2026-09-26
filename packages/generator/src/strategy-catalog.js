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

export {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
};

export const RECOMMENDED_GENERATOR_STRATEGY_ID =
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID;

export function createBuiltinGeneratorStrategyRegistry() {
  return createGeneratorStrategyRegistry([
    generatorStrategyV1Classic,
    generatorStrategyV2Recommended,
  ]);
}
