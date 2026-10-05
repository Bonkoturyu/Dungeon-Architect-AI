import fs from 'node:fs';
import path from 'node:path';

const videoDoc = fs.readFileSync('docs/testing/DAI-099_REFRESHED_VIDEO.md', 'utf8');
const storyboard = fs.readFileSync('docs/submission/DEMO_STORYBOARD.md', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const runner = fs.readFileSync('scripts/run-dai-099-recording-demo.mjs', 'utf8');

const recordingEvidence = fs.readFileSync('scripts/recording-evidence.mjs', 'utf8');

const currentVideoDoc = videoDoc.split('## 歴史的DAI-099撮影計画')[0];
const currentStoryboard = storyboard.split('## 歴史的DAI-099撮影計画')[0];
const expectedVideoSha256 = '3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8';
const aiUsage = fs.readFileSync('docs/legal/AI_USAGE.md', 'utf8');
const checks = {
  retainedVideoCandidateRecorded:
    [currentVideoDoc, currentStoryboard].every((text) =>
      text.includes('150-second v2') && text.includes(expectedVideoSha256) &&
      text.includes('新規撮影は行いません')) && aiUsage.includes(expectedVideoSha256),
  historicalPlanAndAcceptanceLimitsExplicit:
    videoDoc.includes('## 歴史的DAI-099撮影計画') &&
    currentVideoDoc.includes('公開アップロード・最終提出の完了は主張しません') &&
    currentVideoDoc.includes('現在の150秒v2を作成・再検証した証拠ではありません'),

  hardLimitUnder180:
    videoDoc.includes('strictly under 180 seconds') &&
    videoDoc.includes('under 165 seconds'),

  refreshedPublicCandidateRequired:
    videoDoc.includes('https://dungeon-architect-ai.pages.dev/') &&
    videoDoc.includes('matching build fingerprint') &&
    storyboard.includes('matching build fingerprint'),

  historicalFlowCoveragePreserved:
    [
      '2-floor',
      'manual room edit',
      'natural-language Edit',
      '▶ Test',
      'Room Event',
      'CHOOSE EXIT',
      'LV / HP / EXP / G',
      'Player/Enemy',
      'Floor 1 → Floor 2',
      'Floor 2/2',
      'Return to Edit',
    ].every((term) => videoDoc.includes(term)),

  historicalStoryboardFlowPreserved:
    [
      '2-floor',
      '▶ Test',
      'LV / HP / EXP / G',
      'Room Event',
      'Player/Enemy',
      'CHOOSE EXIT',
      'Floor 2',
      'Floor 2/2',
    ].every((term) => storyboard.includes(term)),

  runnerRegistered:
    packageJson.scripts?.['demo:refreshed-video'] ===
      'node scripts/run-dai-099-recording-demo.mjs',

  historicalRunnerFlowPreserved:
    runner.includes("await page.fill('#floorCount', '2')") &&
    runner.includes("await page.click('#start')") &&
    runner.includes('clear-enemy') &&
    runner.includes('#playExitButtons .exit-button') &&
    runner.includes('play?.floorIndex === 1') &&
    runner.includes('result.run?.floorsCompleted === 2'),

  runnerCapturesViewportOnly:
    runner.includes("'-offset_x', String(region.x)") &&
    runner.includes("'-offset_y', String(region.y)") &&
    runner.includes("'-video_size'") &&
    runner.includes('region.width') &&
    runner.includes('region.height') &&
    runner.includes("captureMode: useFfmpeg ? 'browser-viewport-region' : 'manual'"),

  runnerForcesPresentationWindow:
    runner.includes('Browser.setWindowBounds') &&
    runner.includes("windowState: 'fullscreen'"),

  runnerSuppressesBrowserNoise:
    runner.includes("'--disable-extensions'") &&
    runner.includes("'--disable-features=Translate,TranslateUI'") &&
    runner.includes("'--disable-translate'"),

  runnerGuardsDurationAndResolution:
    runner.includes('scriptedDemoUnder165Seconds') &&
    runner.includes('validateCapture({') &&
    runner.includes('Object.assign(evidence.checks, captureValidation.checks)') &&
    recordingEvidence.includes('actualCaptureUnder180Seconds') &&
    recordingEvidence.includes('probe.durationSeconds < 180') &&
    runner.includes('viewportCaptureRegion.innerWidth >= 1280') &&
    runner.includes('viewportCaptureRegion.innerHeight >= 720'),
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  targetVideoSeconds: 150,
  scriptedMaximumSeconds: 165,
  hardLimitSeconds: 180,
  actualVideoValidated: false,
  runtimeUiValidated: false,
  recordedVideoSha256: expectedVideoSha256,
  retainedCandidateDurationSeconds: 150,
  historicalRunnerCompatibilityWithCurrentUiVerified: false,
};

fs.mkdirSync(path.resolve('artifacts/dai-099-video'), { recursive: true });
fs.writeFileSync(
  path.resolve('artifacts/dai-099-video/dai-099-video-plan.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    'DAI-099 video-plan invariant failed: ' + falseChecks.join(', '),
  );
}
