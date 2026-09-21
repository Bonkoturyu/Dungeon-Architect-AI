import {
  closeOnboarding,
  createOnboardingState,
  currentOnboardingStep,
  nextOnboardingStep,
  openOnboarding,
  previousOnboardingStep,
} from '../../packages/onboarding/src/guide.js';
import {
  bindLanguageSwitchers,
  getLanguage,
  subscribeLanguage,
  t,
} from './i18n.js';

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
    language: getLanguage(),
    step: { ...currentOnboardingStep(state) },
  };
}

function render() {
  const step = currentOnboardingStep(state);
  eyebrow.textContent = t(`onboarding.${step.id}.eyebrow`);
  title.textContent = t(`onboarding.${step.id}.title`);
  body.textContent = t(`onboarding.${step.id}.body`);
  progress.textContent = `${state.stepIndex + 1} / ${state.stepCount}`;
  backButton.disabled = state.stepIndex === 0;
  backButton.textContent = t('onboarding.back');
  nextButton.textContent = state.stepIndex === state.stepCount - 1
    ? t('onboarding.done')
    : t('onboarding.next');
  closeButton.setAttribute('aria-label', t('onboarding.close'));
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

bindLanguageSwitchers(document);
subscribeLanguage(() => render());

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
