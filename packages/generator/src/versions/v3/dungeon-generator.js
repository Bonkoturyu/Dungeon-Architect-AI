import { generateDungeonSpecV2 } from '../v2/dungeon-generator.js';
import { decorateGeneratedSpecV3 } from './special-rooms.js';
import { provisionGeneratedShopGoldV3 } from './shop-economy.js';
import { guardGeneratedRouteV3 } from './route-viability.js';

export const GENERATOR_VERSION = '3';

export function generateDungeonSpecV3({ roomPlans = [], equipmentRules, difficulty, difficultyProfile, specialRoomEntityLimit, initialPlayerState, ...options } = {}) {
  const diagnostics = {};
  const spec = decorateGeneratedSpecV3(generateDungeonSpecV2(options), { roomPlans, equipmentRules, difficulty, difficultyProfile, specialRoomEntityLimit, diagnostics, initialPlayerState });
  provisionGeneratedShopGoldV3(spec);
  guardGeneratedRouteV3(spec, { roomPlans, difficultyProfile, initialPlayerState, shopPlacementGuard: diagnostics.shopPlacementGuard });
  return spec;
}
