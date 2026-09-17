import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONBOARDING_STEPS,
  closeOnboarding,
  createOnboardingState,
  currentOnboardingStep,
  nextOnboardingStep,
  openOnboarding,
  previousOnboardingStep,
} from '../src/guide.js';

test('guide exposes the fixed verified workflow in deterministic order', () => {
  assert.deepEqual(ONBOARDING_STEPS.map((step) => step.id), ['welcome', 'edit', 'validate', 'play']);
  assert.equal(ONBOARDING_STEPS.length, 4);
});

test('guide opens at welcome and moves within fixed bounds', () => {
  let state = createOnboardingState();
  assert.equal(state.open, true);
  assert.equal(currentOnboardingStep(state).id, 'welcome');

  state = nextOnboardingStep(state);
  assert.equal(currentOnboardingStep(state).id, 'edit');
  state = nextOnboardingStep(state);
  state = nextOnboardingStep(state);
  assert.equal(currentOnboardingStep(state).id, 'play');
  state = nextOnboardingStep(state);
  assert.equal(currentOnboardingStep(state).id, 'play');

  state = previousOnboardingStep(state);
  assert.equal(currentOnboardingStep(state).id, 'validate');
});

test('guide close and reopen preserve an explicit, bounded state', () => {
  const closed = closeOnboarding(createOnboardingState({ stepIndex: 2 }));
  assert.equal(closed.open, false);
  assert.equal(closed.stepIndex, 2);

  const reopened = openOnboarding(closed, 99);
  assert.equal(reopened.open, true);
  assert.equal(reopened.stepIndex, ONBOARDING_STEPS.length - 1);
  assert.equal(currentOnboardingStep(reopened).id, 'play');
});

test('invalid initial indices fail safely to the first step', () => {
  const state = createOnboardingState({ stepIndex: Number.NaN });
  assert.equal(state.stepIndex, 0);
  assert.equal(currentOnboardingStep(state).id, 'welcome');
});
