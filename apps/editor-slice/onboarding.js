import {
  closeOnboarding,
  createOnboardingState,
  currentOnboardingStep,
  nextOnboardingStep,
  openOnboarding,
  previousOnboardingStep,
} from '../../packages/onboarding/src/guide.js';

const guideButton = document.querySelector('#guide');
const dialog = document.querySelector('#onboarding');
const eyebrow = document.querySelector('#onboardingEyebrow');
const title = document.querySelector('#onboardingTitle');
const body = document.querySelector('#onboardingBody');
const progress = document.querySelector('#onboardingProgress');
const backButton = document.querySelector('#onboardingBack');
const nextButton = document.querySelector('#onboardingNext');
const closeButton = document.querySelector('#onboardingClose');

let state = createOnboardingState();

function snapshot() {
  return {
    open: state.open,
    stepIndex: state.stepIndex,
    stepCount: state.stepCount,
    step: { ...currentOnboardingStep(state) },
  };
}

function render() {
  const step = currentOnboardingStep(state);
  eyebrow.textContent = step.eyebrow;
  title.textContent = step.title;
  body.textContent = step.body;
  progress.textContent = `${state.stepIndex + 1} / ${state.stepCount}`;
  backButton.disabled = state.stepIndex === 0;
  nextButton.textContent = state.stepIndex === state.stepCount - 1 ? 'Done' : 'Next';
  dialog.hidden = !state.open;
  dialog.dataset.step = step.id;
  document.body.dataset.onboardingOpen = String(state.open);
}

function openGuide(stepIndex = 0) {
  state = openOnboarding(state, stepIndex);
  render();
  closeButton.focus();
  return snapshot();
}

function closeGuide() {
  state = closeOnboarding(state);
  render();
  guideButton.focus();
  return snapshot();
}

function next() {
  if (state.stepIndex === state.stepCount - 1) return closeGuide();
  state = nextOnboardingStep(state);
  render();
  return snapshot();
}

function back() {
  state = previousOnboardingStep(state);
  render();
  return snapshot();
}

guideButton.addEventListener('click', () => openGuide(0));
closeButton.addEventListener('click', closeGuide);
nextButton.addEventListener('click', next);
backButton.addEventListener('click', back);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.open) closeGuide();
});

window.__DAI_ONBOARDING__ = {
  ready: true,
  getState: snapshot,
  open: openGuide,
  close: closeGuide,
  next,
  back,
};

render();
