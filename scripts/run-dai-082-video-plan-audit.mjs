import fs from 'node:fs';
import path from 'node:path';

const videoDoc = fs.readFileSync('docs/testing/DAI-082_VIDEO.md', 'utf8');
const storyboard = fs.readFileSync('docs/submission/DEMO_STORYBOARD.md', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const recordingRunner = fs.readFileSync('scripts/run-dai-082-recording-demo.mjs', 'utf8');

const checks = {
  requirementUnderThreeMinutes:
    videoDoc.includes('demo video under 3 minutes') &&
    videoDoc.includes('hard submission limit: **< 180 seconds**'),
  targetHasSafetyMargin:
    videoDoc.includes('internal target: **120–150 seconds**') &&
    storyboard.includes('Internal target: **2:00–2:30**'),
  publicCandidateOnly:
    videoDoc.includes('https://dungeon-architect-ai.pages.dev/') &&
    storyboard.includes('https://dungeon-architect-ai.pages.dev/'),
  requiredFlowCovered:
    ['Describe / Generate', 'Manual Edit', 'Natural-language Edit', 'START / Play', 'Result', 'Return to Edit']
      .every((term) => storyboard.includes(term)),
  narrationRespectsBoundaries:
    videoDoc.includes('one constrained EditCommand') &&
    videoDoc.includes('room-graph locomotion must not be narrated as physics/collision gameplay'),
  actualVideoStillRequired:
    videoDoc.includes('DAI-082 may be marked DONE only after the final video file is available') &&
    videoDoc.includes('actual duration is strictly below 180 seconds'),
  recordingRunnerRegistered: packageJson.scripts?.['demo:video'] === 'node scripts/run-dai-082-recording-demo.mjs',
  recordingRunnerUsesPlaySnapshotGraph:
    recordingRunner.includes('state.play?.snapshot') &&
    recordingRunner.includes('snapshot.corridors') &&
    !recordingRunner.includes('for (const corridor of state.corridors)'),
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  checks,
  targetVideoSeconds: 150,
  hardLimitSeconds: 180,
  actualVideoValidated: false,
};

fs.mkdirSync(path.resolve('artifacts/video'), { recursive: true });
fs.writeFileSync(
  path.resolve('artifacts/video/dai-082-video-plan.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) throw new Error(`DAI-082 video-plan invariant failed: ${JSON.stringify(checks)}`);
