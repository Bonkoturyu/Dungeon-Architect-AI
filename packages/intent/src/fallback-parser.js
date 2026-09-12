import { normalizeDesignIntent } from "./design-intent.js";

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function parseFallbackIntent(prompt) {
  const text = String(prompt ?? "").trim().toLowerCase();
  const draft = {};

  if (includesAny(text, ["初心者", "かんたん", "簡単", "easy", "beginner"])) {
    draft.targetDifficulty = 0.3;
    draft.fairness = 0.85;
    draft.telegraphStrength = 0.8;
    draft.learnability = 0.85;
  }

  if (includesAny(text, ["難しい", "高難度", "hard", "difficult", "challenging"])) {
    draft.targetDifficulty = 0.78;
    draft.tension = 0.72;
  }

  if (includesAny(text, ["欲張", "宝箱", "greed", "greedy", "treasure"])) {
    draft.greedPunishment = 0.82;
    draft.rewardDensity = 0.68;
    draft.deception = 0.58;
  }

  if (includesAny(text, ["探索", "寄り道", "explore", "exploration", "detour"])) {
    draft.exploration = 0.82;
    draft.routeChoice = 0.78;
    draft.backtracking = 0.42;
  }

  if (includesAny(text, ["迷う", "迷わせ", "maze", "迷路"])) {
    draft.routeChoice = Math.max(draft.routeChoice ?? 0, 0.82);
    draft.exploration = Math.max(draft.exploration ?? 0, 0.68);
    draft.backtracking = 0.55;
  }

  if (includesAny(text, ["怖い", "恐怖", "scary", "horror", "tense"])) {
    draft.tension = 0.85;
    draft.combatDensity = 0.28;
    draft.telegraphStrength = 0.5;
  }

  if (includesAny(text, ["戦闘少", "戦闘は少", "low combat", "less combat", "few enemies"])) {
    draft.combatDensity = 0.2;
  }

  if (includesAny(text, ["意地悪", "deceptive", "tricky"])) {
    draft.deception = 0.75;
    draft.greedPunishment = Math.max(draft.greedPunishment ?? 0, 0.65);
  }

  if (includesAny(text, ["公平", "フェア", "fair"])) {
    draft.fairness = 0.85;
    draft.telegraphStrength = Math.max(draft.telegraphStrength ?? 0, 0.72);
    draft.learnability = 0.82;
  }

  if (includesAny(text, ["理不尽", "unfair"])) {
    draft.fairness = 0.25;
    draft.telegraphStrength = 0.25;
    draft.learnability = 0.4;
  }

  if (includesAny(text, ["短い", "short", "5分", "five minute", "5 minute"])) {
    draft.targetDuration = 300;
  }

  if (includesAny(text, ["長い", "long", "15分", "fifteen minute", "15 minute"])) {
    draft.targetDuration = 900;
  }

  return normalizeDesignIntent(draft);
}
