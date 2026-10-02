// 装備効果はDungeonSpecに明示されたルールだけを使う。旧Specは従来の損耗を維持する。
export function getEffectiveDamage(session, baseDamage, sourceType) {
  if (!Number.isSafeInteger(baseDamage) || baseDamage < 0) throw new RangeError('Invalid base damage');
  const rules = session?.snapshot?.equipmentRules;
  if (!rules || baseDamage === 0 || !['enemy', 'trap'].includes(sourceType)) return baseDamage;
  const fields = ['weaponEnemyReductionPerTier', 'armorDamageReductionPerTier', 'minimumPositiveDamage'];
  if (fields.some((key) => !Number.isSafeInteger(rules[key]) || rules[key] < 0)) throw new RangeError('Invalid equipment rules');
  const tier = (slot) => {
    const item = session?.playerState?.equipment?.[slot];
    if (item == null) return 0;
    if (!Number.isSafeInteger(item.tier) || item.tier <= 0) throw new RangeError('Invalid equipment tier');
    return item.tier;
  };
  // BigIntで大きなTier/係数も整数精度を失わず減算する。
  const reduction = BigInt(tier('armor')) * BigInt(rules.armorDamageReductionPerTier) +
    (sourceType === 'enemy' ? BigInt(tier('weapon')) * BigInt(rules.weaponEnemyReductionPerTier) : 0n);
  const reduced = BigInt(baseDamage) - reduction;
  const floor = BigInt(Math.min(baseDamage, rules.minimumPositiveDamage));
  return Number(reduced > floor ? reduced : floor);
}
