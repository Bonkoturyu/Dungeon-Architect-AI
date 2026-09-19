export const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({
    id: 'welcome',
    eyebrow: 'Describe. Edit. Play.',
    title: 'Welcome to Dungeon Architect AI',
    body: 'Create a dungeon, edit it, then explore it.',
    target: 'workspace',
  }),
  Object.freeze({
    id: 'describe',
    eyebrow: 'Step 1 · Describe',
    title: 'Generate from design intent',
    body: 'Describe a dungeon in one sentence. Generate builds the playable 3D map.',
    target: 'generation',
  }),
  Object.freeze({
    id: 'edit',
    eyebrow: 'Step 2 · Edit',
    title: 'Shape the dungeon',
    body: 'Select rooms or entities to edit. Use ✦ AI Edit for one natural-language relocation.',
    target: 'authoring',
  }),
  Object.freeze({
    id: 'validate',
    eyebrow: 'Step 3 · Validate',
    title: 'Choose how to play',
    body: 'PASS unlocks ▶ Test for the current map. 🎲 Mystery creates a fresh unseen map from the same design intent.',
    target: 'validation',
  }),
  Object.freeze({
    id: 'play',
    eyebrow: 'Step 4 · Play',
    title: 'Explore the unknown',
    body: 'Only explored rooms stay visible. Choose arrow exits and the map draws itself as you move.',
    target: 'play',
  }),
]);

function normalizeIndex(index) {
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, index));
}

export function createOnboardingState({ open = true, stepIndex = 0 } = {}) {
  return Object.freeze({
    open: Boolean(open),
    stepIndex: normalizeIndex(stepIndex),
    stepCount: ONBOARDING_STEPS.length,
  });
}

export function currentOnboardingStep(state) {
  return ONBOARDING_STEPS[normalizeIndex(state?.stepIndex)];
}

export function openOnboarding(state, stepIndex = 0) {
  return createOnboardingState({ open: true, stepIndex });
}

export function closeOnboarding(state) {
  return createOnboardingState({ open: false, stepIndex: state?.stepIndex ?? 0 });
}

export function nextOnboardingStep(state) {
  return createOnboardingState({
    open: true,
    stepIndex: normalizeIndex((state?.stepIndex ?? 0) + 1),
  });
}

export function previousOnboardingStep(state) {
  return createOnboardingState({
    open: true,
    stepIndex: normalizeIndex((state?.stepIndex ?? 0) - 1),
  });
}
