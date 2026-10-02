import {
  deriveGenerationProfileV2,
  generateDungeonFromDesignIntentV2,
  seedFromPromptV2,
} from '../v2/design-intent-generator.js';
import { decorateGeneratedSpecV3 } from './special-rooms.js';
import { provisionGeneratedShopGoldV3 } from './shop-economy.js';
import { guardGeneratedRouteV3 } from './route-viability.js';

export const seedFromPromptV3 = seedFromPromptV2;
export const deriveGenerationProfileV3 = deriveGenerationProfileV2;

export function generateDungeonFromDesignIntentV3(intent, {
  roomPlans = [],
  equipmentRules,
  difficulty,
  difficultyProfile,
  specialRoomEntityLimit,
  initialPlayerState,
  ...options
} = {}) {
  const result = generateDungeonFromDesignIntentV2(intent, options);
  const diagnostics = {};
  decorateGeneratedSpecV3(result.spec, {
    roomPlans,
    equipmentRules,
    difficulty,
    difficultyProfile,
    specialRoomEntityLimit,
    diagnostics,
    initialPlayerState,
    trapWarning: intent.telegraphStrength >= 0.5 ? 'floor-cracks' : 'subtle-draft',
  });
  const economy = provisionGeneratedShopGoldV3(result.spec);
  const routeViability = guardGeneratedRouteV3(result.spec, { roomPlans, difficultyProfile, initialPlayerState, shopPlacementGuard: diagnostics.shopPlacementGuard });
  if (roomPlans.length > 0) {
    // Profileの既存件数も特殊部屋による置換後の実際の個数を示す。
    for (const type of ['enemy', 'treasure', 'trap', 'recovery']) {
      result.profile[`${type}Count`] = result.spec.entities.filter((entity) => entity.type === type).length;
    }
    result.profile.specialRooms = result.spec.rooms
      .filter(({ kind }) => kind && kind !== 'normal')
      .map(({ id, kind }) => ({ roomId: id, kind }));
  }
  if (economy !== null) result.profile.shopEconomy = economy;
  if (diagnostics.shopPlacementGuard) result.profile.shopPlacementGuard = diagnostics.shopPlacementGuard;
  if (routeViability) result.profile.routeViability = routeViability;
  return result;
}
