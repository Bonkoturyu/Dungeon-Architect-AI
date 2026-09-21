export const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({ id: 'welcome', target: 'workspace' }),
  Object.freeze({ id: 'describe', target: 'generation' }),
  Object.freeze({ id: 'edit', target: 'authoring' }),
  Object.freeze({ id: 'validate', target: 'validation' }),
  Object.freeze({ id: 'play', target: 'play' }),
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
