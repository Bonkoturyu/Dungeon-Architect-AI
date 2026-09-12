export const DESIGN_INTENT_VERSION = "1.0";

export const CORE_AXES = Object.freeze([
  "fairness",
  "tension",
  "exploration",
  "greedPunishment",
  "routeChoice",
  "learnability"
]);

export const SUPPORTING_AXES = Object.freeze([
  "combatDensity",
  "trapDensity",
  "rewardDensity",
  "deception",
  "telegraphStrength",
  "backtracking",
  "targetDifficulty"
]);

export const DEFAULT_DESIGN_INTENT = Object.freeze({
  schemaVersion: DESIGN_INTENT_VERSION,
  fairness: 0.7,
  tension: 0.5,
  exploration: 0.5,
  greedPunishment: 0.4,
  routeChoice: 0.5,
  learnability: 0.7,
  combatDensity: 0.4,
  trapDensity: 0.3,
  rewardDensity: 0.5,
  deception: 0.3,
  telegraphStrength: 0.65,
  backtracking: 0.3,
  targetDifficulty: 0.5,
  targetDuration: 480,
  instantDeathAllowed: false
});

function clamp01(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function clampDuration(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(1800, Math.max(120, value)));
}

export function normalizeDesignIntent(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const normalized = {
    schemaVersion: DESIGN_INTENT_VERSION,
    instantDeathAllowed: false
  };

  for (const key of [...CORE_AXES, ...SUPPORTING_AXES]) {
    normalized[key] = clamp01(source[key], DEFAULT_DESIGN_INTENT[key]);
  }

  normalized.targetDuration = clampDuration(source.targetDuration, DEFAULT_DESIGN_INTENT.targetDuration);
  return normalized;
}

export function validateDesignIntent(intent) {
  const errors = [];

  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    return {
      valid: false,
      errors: [{ code: "INTENT_NOT_OBJECT", path: "$", message: "DesignIntent must be an object." }]
    };
  }

  if (intent.schemaVersion !== DESIGN_INTENT_VERSION) {
    errors.push({
      code: "INTENT_VERSION_UNSUPPORTED",
      path: "schemaVersion",
      message: `Expected schemaVersion ${DESIGN_INTENT_VERSION}.`
    });
  }

  for (const key of [...CORE_AXES, ...SUPPORTING_AXES]) {
    if (typeof intent[key] !== "number" || !Number.isFinite(intent[key]) || intent[key] < 0 || intent[key] > 1) {
      errors.push({ code: "INTENT_AXIS_INVALID", path: key, message: `${key} must be a finite number between 0 and 1.` });
    }
  }

  if (!Number.isInteger(intent.targetDuration) || intent.targetDuration < 120 || intent.targetDuration > 1800) {
    errors.push({
      code: "TARGET_DURATION_INVALID",
      path: "targetDuration",
      message: "targetDuration must be an integer between 120 and 1800 seconds."
    });
  }

  if (intent.instantDeathAllowed !== false) {
    errors.push({
      code: "INSTANT_DEATH_NOT_SUPPORTED",
      path: "instantDeathAllowed",
      message: "MVP DesignIntent requires instantDeathAllowed=false."
    });
  }

  return { valid: errors.length === 0, errors };
}
