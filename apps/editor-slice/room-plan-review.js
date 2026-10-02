import { requestedEndpointPolicies, resolveRoomConfigurationPresence } from '../../packages/intent/src/endpoint-room-plans.js';
import { getMessage } from './i18n.js';
import { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, MAX_SPECIAL_ROOM_ENTITY_LIMIT } from '../../packages/intent/src/room-limits.js';
import { SPECIAL_ROOM_KINDS } from '../../packages/intent/src/room-requests.js';
import { requestedPresencePolicies } from '../../packages/intent/src/special-room-presence.js';

export const EQUIPMENT_RULES_V1 = Object.freeze({ weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 });
export const NORMAL_ROOM_DEFAULTS = Object.freeze({ roomCount: 1, 'monster-house': 3, 'trap-house': 4,
  offers: [
    { type: 'healing', price: 10, stock: 1, healing: 8 },
    ...['weapon', 'armor'].flatMap((type) => [1, 2, 3].map((tier) => ({ type, tier, price: tier * 10, stock: 1 }))),
  ],
});
export { inferRequestedDifficulty } from '../../packages/intent/src/room-requests.js';

// ユーザー承認済みの初期値。自然文の明示値は上書きしない。
export const DIFFICULTY_PROFILES = {
  easy: { enemyDamage: 3, trapDamage: 4, recoveryHealing: 10, monsterCount: 2, trapCount: 3 },
  hard: { enemyDamage: 5, trapDamage: 7, recoveryHealing: 8, monsterCount: 4, trapCount: 5 },
  normal: { enemyDamage: 4, trapDamage: 6, recoveryHealing: 8, monsterCount: 3, trapCount: 4 },
};

// Autoと手動確認で共通の、Seed付き既定値解決。作者状態を変更しない。
export function createRoomPlanConfig({ requests, floorCount, seed, difficulty = 'normal', roomsPerFloor = 8,
  policies = requestedPresencePolicies(requests), endpointPolicies = requestedEndpointPolicies(requests), overrides = {}, specialRoomEntityLimit = DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT }) {
  const selectedDifficulty = difficulty in DIFFICULTY_PROFILES ? difficulty : 'normal';
  const profile = DIFFICULTY_PROFILES[selectedDifficulty];
  const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': profile.monsterCount, 'trap-house': profile.trapCount,
    offers: NORMAL_ROOM_DEFAULTS.offers.map((offer) => offer.type === 'healing' ? { ...offer, healing: profile.recoveryHealing } : { ...offer }) };
  const presenceSpec = { requests: structuredClone(requests), policies: { ...policies }, endpointPolicies: structuredClone(endpointPolicies), defaults: structuredClone(defaults), roomsPerFloor, overrides: { ...overrides } };
  const resolved = resolveRoomConfigurationPresence({ ...presenceSpec, floorCount, seed, specialRoomEntityLimit });
  return { roomPlans: resolved.roomPlans, presenceSpec, specialRoomEntityLimit, difficulty: selectedDifficulty,
    difficultyProfile: Object.fromEntries(['enemyDamage', 'trapDamage', 'recoveryHealing'].map((key) => [key, profile[key]])),
    equipmentRules: { ...EQUIPMENT_RULES_V1 } };
}

export function reviewRoomPlan({ requests, floorCount, seed, difficulty = 'normal', roomsPerFloor = 8, warnings = [], language = 'en', strategyLabel = '' }) {
  const text = (key, variables = {}) => getMessage(language, `roomReview.${key}`, variables);
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog'); dialog.className = 'special-room-review';
    dialog.style.cssText = 'color:#e7edf5;background:#111827;border:1px solid #526278;border-radius:12px;padding:0;width:min(760px,90vw);max-height:85vh;overflow:hidden;';
    dialog.setAttribute('aria-labelledby', 'roomReviewHeading');
    const form = document.createElement('form'); form.method = 'dialog'; form.style.cssText = 'display:flex;flex-direction:column;max-height:85vh;margin:0;';
    const header = document.createElement('header'); header.className = 'special-room-review-header'; header.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;background:#111827;border-bottom:1px solid #374151;flex-shrink:0;';
    const body = document.createElement('div'); body.className = 'special-room-review-body'; body.style.cssText = 'padding:0 24px 24px;overflow:auto;min-height:0;';
    const heading = document.createElement('h2'); heading.id = 'roomReviewHeading'; heading.style.cssText = 'font-size:20px;margin:0;'; heading.textContent = text('heading');
    const intro = document.createElement('p'); intro.textContent = text('intro', { strategy: strategyLabel || text('selectedStrategy') });
    header.append(heading); body.append(intro); form.append(header, body);
    const kindLabel = (kind) => ({'monster-house':text('monsterHouse'),'trap-house':text('trapHouse'),shop:text('shop')})[kind];
    const initialPolicies = requestedPresencePolicies(requests);
    const policyInputs = {};
    const endpointInputs = {};
    const endpointFloorInputs = { start: {}, goal: {} };
    const initialEndpoints = requestedEndpointPolicies(requests);
    const presenceSummary = document.createElement('p');
    const presenceWarning = document.createElement('p');
    for (const kind of SPECIAL_ROOM_KINDS) {
      const label = document.createElement('label'); label.style.cssText = 'display:block;margin:8px 0;'; label.textContent = `${kindLabel(kind)} `;
      const select = document.createElement('select'); select.name = `presence-${kind}`;
      for (const [value, caption] of [['random',text('random')],['include',text('include')],['exclude',text('exclude')]]) { const option = document.createElement('option'); option.value = value; option.textContent = caption; select.append(option); }
      select.value = initialPolicies[kind]; policyInputs[kind] = select; label.append(select); body.append(label);
    }
    const endpointSelect = (role, value, floor = null) => {
      const label = document.createElement('label'); label.style.cssText = 'display:block;margin:8px 0;';
      label.textContent = `${text(role)}${floor === null ? '' : ` · ${text('floor')} ${floor}`} `;
      const select = document.createElement('select'); select.name = `endpoint-${role}${floor === null ? '' : `-floor-${floor}`}`;
      for (const key of ['normal', 'random', ...SPECIAL_ROOM_KINDS]) {
        const option = document.createElement('option'); option.value = key;
        option.textContent = key === 'normal' ? text('normalRoom') : key === 'random' ? text('endpointRandom') : kindLabel(key); select.append(option);
      }
      select.value = value; label.append(select); body.append(label); return select;
    };
    for (const role of ['start', 'goal']) {
      const initial = initialEndpoints[role];
      endpointInputs[role] = endpointSelect(role, typeof initial === 'string' ? initial : initial.default);
      if (typeof initial !== 'string') {
        endpointInputs[role].parentElement.firstChild.textContent = `${text(role)} · ${text('otherFloors')} `;
        for (const [floor, value] of Object.entries(initial.floors)) endpointFloorInputs[role][floor] = endpointSelect(role, value, floor);
      }
    }
    const endpointNote = document.createElement('p'); endpointNote.textContent = text('endpointNote'); body.append(endpointNote);
    body.append(presenceSummary, presenceWarning);
    const currentEndpoints = () => Object.fromEntries(['start', 'goal'].map((role) => [role, Object.keys(endpointFloorInputs[role]).length
      ? { default: endpointInputs[role].value, floors: Object.fromEntries(Object.entries(endpointFloorInputs[role]).map(([floor, input]) => [floor, input.value])) }
      : endpointInputs[role].value]));
    const currentPolicies = () => Object.fromEntries(SPECIAL_ROOM_KINDS.map((kind) => [kind, policyInputs[kind].value]));
    for (const warning of warnings) { const p = document.createElement('p'); p.textContent = warning; body.append(p); }
    const difficultyLabel = document.createElement('label'); difficultyLabel.textContent = text('difficulty');
    const difficultyInput = document.createElement('select'); difficultyInput.name = 'difficulty';
    for (const key of ['easy', 'normal', 'hard']) { const option = document.createElement('option'); option.value = key; option.textContent = ({easy:text('easy'),normal:text('normal'),hard:text('hard')})[key]; difficultyInput.append(option); }
    difficultyInput.value = difficulty in DIFFICULTY_PROFILES ? difficulty : 'normal'; difficultyLabel.append(difficultyInput); body.append(difficultyLabel);
    const advanced = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = text('advanced'); advanced.append(summary);
    const limitLabel = document.createElement('label'); limitLabel.textContent = text('limit');
    const limitInput = document.createElement('input'); limitInput.id = 'specialRoomEntityLimit'; limitInput.type = 'number'; limitInput.min = '1'; limitInput.max = String(MAX_SPECIAL_ROOM_ENTITY_LIMIT); limitInput.step = '1'; limitInput.required = true; limitInput.value = String(DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT); limitInput.style.width = '100px'; limitLabel.append(limitInput); advanced.append(limitLabel);
    const limitNote = document.createElement('p'); limitNote.textContent = text('limitNote', { defaultLimit: DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, maxLimit: MAX_SPECIAL_ROOM_ENTITY_LIMIT }); advanced.append(limitNote); body.append(advanced);
    const profileLine = document.createElement('p'); const roomsContainer = document.createElement('div'); body.append(profileLine, roomsContainer);
    let plans = [];
    let currentDefaults = null;
    const dirtyValues = new Map();
    const editPlan = (plan, key, value) => { plan[key] = value; dirtyValues.set(`${plan.id}/${key}`, value); };
    const editOffer = (plan, offer, key, value) => { offer[key] = value; dirtyValues.set(`${plan.id}/${offer.id}/${key}`, value); };
    const field = (parent, caption, value, onChange, { min = 1, nullable = false } = {}) => {
      const label = document.createElement('label'); label.style.cssText = 'display:inline-flex;flex-direction:column;gap:4px;margin:6px;'; label.append(document.createTextNode(caption));
      const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.step = '1'; input.value = value ?? ''; input.required = !nullable; input.style.width = '100px';
      input.addEventListener('input', () => onChange(input.value === '' && nullable ? null : Number(input.value))); label.append(input); parent.append(label); return input;
    };
    const render = () => {
      const profile = DIFFICULTY_PROFILES[difficultyInput.value];
      const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': profile.monsterCount, 'trap-house': profile.trapCount,
        offers: NORMAL_ROOM_DEFAULTS.offers.map((offer) => offer.type === 'healing' ? { ...offer, healing: profile.recoveryHealing } : { ...offer }) };
      currentDefaults = defaults;
      try {
        const resolved = resolveRoomConfigurationPresence({ requests, policies: currentPolicies(), endpointPolicies: currentEndpoints(), defaults, floorCount, roomsPerFloor, seed, overrides: Object.fromEntries(dirtyValues), specialRoomEntityLimit: Number(limitInput.value) });
        plans = resolved.roomPlans;
        presenceSummary.textContent = text('seedResult') + SPECIAL_ROOM_KINDS.map((kind) => `${kindLabel(kind)} ${resolved.presence[kind].placed ? text('included') : text('absent')}`).join(' / ') + text('seedNote');
        presenceSummary.textContent += ' ' + resolved.endpointPresence.map(({ role, floorNumber, kind }) => `${text('floor')} ${floorNumber} ${text(role)}: ${kind === 'normal' ? text('normalRoom') : kindLabel(kind)}`).join(' / ');
        presenceWarning.textContent = resolved.warnings.join(' ');
        error.textContent = '';
      } catch (cause) { error.textContent = cause.message; return; }
      confirm.disabled = false;
      profileLine.textContent = text('profile', { enemy: profile.enemyDamage, trap: profile.trapDamage, healing: profile.recoveryHealing });
      roomsContainer.replaceChildren();
      for (const plan of plans) {
        const group = document.createElement('fieldset'); group.style.margin = '12px 0'; group.dataset.planId = plan.id;
        const title = document.createElement('legend'); title.textContent = kindLabel(plan.kind) + (plan.targetRole ? ` · ${text(plan.targetRole)}` : ''); group.append(title);
        const floorInput = field(group, text('floor'), plan.floorNumber, (value) => editPlan(plan, 'floorNumber', value)); floorInput.max = String(floorCount); floorInput.disabled = !!plan.targetRole;
        const roomLabel = document.createElement('label'); roomLabel.textContent = text('roomId');
        const roomInput = document.createElement('input'); roomInput.value = plan.targetRole ? text(plan.targetRole) : plan.roomId ?? ''; roomInput.disabled = !!plan.targetRole; roomInput.placeholder = 'room-002'; roomInput.style.width = '120px'; roomInput.addEventListener('input', () => { editPlan(plan, 'roomId', roomInput.value.trim() || null); }); roomLabel.append(roomInput); group.append(roomLabel);
        if (plan.kind !== 'shop') field(group, text('entityCount'), plan.entityCount, (value) => editPlan(plan, 'entityCount', value));
        else for (const offer of plan.offers) {
          const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;border-top:1px solid #374151;padding:6px 0;';
          const label = document.createElement('strong'); label.style.minWidth = '90px'; label.textContent = offer.type === 'healing' ? text('healing') : `${offer.type === 'weapon' ? text('weapon') : text('armor')} T${offer.tier}`; row.append(label);
          field(row, text('price'), offer.price, (value) => editOffer(plan, offer, 'price', value), { min: 0 });
          field(row, text('stock'), offer.stock, (value) => editOffer(plan, offer, 'stock', value));
          field(row, offer.type === 'healing' ? text('healingHp') : 'Tier', offer.healing ?? offer.tier, (value) => editOffer(plan, offer, offer.type === 'healing' ? 'healing' : 'tier', value));
          group.append(row);
        }
        roomsContainer.append(group);
      }
    };
    const policy = document.createElement('p'); policy.textContent = text('policy'); body.append(policy);
    const rules = document.createElement('p'); rules.textContent = text('rules'); body.append(rules);
    const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.style.color = '#fda4af'; body.append(error);
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = text('cancel'); cancel.addEventListener('click', () => dialog.close('cancel'));
    const confirm = document.createElement('button'); confirm.type = 'submit'; confirm.textContent = text('generate'); confirm.className = 'primary-action';
    const actions = document.createElement('div'); actions.className = 'special-room-review-actions'; actions.style.cssText = 'display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;'; actions.append(cancel, confirm); header.append(actions);
    difficultyInput.addEventListener('change', render);
    for (const input of [...Object.values(policyInputs), ...Object.values(endpointInputs), ...Object.values(endpointFloorInputs).flatMap((inputs) => Object.values(inputs))]) input.addEventListener('change', render);
    let result = null;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const specialRoomEntityLimit = Number(limitInput.value);
      if (!Number.isSafeInteger(specialRoomEntityLimit) || specialRoomEntityLimit < 1 || specialRoomEntityLimit > MAX_SPECIAL_ROOM_ENTITY_LIMIT) { error.textContent = text('invalidLimit'); return; }
      const perFloor = new Map();
      for (const plan of plans) {
        const total = (perFloor.get(plan.floorNumber) ?? 0) + (plan.entityCount ?? 0);
        if (!Number.isSafeInteger(total) || total > specialRoomEntityLimit) { error.textContent = text('capacityError', { floor: plan.floorNumber, total, limit: specialRoomEntityLimit }); return; }
        perFloor.set(plan.floorNumber, total);
      }
      const numbers = plans.flatMap((plan) => [plan.floorNumber, ...(plan.entityCount === null ? [] : [plan.entityCount]), ...plan.offers.flatMap((offer) => [offer.stock, offer.healing ?? offer.tier])]);
      if (numbers.some((value) => !Number.isSafeInteger(value) || value < 1) || plans.some((plan) => plan.floorNumber > floorCount || plan.offers.some((offer) => !Number.isSafeInteger(offer.price) || offer.price < 0))) { error.textContent = text('invalidNumbers'); return; }
      const presenceSpec = { requests: structuredClone(requests), policies: currentPolicies(), endpointPolicies: currentEndpoints(), defaults: structuredClone(currentDefaults), roomsPerFloor, overrides: Object.fromEntries(dirtyValues) };
      try {
        const resolvedPlans = resolveRoomConfigurationPresence({ ...presenceSpec, seed, floorCount, specialRoomEntityLimit }).roomPlans;
        if (JSON.stringify(resolvedPlans) !== JSON.stringify(plans)) {
          render(); error.textContent = text('changed'); return;
        }
        plans = resolvedPlans;
      } catch (cause) { error.textContent = cause.message; return; }
      result = { roomPlans: plans, presenceSpec, specialRoomEntityLimit, difficulty: difficultyInput.value, difficultyProfile: Object.fromEntries(["enemyDamage", "trapDamage", "recoveryHealing"].map((key) => [key, DIFFICULTY_PROFILES[difficultyInput.value][key]])), equipmentRules: { ...EQUIPMENT_RULES_V1 } }; dialog.close('confirm');
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); }, { once: true });
    dialog.append(form); document.body.append(dialog); render(); dialog.showModal();
  });
}
