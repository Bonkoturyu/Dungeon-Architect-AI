function safeAdd(left, right) {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) throw new RangeError('Shop gold budget exceeds the safe integer range');
  return sum;
}

function roomPaths(spec, startRoomId) {
  const adjacency = new Map(spec.rooms.map(({ id }) => [id, []]));
  const goalRoomId = spec.entities.find(({ type }) => type === 'goal').roomId;
  for (const { fromRoomId, toRoomId } of spec.corridors) {
    // Goal通過でPlaySessionが終了するため、shop到達前の経路には含めない。
    if (fromRoomId === goalRoomId || toRoomId === goalRoomId) continue;
    adjacency.get(fromRoomId).push(toRoomId);
    adjacency.get(toRoomId).push(fromRoomId);
  }
  const paths = new Map([[startRoomId, [startRoomId]]]);
  const queue = [startRoomId];
  for (let index = 0; index < queue.length; index += 1) {
    const roomId = queue[index];
    for (const next of adjacency.get(roomId)) {
      if (paths.has(next)) continue;
      paths.set(next, [...paths.get(roomId), next]);
      queue.push(next);
    }
  }
  return paths;
}

// 新規生成V3専用。所持Gを直接増やさず、各shop直前の通常部屋に回収可能な宝箱を用意する。
// 他のshopや任意経路の報酬を流用しない。経路・購入・回収自体はプレイヤーの選択。
export function provisionGeneratedShopGoldV3(spec) {
  const shops = spec.entities.filter(({ type }) => type === 'shop');
  if (shops.length === 0) return null;
  const start = spec.entities.find(({ type }) => type === 'start');
  const paths = roomPaths(spec, start.roomId);
  const normalRoomIds = new Set(spec.rooms.filter(({ kind }) => kind === undefined || kind === 'normal').map(({ id }) => id));
  for (const shop of shops) {
    if (!paths.has(shop.roomId)) throw new RangeError(`Shop is unreachable before Goal: ${shop.id}`);
  }
  shops.sort((left, right) => paths.get(left.roomId).length - paths.get(right.roomId).length
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  let requiredG = 0;
  let availableAtStartG = 0;
  const plannedTreasures = [];
  const budgets = [];
  for (const [index, shop] of shops.entries()) {
    const maxPrice = shop.offers.reduce((max, { price }) => Math.max(max, price), 0);
    requiredG = safeAdd(requiredG, maxPrice);
    const pathRoomIds = paths.get(shop.roomId);
    const sourceRoomId = pathRoomIds.slice(0, -1).findLast((roomId) => normalRoomIds.has(roomId));
    if (!sourceRoomId) throw new RangeError(`Shop has no normal pre-shop budget room: ${shop.id}`);
    if (maxPrice > 0) {
      plannedTreasures.push({
        id: `v3:shop-budget:treasure-${index + 1}`,
        type: 'treasure',
        roomId: sourceRoomId,
        goldReward: maxPrice,
        rewardItem: false,
      });
      if (sourceRoomId === start.roomId) availableAtStartG = safeAdd(availableAtStartG, maxPrice);
    }
    budgets.push({
      shopId: shop.id,
      roomId: shop.roomId,
      distanceFromStart: pathRoomIds.length - 1,
      maxPrice,
      requiredG: maxPrice,
      collectibleG: maxPrice,
      sourceRoomId,
      pathRoomIds,
      isStartFallback: sourceRoomId === start.roomId,
    });
  }
  // 全金額の安全性が確認できるまでspecを変更しない。価格に比例した大量Entityは生成しない。
  const ids = new Set([...spec.rooms, ...spec.corridors, ...spec.entities, ...spec.events].map(({ id }) => id));
  for (const { id } of plannedTreasures) {
    if (ids.has(id)) throw new RangeError(`Shop budget entity ID already exists: ${id}`);
  }
  spec.entities.push(...plannedTreasures);
  return {
    addedTreasureCount: plannedTreasures.length,
    goldSource: 'pre-shop-path-treasures',
    availableAtStartG,
    collectibleG: requiredG,
    requiredG,
    budgets,
  };
}
