export const ATMOSPHERE_VERSION = '1';

const BASE = Object.freeze({
  backgroundColor: 0x202834,
  fogColor: 0x202834,
  ambientSkyColor: 0xffffff,
  ambientGroundColor: 0x222233,
  sunColor: 0xffffff,
  ambientIntensity: 1.5,
  sunIntensity: 1.4,
  roomCurrentEmissiveIntensity: 0.5,
});

function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function axis(intent, key) {
  return clamp(intent?.[key] ?? 0.5);
}

function mixChannel(a, b, amount) {
  return Math.round(a + (b - a) * clamp(amount));
}

export function mixHexColor(from, to, amount) {
  const t = clamp(amount);
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  return (
    (mixChannel(fr, tr, t) << 16) |
    (mixChannel(fg, tg, t) << 8) |
    mixChannel(fb, tb, t)
  ) >>> 0;
}

function modeScale(mode) {
  if (mode === 'edit') return 0.4;
  if (mode === 'result') return 0.75;
  return 1;
}

export function createAtmosphereProfile(intent, { mode = 'edit' } = {}) {
  if (!intent || typeof intent !== 'object') {
    return {
      version: ATMOSPHERE_VERSION,
      enabled: false,
      mode,
      effectScale: 0,
      pressure: 0.5,
      clarity: 0.5,
      backgroundColor: BASE.backgroundColor,
      fog: {
        enabled: false,
        color: BASE.fogColor,
        near: null,
        far: null,
        strength: 0,
      },
      ambient: {
        skyColor: BASE.ambientSkyColor,
        groundColor: BASE.ambientGroundColor,
        intensity: BASE.ambientIntensity,
      },
      sun: {
        color: BASE.sunColor,
        intensity: BASE.sunIntensity,
      },
      roomCurrentEmissiveIntensity: BASE.roomCurrentEmissiveIntensity,
    };
  }

  const tension = axis(intent, 'tension');
  const exploration = axis(intent, 'exploration');
  const fairness = axis(intent, 'fairness');
  const deception = axis(intent, 'deception');
  const telegraph = axis(intent, 'telegraphStrength');
  const trapDensity = axis(intent, 'trapDensity');
  const difficulty = axis(intent, 'targetDifficulty');
  const rewardDensity = axis(intent, 'rewardDensity');
  const scale = modeScale(mode);

  const pressure = clamp(
    tension * 0.45 +
    difficulty * 0.25 +
    deception * 0.15 +
    trapDensity * 0.15,
  );
  const clarity = clamp(
    exploration * 0.35 +
    fairness * 0.25 +
    telegraph * 0.4,
  );

  const rawFogStrength = clamp(
    0.18 + pressure * 0.62 - clarity * 0.42,
    0.04,
    0.72,
  );
  const fogStrength = clamp(0.12 + (rawFogStrength - 0.12) * scale, 0.04, 0.72);

  let backgroundColor = mixHexColor(
    BASE.backgroundColor,
    0x131823,
    pressure * 0.62 * scale,
  );
  backgroundColor = mixHexColor(
    backgroundColor,
    0x29394b,
    clarity * 0.24 * scale,
  );

  let fogColor = mixHexColor(
    BASE.fogColor,
    0x171c29,
    pressure * 0.58 * scale,
  );
  fogColor = mixHexColor(
    fogColor,
    0x2b3b4c,
    clarity * 0.2 * scale,
  );

  let ambientSkyColor = mixHexColor(
    BASE.ambientSkyColor,
    0xb9c9df,
    pressure * 0.34 * scale,
  );
  ambientSkyColor = mixHexColor(
    ambientSkyColor,
    0xf3f9ff,
    clarity * 0.18 * scale,
  );

  let ambientGroundColor = mixHexColor(
    BASE.ambientGroundColor,
    0x151725,
    pressure * 0.58 * scale,
  );
  ambientGroundColor = mixHexColor(
    ambientGroundColor,
    0x2a3948,
    clarity * 0.22 * scale,
  );

  let sunColor = mixHexColor(
    BASE.sunColor,
    0xd7e3ff,
    tension * 0.2 * scale,
  );
  sunColor = mixHexColor(
    sunColor,
    0xffe1bd,
    rewardDensity * 0.1 * scale,
  );

  const fogNear = clamp(48 - fogStrength * 24, 26, 48);
  const fogFar = clamp(
    155 - fogStrength * 70 + clarity * 12,
    96,
    166,
  );

  const ambientIntensity = clamp(
    BASE.ambientIntensity +
      scale * (clarity * 0.34 - pressure * 0.38),
    1.08,
    1.78,
  );
  const sunIntensity = clamp(
    BASE.sunIntensity +
      scale * (
        telegraph * 0.2 +
        fairness * 0.12 -
        deception * 0.14 -
        pressure * 0.08
      ),
    1.12,
    1.72,
  );
  const roomCurrentEmissiveIntensity = clamp(
    BASE.roomCurrentEmissiveIntensity +
      scale * (telegraph * 0.24 + fairness * 0.08),
    0.5,
    0.82,
  );

  return {
    version: ATMOSPHERE_VERSION,
    enabled: true,
    mode,
    effectScale: scale,
    pressure,
    clarity,
    backgroundColor,
    fog: {
      enabled: true,
      color: fogColor,
      near: fogNear,
      far: Math.max(fogNear + 60, fogFar),
      strength: fogStrength,
    },
    ambient: {
      skyColor: ambientSkyColor,
      groundColor: ambientGroundColor,
      intensity: ambientIntensity,
    },
    sun: {
      color: sunColor,
      intensity: sunIntensity,
    },
    roomCurrentEmissiveIntensity,
  };
}
