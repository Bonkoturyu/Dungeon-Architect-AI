export const CHARACTER_MOTION_VERSION = '1';

const TAU = Math.PI * 2;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

export function characterMotionPhase(key) {
  const text = String(key ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * TAU;
}

export function characterIdlePose(
  kind,
  elapsedMs,
  {
    phase = 0,
    reducedMotion = false,
    encounterIntro = false,
    encounterDurationMs = 420,
  } = {},
) {
  if (reducedMotion) {
    return {
      offsetY: 0,
      rotationY: 0,
      scaleXz: 1,
      scaleY: 1,
      leftArmDeltaZ: 0,
      rightArmDeltaZ: 0,
      headDeltaZ: 0,
      encounterProgress: 1,
      encounterPulse: 0,
    };
  }

  const elapsed = Math.max(0, finite(elapsedMs));
  const t = elapsed / 1000;
  const p = finite(phase);

  if (kind === 'enemy') {
    const encounterProgress = encounterIntro
      ? clamp01(elapsed / Math.max(1, encounterDurationMs))
      : 1;
    const encounterPulse = encounterIntro && encounterProgress < 1
      ? Math.sin(encounterProgress * Math.PI)
      : 0;

    return {
      offsetY:
        Math.sin(t * 2.7 + p) * 0.045 +
        encounterPulse * 0.075,
      rotationY:
        Math.sin(t * 1.55 + p) * 0.09 +
        Math.sin(encounterProgress * Math.PI * 2) * 0.035 * (1 - encounterProgress),
      scaleXz: 1 + Math.sin(t * 2.15 + p) * 0.012 + encounterPulse * 0.055,
      scaleY: 1 + Math.sin(t * 2.15 + p) * 0.022 + encounterPulse * 0.035,
      leftArmDeltaZ: Math.sin(t * 1.8 + p) * 0.045 - encounterPulse * 0.055,
      rightArmDeltaZ: -Math.sin(t * 1.8 + p) * 0.045 + encounterPulse * 0.055,
      headDeltaZ: Math.sin(t * 1.1 + p) * 0.026,
      encounterProgress,
      encounterPulse,
    };
  }

  return {
    offsetY: Math.sin(t * 1.9 + p) * 0.026,
    rotationY: Math.sin(t * 0.8 + p) * 0.018,
    scaleXz: 1 + Math.sin(t * 1.45 + p) * 0.006,
    scaleY: 1 + Math.sin(t * 1.45 + p) * 0.014,
    leftArmDeltaZ: Math.sin(t * 1.2 + p) * 0.022,
    rightArmDeltaZ: -Math.sin(t * 1.2 + p) * 0.022,
    headDeltaZ: Math.sin(t * 0.72 + p) * 0.014,
    encounterProgress: 1,
    encounterPulse: 0,
  };
}

export function characterDefeatPose(
  elapsedMs,
  {
    durationMs = 320,
    reducedMotion = false,
  } = {},
) {
  if (reducedMotion) {
    return {
      progress: 1,
      offsetY: 0,
      rotationZ: 0,
      scale: 0,
      finished: true,
    };
  }

  const progress = clamp01(
    Math.max(0, finite(elapsedMs)) / Math.max(1, durationMs),
  );
  const eased = 1 - ((1 - progress) ** 3);

  return {
    progress,
    offsetY: eased * 0.38,
    rotationZ: eased * 0.32,
    scale: Math.max(0.04, 1 - eased * 0.96),
    finished: progress >= 1,
  };
}
