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
  GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID,
  generatorStrategyV3SpecialRooms,
} from './strategies/v3-special-rooms.js';
import {
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  generatorStrategyDelaunayMstLab,
} from './strategies/delaunay-mst-lab.js';
import {
  GENERATOR_STRATEGY_BSP_LAB_ID,
  generatorStrategyBspLab,
} from './strategies/bsp-lab.js';
import {
  GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
  generatorStrategyRoomsMazesLab,
} from './strategies/rooms-mazes-lab.js';
import {
  GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  generatorStrategyRandomWalkLab,
} from './strategies/random-walk-lab.js';
import {
  GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  generatorStrategyCellularAutomataLab,
} from './strategies/cellular-automata-lab.js';
import {
  GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
  generatorStrategyMazeCarvingLab,
} from './strategies/maze-carving-lab.js';
import {
  GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID,
  generatorStrategyGameplayGrammarLab,
} from './strategies/gameplay-grammar-lab.js';
import {
  GENERATOR_STRATEGY_WFC_LAB_ID,
  generatorStrategyWfcLab,
} from './strategies/wfc-lab.js';
import { seedFromPromptV1 } from './versions/v1/design-intent-generator.js';

export {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID,
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  GENERATOR_STRATEGY_BSP_LAB_ID,
  GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
  GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
  GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID,
  GENERATOR_STRATEGY_WFC_LAB_ID,
};

export const RECOMMENDED_GENERATOR_STRATEGY_ID =
  GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID;

export function deriveGeneratorSeedFromPrompt(prompt) {
  return seedFromPromptV1(prompt);
}

export function createBuiltinGeneratorStrategyRegistry() {
  return createGeneratorStrategyRegistry([
    generatorStrategyV1Classic,
    generatorStrategyV2Recommended,
    generatorStrategyV3SpecialRooms,
    generatorStrategyDelaunayMstLab,
    generatorStrategyBspLab,
    generatorStrategyRoomsMazesLab,
    generatorStrategyRandomWalkLab,
    generatorStrategyCellularAutomataLab,
    generatorStrategyMazeCarvingLab,
    generatorStrategyGameplayGrammarLab,
    generatorStrategyWfcLab,
  ]);
}
