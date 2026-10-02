const TYPES = { enemy: 'monster-house', trap: 'trap-house' };
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const isOrdinary = (room) => !room.kind || room.kind === 'normal';
function referenced(spec, id) {
  return spec.events.some((event) => [event.trigger, ...(event.conditions ?? []), ...event.actions].some((entry) => entry.entityId === id || entry.enemyIds?.includes(id)));
}

// special-rooms-2。ハウスの明示内容を変えず、自動生成された通常内容だけを分散・抑制する。
export function applyNormalRoomDistinction(spec, config) {
  const limits = {};
  const protectedIds = new Set(spec.entities.filter(({ type }) => type === 'start' || type === 'goal').map(({ roomId }) => roomId));
  const protectedShopPath = new Set(config.shopPlacementGuard?.route?.pathRoomIds ?? []);
  const changes = [];
  for (const [type, houseKind] of Object.entries(TYPES)) {
    const configured = config.roomPlans.filter(({ kind }) => kind === houseKind).map(({ entityCount }) => entityCount);
    const threshold = configured.length ? Math.min(...configured) : config.presenceSpec?.defaults?.[houseKind];
    if (!Number.isSafeInteger(threshold) || threshold < 1) throw new RangeError('ROOM_CONTENT_HOUSE_DEFAULT_REQUIRED');
    limits[type] = threshold - 1;
    const counts = new Map(spec.rooms.map(({ id }) => [id, spec.entities.filter((entity) => entity.roomId === id && entity.type === type).length]));
    const rooms = spec.rooms.filter(({ kind }) => kind !== houseKind).toSorted(compareId);
    for (const room of rooms) {
      const extras = spec.entities.filter((entity) => entity.roomId === room.id && entity.type === type).toSorted(compareId).slice(limits[type]);
      for (const entity of extras) {
        if (entity.id.startsWith('v3:') || referenced(spec, entity.id)) throw new RangeError('NORMAL_ROOM_EXPLICIT_CONTENT_CONFLICT');
        const target = rooms.filter((candidate) => candidate.id !== room.id && isOrdinary(candidate) && !protectedIds.has(candidate.id)
          && (type !== 'enemy' || !protectedShopPath.has(candidate.id)) && counts.get(candidate.id) < limits[type])
          .toSorted((a, b) => counts.get(a.id) - counts.get(b.id) || compareId(a, b))[0];
        counts.set(room.id, counts.get(room.id) - 1);
        if (target) {
          entity.roomId = target.id; counts.set(target.id, counts.get(target.id) + 1);
          changes.push({ entityId: entity.id, type, operation: 'redistributed', fromRoomId: room.id, toRoomId: target.id });
        } else {
          spec.entities = spec.entities.filter(({ id }) => id !== entity.id);
          changes.push({ entityId: entity.id, type, operation: 'removed-automatic-overflow', fromRoomId: room.id });
        }
      }
    }
  }
  return { limits, changes, policy: 'nonmatching-house-count-less-than-minimum-configured-house-or-difficulty-default' };
}

export function respectsNormalRoomDistinction(spec, limits) {
  return Object.entries(TYPES).every(([type, houseKind]) => spec.rooms.filter(({ kind }) => kind !== houseKind)
    .every(({ id }) => spec.entities.filter((entity) => entity.roomId === id && entity.type === type).length <= limits[type]));
}
