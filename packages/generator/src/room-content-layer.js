import { applyNormalRoomDistinction, respectsNormalRoomDistinction } from './normal-room-distinction.js';
import { decorateGeneratedSpecV3 } from './versions/v3/special-rooms.js';
import { provisionGeneratedShopGoldV3 } from './versions/v3/shop-economy.js';
import { guardGeneratedRouteV3 } from './versions/v3/route-viability.js';

// 地形生成のStrategy/Versionと独立して追跡する。既存Strategy自体の出力は変更しない。
export const ROOM_CONTENT_LAYER_VERSION = 'special-rooms-2';
export const ROOM_CONTENT_LAYER_V1_VERSION = 'special-rooms-1';

export function applyRoomContentLayerV1(generated, intent, config) {
  if (!config) return generated;
  // V3は既に同じ内容処理を実施済み。二重適用しない。
  if (generated.provenance.strategyId === 'version-3-special-rooms') {
    return { ...generated, provenance: { ...generated.provenance, contentLayerVersion: ROOM_CONTENT_LAYER_V1_VERSION } };
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
  result.provenance.contentLayerVersion = ROOM_CONTENT_LAYER_V1_VERSION;
  return result;
}

// V1経路を保存し、通常部屋の数量差別化は新レイヤー版でのみ適用する。
export function applyRoomContentLayer(generated, intent, config, { version = ROOM_CONTENT_LAYER_VERSION } = {}) {
  if (version === ROOM_CONTENT_LAYER_V1_VERSION) return applyRoomContentLayerV1(generated, intent, config);
  if (version !== ROOM_CONTENT_LAYER_VERSION) throw new RangeError('ROOM_CONTENT_LAYER_VERSION_UNSUPPORTED');
  if (!config) return generated;
  const result = structuredClone(applyRoomContentLayerV1(generated, intent, config));
  const profile = result.diagnostics.profile;
  const distinction = applyNormalRoomDistinction(result.spec, { ...config, shopPlacementGuard: profile.shopPlacementGuard });
  const routeViability = guardGeneratedRouteV3(result.spec, { ...config, shopPlacementGuard: profile.shopPlacementGuard, normalRoomCapacity: distinction.limits });
  if (!respectsNormalRoomDistinction(result.spec, distinction.limits)) throw new RangeError('NORMAL_ROOM_CAPACITY_CONFLICT');
  profile.normalRoomDistinction = distinction;
  if (routeViability) profile.routeViability = routeViability;
  for (const type of ['enemy', 'treasure', 'trap', 'recovery']) profile[`${type}Count`] = result.spec.entities.filter((entity) => entity.type === type).length;
  profile.specialRooms = result.spec.rooms.filter(({ kind }) => kind && kind !== 'normal').map(({ id, kind }) => ({ roomId: id, kind }));
  result.provenance.contentLayerVersion = ROOM_CONTENT_LAYER_VERSION;
  return result;
}
