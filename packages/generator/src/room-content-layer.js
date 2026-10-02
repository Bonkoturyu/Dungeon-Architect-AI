import { guardFirstShopPlacementV3 } from './versions/v3/shop-placement.js';
import { validateTrapRules } from '../../core/src/dungeon-spec.js';
import { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';
import { applyNormalRoomDistinction, respectsNormalRoomDistinction } from './normal-room-distinction.js';
import { decorateGeneratedSpecV3 } from './versions/v3/special-rooms.js';
import { provisionGeneratedShopGoldV3 } from './versions/v3/shop-economy.js';
import { guardGeneratedRouteV3 } from './versions/v3/route-viability.js';

// 地形生成のStrategy/Versionと独立して追跡する。既存Strategy自体の出力は変更しない。
export const ROOM_CONTENT_LAYER_VERSION = 'special-rooms-3';

function decorateRoomContent(generated, intent, config) {
  // V3は既に同じ内容処理を実施済み。二重適用しない。
  if (generated.provenance.strategyId === 'version-3-special-rooms') {
    return generated;
  }
  const result = structuredClone(generated);
  const diagnostics = {};
  decorateGeneratedSpecV3(result.spec, {
    ...config,
    diagnostics,
    trapWarning: intent.telegraphStrength >= 0.5 ? 'floor-cracks' : 'subtle-draft',
  });
  const economy = provisionGeneratedShopGoldV3(result.spec);
  const routeViability = guardGeneratedRouteV3(result.spec, { ...config, shopPlacementGuard: diagnostics.shopPlacementGuard });
  const profile = result.diagnostics.profile ??= {};
  for (const type of ['enemy', 'treasure', 'trap', 'recovery']) {
    profile[`${type}Count`] = result.spec.entities.filter((entity) => entity.type === type).length;
  }
  profile.specialRooms = result.spec.rooms.filter(({ kind }) => kind && kind !== 'normal').map(({ id, kind }) => ({ roomId: id, kind }));
  if (economy !== null) profile.shopEconomy = economy;
  if (diagnostics.shopPlacementGuard) profile.shopPlacementGuard = diagnostics.shopPlacementGuard;
  if (routeViability) profile.routeViability = routeViability;
  return result;
}

function applyRoomCounts(generated, intent, config) {
  const result = structuredClone(decorateRoomContent(generated, intent, config));
  const profile = result.diagnostics.profile;
  const distinction = applyNormalRoomDistinction(result.spec, { ...config, shopPlacementGuard: profile.shopPlacementGuard });
  const routeViability = guardGeneratedRouteV3(result.spec, { ...config, shopPlacementGuard: profile.shopPlacementGuard, normalRoomCapacity: distinction.limits });
  if (!respectsNormalRoomDistinction(result.spec, distinction.limits)) throw new RangeError('NORMAL_ROOM_CAPACITY_CONFLICT');
  profile.normalRoomDistinction = distinction;
  if (routeViability) profile.routeViability = routeViability;
  for (const type of ['enemy', 'treasure', 'trap', 'recovery']) profile[`${type}Count`] = result.spec.entities.filter((entity) => entity.type === type).length;
  profile.specialRooms = result.spec.rooms.filter(({ kind }) => kind && kind !== 'normal').map(({ id, kind }) => ({ roomId: id, kind }));
  return result;
}

// 共通内容は現行版だけを提供する。地形Strategy/Generator Versionとは独立。
export function applyRoomContentLayer(generated, intent, config, { version = ROOM_CONTENT_LAYER_VERSION } = {}) {
  if (version !== ROOM_CONTENT_LAYER_VERSION) throw new RangeError('ROOM_CONTENT_LAYER_VERSION_UNSUPPORTED');
  if (!config) return generated;
  const candidate = structuredClone(generated);
  const trapRules = config.trapRules === undefined ? TRAP_RULES_V1 : config.trapRules;
  if (!validateTrapRules(trapRules).valid) throw new TypeError('TRAP_RULES_UNSUPPORTED');
  candidate.spec.trapRules = { ...trapRules };
  // ルール未指定の装飾済み入力も、現行判定で店までの経路を検査する。
  if (candidate.provenance.strategyId === 'version-3-special-rooms' && !generated.spec.trapRules) {
    const plans = candidate.spec.entities.filter(({ type }) => type === 'shop').map((entity) => ({
      id: entity.id, kind: 'shop', roomId: entity.roomId, autoAssigned: false,
    }));
    const check = guardFirstShopPlacementV3(candidate.spec, plans, config);
    if (check.diagnostics) candidate.diagnostics.profile.shopPlacementGuard = check.diagnostics;
  }
  const result = applyRoomCounts(candidate, intent, { ...config, trapRules: candidate.spec.trapRules });
  result.provenance.contentLayerVersion = ROOM_CONTENT_LAYER_VERSION;
  return result;
}
