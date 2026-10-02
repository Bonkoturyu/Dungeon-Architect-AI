import { MAX_SPECIAL_ROOM_ENTITY_LIMIT } from './room-limits.js';
// DesignIntent v1から分離した部屋指定。未指定の数値はnullのまま確認画面へ渡す。
export const SPECIAL_ROOM_KINDS = Object.freeze(['monster-house', 'trap-house', 'shop']);
const nullableInteger = { type: ['integer', 'null'], minimum: 1 };
const offerSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['healing', 'weapon', 'armor'] },
    price: { type: ['integer', 'null'], minimum: 0 }, stock: nullableInteger,
    healing: nullableInteger, tier: nullableInteger,
  }, required: ['type', 'price', 'stock', 'healing', 'tier'],
};
export const ROOM_REQUESTS_JSON_SCHEMA = {
  type: 'array', maxItems: 200, items: {
    type: 'object', additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: [...SPECIAL_ROOM_KINDS, 'normal'] },
      presence: { type: 'string', enum: ['include', 'exclude', 'random'] },
      roomCount: { ...nullableInteger, maximum: 200 }, entityCount: { ...nullableInteger, maximum: MAX_SPECIAL_ROOM_ENTITY_LIMIT },
      targetRole: { type: ['string', 'null'], enum: ['start', 'goal', null] },
      floorNumber: { ...nullableInteger, maximum: 10 }, roomId: { type: ['string', 'null'] },
      offers: { type: 'array', items: offerSchema },
    }, required: ['kind', 'presence', 'roomCount', 'entityCount', 'floorNumber', 'roomId', 'targetRole', 'offers'],
  },
};
const validInteger = (value, min = 1) => value === null || (Number.isSafeInteger(value) && value >= min);
export function validateRoomRequests(requests) {
  const errors = [];
  if (Array.isArray(requests) && requests.length > 200) return { valid: false, errors: ['ROOM_REQUEST_CAPACITY_EXCEEDED'] };
  if (!Array.isArray(requests)) return { valid: false, errors: ['ROOM_REQUESTS_ARRAY_REQUIRED'] };
  const explicitFloorCounts = new Map();
  for (const request of requests) {
    if (!request || ![...SPECIAL_ROOM_KINDS, 'normal'].includes(request.kind) ||
      Object.keys(request).some((key) => !['kind', 'presence', 'roomCount', 'entityCount', 'floorNumber', 'roomId', 'targetRole', 'offers'].includes(key)) ||
      (request.presence !== undefined && !['include', 'exclude', 'random'].includes(request.presence)) ||
      !['roomCount', 'entityCount', 'floorNumber'].every((key) => validInteger(request[key])) ||
      (request.targetRole !== undefined && request.targetRole !== null && !['start', 'goal'].includes(request.targetRole)) ||
      !(request.roomId === null || (typeof request.roomId === 'string' && request.roomId.trim())) || !Array.isArray(request.offers)) {
      errors.push('ROOM_REQUEST_INVALID'); continue;
    }
    if ((request.roomCount ?? 1) > 200 || (request.floorNumber ?? 1) > 10 || (request.entityCount ?? 0) > MAX_SPECIAL_ROOM_ENTITY_LIMIT) errors.push('ROOM_REQUEST_CAPACITY_EXCEEDED');
    if (request.floorNumber !== null && request.kind !== 'shop' && request.entityCount !== null) {
      const total = (explicitFloorCounts.get(request.floorNumber) ?? 0) + request.entityCount * (request.roomCount ?? 1);
      if (!Number.isSafeInteger(total) || total > MAX_SPECIAL_ROOM_ENTITY_LIMIT) errors.push('ROOM_REQUEST_CAPACITY_EXCEEDED');
      explicitFloorCounts.set(request.floorNumber, total);
    }
    for (const offer of request.offers) {
      if (!offer || !['healing', 'weapon', 'armor'].includes(offer.type) ||
        Object.keys(offer).some((key) => !['type', 'price', 'stock', 'healing', 'tier'].includes(key)) ||
        !validInteger(offer.price, 0) || !['stock', 'healing', 'tier'].every((key) => validInteger(offer[key])) ||
        (offer.type === 'healing' ? offer.tier !== null : offer.healing !== null)) errors.push('SHOP_OFFER_REQUEST_INVALID');
    }
    if (request.kind === 'normal' && (!request.targetRole || request.entityCount !== null || request.offers.length)) errors.push('NORMAL_ROOM_ENDPOINT_REQUIRED');
    if (request.targetRole && (request.roomId !== null || (request.roomCount !== null && request.roomCount !== 1))) errors.push('ENDPOINT_LOCATION_CONFLICT');
    if (request.kind !== 'shop' && request.offers.length) errors.push('HOUSE_OFFERS_UNSUPPORTED');
    if (request.kind === 'shop' && request.entityCount !== null) errors.push('SHOP_ENTITY_COUNT_UNSUPPORTED');
  }
  return { valid: errors.length === 0, errors };
}

export function parseFallbackRoomRequests(prompt) {
  // 別の端点名を導く接続詞だけを節境界にする。種類同士のandや数量表現は維持する。
  const text = String(prompt ?? '').normalize('NFKC').replace(/(?:\band\b|\bbut\b|[、,]|そして|それから|にして)(?=\s*(?:(?:make|keep|set)\s+)?(?:the\s+)?(?:スタート|開始地点|ゴール|終了地点|\bstart(?:ing)?\b|\bgoal\b))/gi, '。');
  const keyword = /モンスターハウス|monster\s*houses?|トラップハウス|罠ハウス|trap\s*houses?|ショップ|お店|店(?:舗)?|\bshops?\b|\bstores?\b/gi;
  const matches = [...text.matchAll(keyword)];
  const boundaries = [0];
  for (let index = 1; index < matches.length; index += 1) {
    const previousEnd = matches[index - 1].index + matches[index - 1][0].length;
    const between = text.slice(previousEnd, matches[index].index);
    const separators = [...between.matchAll(/[。;\n、,]|\b(?:and|but)\b|と/g)];
    const last = separators.at(-1);
    boundaries.push(last ? previousEnd + last.index + last[0].length : matches[index].index);
  }
  boundaries.push(text.length);
  const requests = [];
  for (const [index, match] of matches.entries()) {
    const kind = /モンスター|monster/i.test(match[0]) ? 'monster-house' : /トラップ|罠|trap/i.test(match[0]) ? 'trap-house' : 'shop';
    // 別文の通常端点指定などを、この種類のtargetRoleへ混ぜない。小数点は文区切りではない。
    const prefix = text.slice(boundaries[index], match.index);
    const lastSentence = [...prefix.matchAll(/[。;\n]|\.(?!\d)/g)].at(-1);
    const clauseStart = lastSentence ? boundaries[index] + lastSentence.index + lastSentence[0].length : boundaries[index];
    const suffix = text.slice(match.index + match[0].length, boundaries[index + 1]);
    const nextSentence = suffix.match(/[。;\n]|\.(?!\d)/);
    const clauseEnd = nextSentence ? match.index + match[0].length + nextSentence.index : boundaries[index + 1];
    const clause = text.slice(clauseStart, clauseEnd);
    const localAfter = text.slice(match.index + match[0].length, clauseEnd);
    const before = text.slice(clauseStart, match.index);
    const excluded = /^(?:は|を|が)?\s*(?:なし|無し|不要|いらない|置かない|入れない|作らない|設置しない|配置しない|禁止|なく(?:して|す))/.test(localAfter) ||
      /(?:no|without|exclude|excluding|don't(?:\s+(?:include|add|place))?|do not(?:\s+(?:include|add|place))?)\s*$/i.test(before) ||
      /^\s*(?:(?:are|is)\s*)?(?:not\s+(?:allowed|wanted|included)|excluded)/i.test(localAfter);
    const presence = excluded ? 'exclude' : /ランダム|\b(?:random|randomly|optional)\b/i.test(clause) ? 'random' : 'include';
    if (/(?:-\d+(?:\.\d+)?|\d+\.\d+)\s*(?:enemies|monsters|traps|rooms?|体|匹|個|室|部屋|G|HP|階)/i.test(clause) || /floor\s*(?:-\d+|\d+\.\d+)/i.test(clause)) throw new RangeError('ROOM_REQUEST_INTEGER_REQUIRED');
    if (/(?:stock|在庫|\bT)\s*(?:-\d+|\d+\.\d+)/i.test(clause)) throw new RangeError('ROOM_REQUEST_INTEGER_REQUIRED');
    const count = localAfter.match(/^\s*(?:を|は|が)?\s*(\d+)\s*(?:部屋|室|rooms?)/i);
    const beforeCount = /floor\s*\d+\s*$/i.test(before) ? null : before.match(/(?<![\d.\-])(\d+)\s*$/);
    const entityMatch = localAfter.match(/^\s*(?:に|は|を|with)?\s*(?:敵|罠)?\s*(\d+)\s*(?:体|匹|個|enemies|monsters|traps)/i) ?? (kind === 'monster-house'
      ? clause.match(/(?:敵|モンスター)\s*(\d+)\s*(?:体|匹)?|(?<![\d.\-])(\d+)\s*(?:enemies|monsters)/i)
      : kind === 'trap-house' ? clause.match(/(?:罠|トラップ)\s*(\d+)\s*(?:個)?|(?<![\d.\-])(\d+)\s*traps/i) : null);
    const floor = clause.match(/(\d+)\s*(?:階|F)|floor\s*(\d+)/i);
    const room = clause.match(/\broom-\d+\b/i);
    const roles = [...new Set([...clause.matchAll(/スタート|開始地点|ゴール|終了地点|\bstart(?:ing)?(?: room)?\b|\bgoal(?: room)?\b/gi)].map((entry) => /スタート|開始|start/i.test(entry[0]) ? 'start' : 'goal'))];
    if (roles.length > 1) throw new RangeError('ENDPOINT_KIND_CONFLICT: specify Start and Goal separately');
    const offers = [];
    if (kind === 'shop') {
      const offerPattern = /(回復|healing|heal|武器|weapon|防具|armor)\s*(?:T\s*(\d+))?\s*(?:(\d+)\s*HP)?\s*(?:を|は|=|:|for)?\s*(\d+)\s*G/gi;
      const products = [...clause.matchAll(offerPattern)];
      for (const [offerIndex, product] of products.entries()) {
        const type = /回復|heal/i.test(product[1]) ? 'healing' : /武器|weapon/i.test(product[1]) ? 'weapon' : 'armor';
        const suffix = clause.slice(product.index + product[0].length, products[offerIndex + 1]?.index ?? clause.length);
        const stock = suffix.match(/(?:stock|在庫)\s*(\d+)/i);
        offers.push({ type, price: Number(product[4]), stock: stock ? Number(stock[1]) : null,
          healing: type === 'healing' && product[3] ? Number(product[3]) : null,
          tier: type !== 'healing' && product[2] ? Number(product[2]) : null });
      }
    }
    requests.push({ kind, presence, roomCount: count ? Number(count[1]) : beforeCount ? Number(beforeCount[1]) : null,
      entityCount: entityMatch ? Number(entityMatch[1] ?? entityMatch[2]) : null,
      floorNumber: floor ? Number(floor[1] ?? floor[2]) : null, roomId: room?.[0] ?? null, ...(roles.length ? { targetRole: roles[0] } : {}), offers });
  }
  // 通常部屋/ランダムの端点指定も、特殊種類のキーワードなしで保持する。
  for (const clause of text.split(/[。;\n]|\.(?!\d)/)) {
    const roleMatch = clause.match(/スタート|開始地点|ゴール|終了地点|\bstart(?:ing)?(?: room)?\b|\bgoal(?: room)?\b/i);
    if (!roleMatch || /モンスターハウス|monster\s*house|トラップハウス|罠ハウス|trap\s*house|ショップ|お店|店|\bshop|\bstore/i.test(clause)) continue;
    const normal = /通常(?:の)?部屋|普通(?:の)?部屋|normal\s*room/i.test(clause);
    const random = /ランダム|\brandom/i.test(clause);
    if (!normal && !random) continue;
    if (/(?:-\d+(?:\.\d+)?|\d+\.\d+)\s*(?:階|F)|floor\s*(?:-\d+|\d+\.\d+)/i.test(clause)) throw new RangeError('ROOM_REQUEST_INTEGER_REQUIRED');
    const role = /スタート|開始|start/i.test(roleMatch[0]) ? 'start' : 'goal';
    const floor = clause.match(/(\d+)\s*(?:階|F)|floor\s*(\d+)/i);
    requests.push({ kind: 'normal', presence: random ? 'random' : 'include', roomCount: 1, entityCount: null, floorNumber: floor ? Number(floor[1] ?? floor[2]) : null, roomId: null, targetRole: role, offers: [] });
  }
  const validation = validateRoomRequests(requests);
  if (!validation.valid) throw new RangeError(validation.errors.join(','));
  return requests;
}

export function resolveRoomRequests(requests, defaults, { floorCount, seed = 0 } = {}) {
  const validation = validateRoomRequests(requests);
  if (!validation.valid) throw new TypeError(validation.errors.join(','));
  if (!Number.isSafeInteger(floorCount) || floorCount < 1) throw new TypeError('Invalid floor count');
  const plans = [];
  for (const request of requests) {
    // 通常/ランダムの端点指定は上位resolverが扱い、特殊部屋planにはしない。
    if (request.kind === 'normal') continue;
    const roomCount = request.roomCount ?? defaults.roomCount;
    // 既存generatorが作れる全Room数を超える指定は展開せず拒否する。
    if (!Number.isSafeInteger(roomCount) || roomCount < 1 || roomCount > floorCount * 20) throw new RangeError('ROOM_REQUEST_CAPACITY_EXCEEDED');
    if (plans.length + roomCount > floorCount * 20) throw new RangeError('ROOM_REQUEST_CAPACITY_EXCEEDED');
    for (let index = 0; index < roomCount; index += 1) {
      const floorNumber = request.floorNumber ?? (1 + ((seed + plans.length) >>> 0) % floorCount);
      if (floorNumber > floorCount) throw new RangeError('ROOM_REQUEST_FLOOR_MISSING');
      const offers = request.kind === 'shop' ? (request.offers.length ? request.offers : defaults.offers).map((offer, offerIndex) => {
        const base = defaults.offers.find((entry) => entry.type === offer.type && (offer.tier == null || entry.tier === offer.tier)) ?? { stock: defaults.offers.find((entry) => entry.type === offer.type)?.stock };
        if ((offer.price ?? base.price) === undefined || (offer.stock ?? base.stock) === undefined ||
          (offer.type === 'healing' ? (offer.healing ?? base.healing) : (offer.tier ?? base.tier)) === undefined) throw new RangeError('SHOP_OFFER_DEFAULT_MISSING');
        return { id: `offer-${offerIndex + 1}`, type: offer.type,
          price: offer.price ?? base.price, stock: offer.stock ?? base.stock,
          ...(offer.type === 'healing' ? { healing: offer.healing ?? base.healing } : { tier: offer.tier ?? base.tier }),
        };
      }) : [];
      plans.push({ id: `special-${plans.length + 1}`, kind: request.kind, floorNumber, roomId: request.roomId, ...(request.targetRole ? { targetRole: request.targetRole } : {}),
        entityCount: request.kind === 'shop' ? null : request.entityCount ?? defaults[request.kind], offers });
    }
  }
  return plans;
}

export function inferRequestedDifficulty(prompt) {
  const text = String(prompt).normalize('NFKC')
    .replace(/\b(?:not|no|without)\s+(?:too\s+)?(?:easy|hard|normal|moderate|challenging|difficult|beginner)\b/gi, '')
    .replace(/(?:初心者向け|やさしい|簡単|難しい|高難度|歯応えがある|歯ごたえがある)(?:の)?(?:ではなく|じゃなく|ではない|じゃない|でない)/g, '');
  const values = [];
  if (/初心者|やさしい|簡単|\b(?:easy|beginner)\b/i.test(text)) values.push('easy');
  if (/難しい|高難度|歯応え|歯ごたえ|\b(?:hard|challenging|difficult)\b/i.test(text)) values.push('hard');
  if (/標準|普通|\b(?:normal|moderate)\b/i.test(text)) values.push('normal');
  return values.length === 1 ? values[0] : null;
}
