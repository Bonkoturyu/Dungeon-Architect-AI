import {
  DUNGEON_DIFFICULTIES,
  validateDungeonSpec,
  validateEquipmentRules,
  validateShopOffers,
} from '../../../../core/src/dungeon-spec.js';
import { createPrng, pickIndex } from '../v1/prng.js';
import { guardFirstShopPlacementV3 } from './shop-placement.js';
import {
  DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT,
  validateConfirmedRoomPlanLimits,
} from '../../../../intent/src/room-limits.js';

export { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, MAX_SPECIAL_ROOM_ENTITY_LIMIT } from '../../../../intent/src/room-limits.js';

const SPECIAL_ROOM_KINDS = new Set(['monster-house', 'trap-house', 'shop']);

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertValidation(result, label) {
  if (!result.valid) {
    throw new TypeError(`${label}: ${result.errors.map(({ code, path }) => `${code} (${path})`).join(', ')}`);
  }
}

function validateRoomPlans(roomPlans, specialRoomEntityLimit) {
  validateConfirmedRoomPlanLimits(roomPlans, specialRoomEntityLimit);
  const ids = new Set();
  const floors = new Set();
  for (const [index, plan] of roomPlans.entries()) {
    const label = `roomPlans[${index}]`;
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      throw new TypeError(`${label} must be an object`);
    }
    const id = plan.id === undefined ? `room-plan-${index + 1}` : plan.id;
    assertNonEmptyString(id, `${label}.id`);
    if (ids.has(id)) throw new RangeError(`Duplicate room plan ID: ${id}`);
    ids.add(id);
    if (!SPECIAL_ROOM_KINDS.has(plan.kind)) {
      throw new RangeError(`${label}.kind must be monster-house, trap-house, or shop`);
    }
    if (!Number.isSafeInteger(plan.floorNumber) || plan.floorNumber < 1) {
      throw new TypeError(`${label}.floorNumber must be a positive safe integer`);
    }
    floors.add(plan.floorNumber);
    if (plan.targetRole !== undefined && !['start', 'goal'].includes(plan.targetRole)) throw new RangeError('Invalid endpoint role');
    if (plan.roomId !== null) assertNonEmptyString(plan.roomId, `${label}.roomId`);
    if (plan.kind === 'shop') {
      if (plan.entityCount !== null) throw new TypeError(`${label}.entityCount must be null for a shop`);
      assertValidation(validateShopOffers(plan.offers, `${label}.offers`), 'Invalid shop plan');
    } else {
      if (!Number.isSafeInteger(plan.entityCount) || plan.entityCount < 1) {
        throw new TypeError(`${label}.entityCount must be an explicit positive safe integer`);
      }
      if (!Array.isArray(plan.offers) || plan.offers.length !== 0) {
        throw new TypeError(`${label}.offers must be an empty array for a house`);
      }
    }
  }
  if (floors.size > 1) throw new RangeError('roomPlans must contain only the current floor; filter plans before generation');
}

function selectRooms(spec, roomPlans) {
  roomPlans = roomPlans.map((plan) => plan.targetRole ? { ...plan, roomId: spec.entities.find(({ type }) => type === plan.targetRole)?.roomId } : plan);
  const protectedRoomIds = new Set(spec.entities
    .filter(({ type }) => type === 'start' || type === 'goal')
    .map(({ roomId }) => roomId));
  const roomIds = new Set(spec.rooms.map(({ id }) => id));
  const reserved = new Set();
  for (const plan of roomPlans) {
    if (plan.roomId === null) continue;
    if (!roomIds.has(plan.roomId)) throw new RangeError(`Unknown special room: ${plan.roomId}`);
    if (protectedRoomIds.has(plan.roomId) && !plan.targetRole) throw new RangeError(`Special room cannot replace Start or Goal: ${plan.roomId}`);
    if (reserved.has(plan.roomId)) throw new RangeError(`Multiple room plans target the same room: ${plan.roomId}`);
    reserved.add(plan.roomId);
  }
  const candidates = spec.rooms
    .map(({ id }) => id)
    .filter((id) => !protectedRoomIds.has(id) && !reserved.has(id));
  const missingCount = roomPlans.filter(({ roomId }) => roomId === null).length;
  if (missingCount > candidates.length) {
    throw new RangeError(`Insufficient interior rooms for roomPlans: requested ${roomPlans.length}, available ${candidates.length + reserved.size}`);
  }
  const prng = createPrng((spec.seed ^ 0x55ee55ee) >>> 0);
  return roomPlans.map((plan, index) => ({
    ...plan,
    id: plan.id === undefined ? `room-plan-${index + 1}` : plan.id,
    autoAssigned: plan.roomId === null && !plan.targetRole,
    roomId: plan.roomId ?? candidates.splice(pickIndex(prng, candidates.length), 1)[0],
  }));
}

function referencesRemovedEntity(event, removedIds) {
  return [event.trigger, ...(event.conditions ?? []), ...event.actions].some((entry) =>
    removedIds.has(entry.entityId) || (entry.enemyIds ?? []).some((id) => removedIds.has(id)));
}

// V2で新規生成したspec専用。編集済みDungeonSpecへ適用する編集APIではない。
export function decorateGeneratedSpecV3(spec, {
  roomPlans = [],
  equipmentRules,
  trapWarning,
  difficulty,
  difficultyProfile,
  specialRoomEntityLimit = DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT,
  diagnostics,
  initialPlayerState,
} = {}) {
  validateRoomPlans(roomPlans, specialRoomEntityLimit);
  if (equipmentRules !== undefined) assertValidation(validateEquipmentRules(equipmentRules), 'Invalid equipment rules');
  if (difficulty !== undefined && !DUNGEON_DIFFICULTIES.includes(difficulty)) {
    throw new RangeError('difficulty must be easy, normal, or hard');
  }
  if (difficultyProfile !== undefined) {
    const fields = ['enemyDamage', 'trapDamage', 'recoveryHealing'];
    if (!difficultyProfile || typeof difficultyProfile !== 'object' || Array.isArray(difficultyProfile)
      || Object.keys(difficultyProfile).some((field) => !fields.includes(field))) {
      throw new TypeError('difficultyProfile must contain only enemyDamage, trapDamage, and recoveryHealing');
    }
    for (const field of fields) {
      if (!Number.isSafeInteger(difficultyProfile?.[field]) || difficultyProfile[field] < 1) {
        throw new TypeError(`difficultyProfile.${field} must be an explicit positive safe integer`);
      }
    }
  }
  const selected = guardFirstShopPlacementV3(spec, selectRooms(spec, roomPlans), { difficultyProfile, initialPlayerState, equipmentRules });
  const selectedPlans = selected.plans;
  if (diagnostics && selected.diagnostics) diagnostics.shopPlacementGuard = selected.diagnostics;
  const selectedRoomIds = new Set(selectedPlans.map(({ roomId }) => roomId));
  const removedIds = new Set(spec.entities
    .filter(({ type, roomId }) => selectedRoomIds.has(roomId) && type !== 'start' && type !== 'goal')
    .map(({ id }) => id));

  spec.entities = spec.entities.filter(({ id }) => !removedIds.has(id));
  spec.events = spec.events.filter((event) => !referencesRemovedEntity(event, removedIds));
  for (const plan of selectedPlans) {
    spec.rooms.find(({ id }) => id === plan.roomId).kind = plan.kind;
    const prefix = `v3:${plan.id}`;
    if (plan.kind === 'shop') {
      spec.entities.push({
        id: `${prefix}:shop`,
        type: 'shop',
        roomId: plan.roomId,
        offers: plan.offers.map((offer) => ({ ...offer })),
      });
      continue;
    }
    const type = plan.kind === 'monster-house' ? 'enemy' : 'trap';
    const entityIds = [];
    for (let index = 0; index < plan.entityCount; index += 1) {
      const id = `${prefix}:${type}-${index + 1}`;
      entityIds.push(id);
      spec.entities.push({
        id,
        type,
        roomId: plan.roomId,
        ...(type === 'enemy' ? { initiallyActive: false } : {}),
        ...(type === 'trap' && trapWarning !== undefined ? { warning: trapWarning } : {}),
      });
    }
    if (type === 'enemy') {
      spec.events.push({
        id: `${prefix}:enter`,
        trigger: { type: 'on_enter_room', roomId: plan.roomId },
        conditions: [{ type: 'one_shot' }],
        actions: [{ type: 'spawn_enemy_group', enemyIds: entityIds }],
      });
    }
  }
  if (equipmentRules !== undefined) spec.equipmentRules = { ...equipmentRules };
  if (difficulty !== undefined) spec.difficulty = difficulty;
  if (difficultyProfile !== undefined) {
    for (const entity of spec.entities) {
      if (entity.type === 'enemy') entity.damage = difficultyProfile.enemyDamage;
      if (entity.type === 'trap') entity.damage = difficultyProfile.trapDamage;
      if (entity.type === 'recovery') entity.healing = difficultyProfile.recoveryHealing;
    }
  }
  assertValidation(validateDungeonSpec(spec), 'Generated V3 DungeonSpec failed validation');
  return spec;
}
