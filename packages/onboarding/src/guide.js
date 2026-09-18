export const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({
    id: 'welcome',
    eyebrow: 'Describe. Edit. Play.',
    title: 'Welcome to Dungeon Architect AI',
    body: 'This demo opens with a valid sample dungeon for immediate evaluation, and you can also generate a new dungeon from a natural-language design request. Use the guide at any time to follow the verified workflow.',
    target: 'workspace',
  }),
  Object.freeze({
    id: 'describe',
    eyebrow: 'Step 1 · Describe',
    title: 'Generate from design intent',
    body: 'Enter a dungeon design request in Describe / Generate. The server returns a validated DesignIntent and the browser deterministically builds a new DungeonSpec.',
    target: 'generation',
  }),
  Object.freeze({
    id: 'edit',
    eyebrow: 'Step 2 · Edit',
    title: 'Shape the dungeon',
    body: 'Click a room to select it, use the entity inspector for manual edits, or enter one natural-language relocation request in the AI edit panel.',
    target: 'authoring',
  }),
  Object.freeze({
    id: 'validate',
    eyebrow: 'Step 3 · Validate',
    title: 'Check the START gate',
    body: 'Validation must show PASS with zero Critical errors before START is enabled. Invalid reachability blocks play instead of silently repairing the dungeon.',
    target: 'validation',
  }),
  Object.freeze({
    id: 'play',
    eyebrow: 'Step 4 · Play',
    title: 'START, move, and reach Result',
    body: 'Press START to freeze an execution snapshot. In Play mode, click an adjacent room until you reach Goal, then inspect the Result and return to Edit.',
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
