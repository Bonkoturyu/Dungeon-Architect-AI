import { applyGameplayStateCommand } from './gameplay-state.js';
import { applyPlayerHealing } from './play-session.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const fail = (code) => ({ ok: false, error: { code, message: code } });
const shopOf = (session, shopId) => session?.snapshot?.entities?.find((entity) => entity.id === shopId && entity.type === 'shop');

export function getShopState(session, shopId) {
  const entity = shopOf(session, shopId);
  if (!entity) return null;
  const entityStates = session.gameplayState?.entityStates ?? {};
  const purchased = (Object.hasOwn(entityStates, shopId) ? entityStates[shopId]?.purchased : null) ?? {};
  return {
    entity: clone(entity),
    offers: entity.offers.map((offer) => ({ ...clone(offer), remaining: Math.max(0, offer.stock - (Object.hasOwn(purchased, offer.id) ? purchased[offer.id] : 0)) })),
  };
}

export function listRoomShops(session, roomId = session?.currentRoomId) {
  return (session?.snapshot?.entities ?? []).filter((entity) => entity.type === 'shop' && entity.roomId === roomId)
    .map((entity) => getShopState(session, entity.id));
}

export function purchaseShopOffer(session, shopId, offerId, { at = session?.startedAt ?? 0 } = {}) {
  if (session?.status !== 'playing') return fail('SESSION_NOT_PLAYING');
  const view = getShopState(session, shopId);
  if (!view) return fail('SHOP_NOT_FOUND');
  if (view.entity.roomId !== session.currentRoomId) return fail('SHOP_NOT_IN_CURRENT_ROOM');
  const offer = view.offers.find((item) => item.id === offerId);
  if (!offer) return fail('SHOP_OFFER_NOT_FOUND');
  if (!Number.isSafeInteger(offer.price) || offer.price < 0 || !Number.isSafeInteger(offer.stock) || offer.stock < 1) return fail('SHOP_OFFER_INVALID');
  if (offer.remaining <= 0) return fail('SHOP_SOLD_OUT');
  const player = session.playerState;
  if (!Number.isSafeInteger(player?.gold) || player.gold < 0) return fail('PLAYER_GOLD_INVALID');
  if (player.gold < offer.price) return fail('SHOP_GOLD_INSUFFICIENT');
  if (offer.type === 'healing') {
    if (!Number.isSafeInteger(offer.healing) || offer.healing < 1) return fail('SHOP_OFFER_INVALID');
    if (player.hp >= player.maxHp) return fail('SHOP_HP_FULL');
  } else if (['weapon', 'armor'].includes(offer.type)) {
    if (!Number.isSafeInteger(offer.tier) || offer.tier < 1) return fail('SHOP_OFFER_INVALID');
    if ((player.equipment?.[offer.type]?.tier ?? 0) >= offer.tier) return fail('SHOP_EQUIPMENT_NOT_UPGRADE');
  } else return fail('SHOP_OFFER_INVALID');

  let next = clone(session);
  next.playerState.gold -= offer.price;
  if (offer.type === 'healing') {
    const healed = applyPlayerHealing(next, offer.healing, { at, sourceType: 'shop', sourceId: shopId });
    if (!healed.ok) return healed;
    next = healed.session;
  } else {
    const itemId = `${offer.type}-tier-${offer.tier}`;
    const count = (next.gameplayState.inventory[itemId] ?? 0) + 1;
    if (!Number.isSafeInteger(count) || count < 1) return fail('SHOP_INVENTORY_INVALID');
    next.playerState.equipment[offer.type] = { id: itemId, slot: offer.type, tier: offer.tier };
    next.gameplayState = applyGameplayStateCommand(next.gameplayState, { type: 'set-inventory-count', itemId, count });
  }
  const previous = Object.hasOwn(next.gameplayState.entityStates, shopId) ? next.gameplayState.entityStates[shopId] : {};
  const purchased = { ...(previous.purchased ?? {}) };
  const purchaseCount = (Object.hasOwn(purchased, offerId) ? purchased[offerId] : 0) + 1;
  if (!Number.isSafeInteger(purchaseCount)) return fail('SHOP_STOCK_INVALID');
  Object.defineProperty(purchased, offerId, { value: purchaseCount, enumerable: true, configurable: true, writable: true });
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: 'set-entity-state', entityId: shopId, state: { ...previous, purchased },
  }, { entityIds: next.snapshot.entities.map((entity) => entity.id) });
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, { type: 'increment-counter', counter: 'interactions', delta: 1 });
  next.events.push({ type: 'shop-purchase', shopId, offerId, price: offer.price, offerType: offer.type, goldAfter: next.playerState.gold, roomId: next.currentRoomId, at });
  return { ok: true, session: next, purchase: { shopId, offerId, price: offer.price } };
}
