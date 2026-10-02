import { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, MAX_SPECIAL_ROOM_ENTITY_LIMIT } from '../../packages/intent/src/room-limits.js';
import { SPECIAL_ROOM_KINDS } from '../../packages/intent/src/room-requests.js';
import { requestedPresencePolicies, resolveSpecialRoomPresence } from '../../packages/intent/src/special-room-presence.js';

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

export function reviewRoomPlan({ requests, floorCount, seed, difficulty = 'normal', roomsPerFloor = 8, warnings = [], language = 'en' }) {
  const ja = language === 'ja';
  const text = (japanese, english) => ja ? japanese : english;
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog'); dialog.className = 'special-room-review';
    dialog.style.cssText = 'color:#e7edf5;background:#111827;border:1px solid #526278;border-radius:12px;padding:24px;max-width:min(760px,90vw);max-height:85vh;overflow:auto;';
    const form = document.createElement('form'); form.method = 'dialog';
    const heading = document.createElement('h2'); heading.textContent = text('部屋仕様を確認して生成', 'Review room specifications');
    const intro = document.createElement('p'); intro.textContent = text('Generator V3で生成します。未指定値は仮設定です。ここで変更できます。', 'Generate with Generator V3. Unspecified values are proposals; edit them before confirming.');
    form.append(heading, intro);
    const kindLabel = (kind) => ({'monster-house':text('モンスターハウス','Monster house'),'trap-house':text('トラップハウス','Trap house'),shop:text('店','Shop')})[kind];
    const initialPolicies = requestedPresencePolicies(requests);
    const policyInputs = {};
    const presenceSummary = document.createElement('p');
    const presenceWarning = document.createElement('p');
    for (const kind of SPECIAL_ROOM_KINDS) {
      const label = document.createElement('label'); label.style.cssText = 'display:block;margin:8px 0;'; label.textContent = `${kindLabel(kind)} `;
      const select = document.createElement('select'); select.name = `presence-${kind}`;
      for (const [value, caption] of [['random',text('ランダム（1/3）','Random (1/3)')],['include',text('必ず置く','Always include')],['exclude',text('置かない','Never include')]]) { const option = document.createElement('option'); option.value = value; option.textContent = caption; select.append(option); }
      select.value = initialPolicies[kind]; policyInputs[kind] = select; label.append(select); form.append(label);
    }
    form.append(presenceSummary, presenceWarning);
    const currentPolicies = () => Object.fromEntries(SPECIAL_ROOM_KINDS.map((kind) => [kind, policyInputs[kind].value]));
    for (const warning of warnings) { const p = document.createElement('p'); p.textContent = warning; form.append(p); }
    const difficultyLabel = document.createElement('label'); difficultyLabel.textContent = text('難易度 ', 'Difficulty ');
    const difficultyInput = document.createElement('select'); difficultyInput.name = 'difficulty';
    for (const key of ['easy', 'normal', 'hard']) { const option = document.createElement('option'); option.value = key; option.textContent = ({easy:text('やさしい','Easy'),normal:text('標準','Normal'),hard:text('難しい','Hard')})[key]; difficultyInput.append(option); }
    difficultyInput.value = difficulty in DIFFICULTY_PROFILES ? difficulty : 'normal'; difficultyLabel.append(difficultyInput); form.append(difficultyLabel);
    const advanced = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = text('高度な設定', 'Advanced settings'); advanced.append(summary);
    const limitLabel = document.createElement('label'); limitLabel.textContent = text('1階あたりの追加敵・罠の合計上限 ', 'Added enemies + traps per floor limit ');
    const limitInput = document.createElement('input'); limitInput.id = 'specialRoomEntityLimit'; limitInput.type = 'number'; limitInput.min = '1'; limitInput.max = String(MAX_SPECIAL_ROOM_ENTITY_LIMIT); limitInput.step = '1'; limitInput.required = true; limitInput.value = String(DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT); limitInput.style.width = '100px'; limitLabel.append(limitInput); advanced.append(limitLabel);
    const limitNote = document.createElement('p'); limitNote.textContent = text(`通常${DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT}、検証環境での高度設定上限${MAX_SPECIAL_ROOM_ENTITY_LIMIT}。大量配置は動作が重くなります。すべてのPCで快適とは限りません。性能上限は攻略可能性の保証ではなく、大量の敵を明示指定するとHP収支で攻略不能になる場合があります。`, `Default ${DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT}; tested advanced bound ${MAX_SPECIAL_ROOM_ENTITY_LIMIT}. Larger rooms reduce responsiveness; this is not a performance guarantee for every computer. A rendering limit does not guarantee a beatable dungeon; explicit high enemy counts can exceed available HP.`); advanced.append(limitNote); form.append(advanced);
    const profileLine = document.createElement('p'); const roomsContainer = document.createElement('div'); form.append(profileLine, roomsContainer);
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
        const resolved = resolveSpecialRoomPresence({ requests, policies: currentPolicies(), defaults, floorCount, roomsPerFloor, seed, overrides: Object.fromEntries(dirtyValues), specialRoomEntityLimit: Number(limitInput.value) });
        plans = resolved.roomPlans;
        presenceSummary.textContent = text('このSeedの結果：', 'This seed: ') + SPECIAL_ROOM_KINDS.map((kind) => `${kindLabel(kind)} ${resolved.presence[kind].placed ? text('あり','included') : text('なし','absent')}`).join(' / ') + text('。同じSeedなら同じ結果。Mysteryでは新Seedで再抽選します。', '. Same seed, same result; Mystery rerolls random choices with its new seed.');
        presenceWarning.textContent = resolved.warnings.join(' ');
        error.textContent = '';
      } catch (cause) { error.textContent = cause.message; return; }
      confirm.disabled = false;
      profileLine.textContent = text(`敵の被害${profile.enemyDamage}HP／罠${profile.trapDamage}HP／回復${profile.recoveryHealing}HP。難易度変更でも手動変更値は保持します。`, `Enemy damage ${profile.enemyDamage} HP / trap ${profile.trapDamage} HP / healing ${profile.recoveryHealing} HP. Manually edited values survive difficulty changes.`);
      roomsContainer.replaceChildren();
      for (const plan of plans) {
        const group = document.createElement('fieldset'); group.style.margin = '12px 0'; group.dataset.planId = plan.id;
        const title = document.createElement('legend'); title.textContent = kindLabel(plan.kind); group.append(title);
        const floorInput = field(group, text('階','Floor'), plan.floorNumber, (value) => editPlan(plan, 'floorNumber', value)); floorInput.max = String(floorCount);
        const roomLabel = document.createElement('label'); roomLabel.textContent = text('部屋ID（空欄＝自動） ', 'Room ID (blank = seeded) ');
        const roomInput = document.createElement('input'); roomInput.value = plan.roomId ?? ''; roomInput.placeholder = 'room-002'; roomInput.style.width = '120px'; roomInput.addEventListener('input', () => { editPlan(plan, 'roomId', roomInput.value.trim() || null); }); roomLabel.append(roomInput); group.append(roomLabel);
        if (plan.kind !== 'shop') field(group, text('敵・罠の数','Entity count'), plan.entityCount, (value) => editPlan(plan, 'entityCount', value));
        else for (const offer of plan.offers) {
          const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;border-top:1px solid #374151;padding:6px 0;';
          const label = document.createElement('strong'); label.style.minWidth = '90px'; label.textContent = offer.type === 'healing' ? text('HP回復','Healing') : `${offer.type === 'weapon' ? text('武器','Weapon') : text('防具','Armor')} T${offer.tier}`; row.append(label);
          field(row, text('価格 G','Price G'), offer.price, (value) => editOffer(plan, offer, 'price', value), { min: 0 });
          field(row, text('在庫','Stock'), offer.stock, (value) => editOffer(plan, offer, 'stock', value));
          field(row, offer.type === 'healing' ? text('回復 HP','Healing HP') : 'Tier', offer.healing ?? offer.tier, (value) => editOffer(plan, offer, offer.type === 'healing' ? 'healing' : 'tier', value));
          group.append(row);
        }
        roomsContainer.append(group);
      }
    };
    const policy = document.createElement('p'); policy.textContent = text('特別部屋の通常内容は指定内容で置き換えます。店は安全。ハウスは全処理まで退出不可。在庫は再入室で戻りません。Gは敵・宝箱から入手。各店の最高価格商品1つ分を目安に、手前の通常部屋（なければStart）へG専用宝箱を補充します。回収せず進んだり他店で使った残金は保証しません。', 'Special rooms replace their ordinary generated contents. Shops are safe; houses block exits until resolved. Stock does not refill on re-entry. G comes from enemies and treasure. A G-only chest before each shop (Start if no later ordinary room exists) funds one highest-price item; skipped chests or other spending are not guaranteed.'); form.append(policy);
    const rules = document.createElement('p'); rules.textContent = text('武器：敵の被害−Tier。防具：敵・罠の被害−Tier。最低1HP。満HPの回復・同等以下の装備は購入不可。', 'Weapon: enemy damage −Tier. Armor: enemy/trap damage −Tier. Minimum 1 HP. No healing purchase at full HP or same/weaker equipment purchase.'); form.append(rules);
    const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.style.color = '#fda4af'; form.append(error);
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = text('キャンセル','Cancel'); cancel.addEventListener('click', () => dialog.close('cancel'));
    const confirm = document.createElement('button'); confirm.type = 'submit'; confirm.textContent = text('この仕様で生成','Generate this plan'); confirm.style.marginLeft = '12px'; form.append(cancel, confirm);
    difficultyInput.addEventListener('change', render);
    for (const input of Object.values(policyInputs)) input.addEventListener('change', render);
    let result = null;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const specialRoomEntityLimit = Number(limitInput.value);
      if (!Number.isSafeInteger(specialRoomEntityLimit) || specialRoomEntityLimit < 1 || specialRoomEntityLimit > MAX_SPECIAL_ROOM_ENTITY_LIMIT) { error.textContent = text('上限値が無効です', 'Invalid entity limit'); return; }
      const perFloor = new Map();
      for (const plan of plans) {
        const total = (perFloor.get(plan.floorNumber) ?? 0) + (plan.entityCount ?? 0);
        if (!Number.isSafeInteger(total) || total > specialRoomEntityLimit) { error.textContent = text(`第${plan.floorNumber}階の敵・罠合計${total}が上限${specialRoomEntityLimit}を超えています。数を減らすか高度な設定を確認してください。`, `Floor ${plan.floorNumber}: ${total} enemies/traps exceeds limit ${specialRoomEntityLimit}. Reduce counts or review Advanced settings.`); return; }
        perFloor.set(plan.floorNumber, total);
      }
      const numbers = plans.flatMap((plan) => [plan.floorNumber, ...(plan.entityCount === null ? [] : [plan.entityCount]), ...plan.offers.flatMap((offer) => [offer.stock, offer.healing ?? offer.tier])]);
      if (numbers.some((value) => !Number.isSafeInteger(value) || value < 1) || plans.some((plan) => plan.floorNumber > floorCount || plan.offers.some((offer) => !Number.isSafeInteger(offer.price) || offer.price < 0))) { error.textContent = text('正しい整数を入力してください','Enter valid whole numbers'); return; }
      const presenceSpec = { requests: structuredClone(requests), policies: currentPolicies(), defaults: structuredClone(currentDefaults), roomsPerFloor, overrides: Object.fromEntries(dirtyValues) };
      try {
        const resolvedPlans = resolveSpecialRoomPresence({ ...presenceSpec, seed, floorCount, specialRoomEntityLimit }).roomPlans;
        if (JSON.stringify(resolvedPlans) !== JSON.stringify(plans)) {
          render(); error.textContent = text('設定変更に合わせて候補を更新しました。内容を確認して、もう一度生成を押してください。', 'Proposals changed with your settings. Review them and confirm again.'); return;
        }
        plans = resolvedPlans;
      } catch (cause) { error.textContent = cause.message; return; }
      result = { roomPlans: plans, presenceSpec, specialRoomEntityLimit, difficulty: difficultyInput.value, difficultyProfile: Object.fromEntries(["enemyDamage", "trapDamage", "recoveryHealing"].map((key) => [key, DIFFICULTY_PROFILES[difficultyInput.value][key]])), equipmentRules: { ...EQUIPMENT_RULES_V1 } }; dialog.close('confirm');
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); }, { once: true });
    dialog.append(form); document.body.append(dialog); render(); dialog.showModal();
  });
}
