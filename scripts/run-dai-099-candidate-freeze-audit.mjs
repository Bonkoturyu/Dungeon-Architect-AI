import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const EXPECTED_COMMIT = '027b0f3f6a5adc648dbff4cd00e28c0abe4778a3';
const EXPECTED_TREE = '1ee24b750bec04a4488c94ca2e7cc54ec015530f';
const ROLLBACK_BRANCH = 'rollback/submission-candidate-dai-099-2026-09-24';
const ROLLBACK_REMOTE_REF = `refs/heads/${ROLLBACK_BRANCH}`;
const EXPECTED_NODE = '24.15.0';
const EXPECTED_LOCK_SHA256 =
  'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc';
const EXPECTED_RUNTIME_SOURCE_SHA256 =
  'dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6';
const EXPECTED_VIDEO_SHA256 =
  'deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7';
const EXPECTED_DIST_MANIFEST_SHA256 =
  '9c324ad9d787a8e07788b80db2ec6358c7eb4440eb040eeb20e955ea82b4cf79';

const allowedChanges = new Set([
  'docs/planning/ISSUE_BACKLOG.md',
  'docs/submission/DAI099_CANDIDATE_FREEZE.json',
  'docs/submission/DAI-099_CANDIDATE_FREEZE.md',
  'scripts/run-dai-099-candidate-freeze-audit.mjs',
]);

const manifestPath = 'docs/submission/DAI099_CANDIDATE_FREEZE.json';
const freezePrepPath = 'artifacts/dai-099-freeze/dai-099-freeze-prep.json';
const videoPath = 'artifacts/dai-099-video/dai-099-refreshed-demo.mp4';
const buildInfoPath = 'dist/build-info.json';
const lockPath = 'package-lock.json';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const manifest = readJson(manifestPath);
const currentHead = git(['rev-parse', 'HEAD']);

let candidateExists = false;
try {
  execFileSync('git', ['cat-file', '-e', `${EXPECTED_COMMIT}^{commit}`], { stdio: 'ignore' });
  candidateExists = true;
} catch {}

const candidateTree = candidateExists
  ? git(['show', '-s', '--format=%T', EXPECTED_COMMIT])
  : null;
const candidateNode = candidateExists
  ? git(['show', `${EXPECTED_COMMIT}:.node-version`]).trim()
  : null;

let candidateIsAncestorOfHead = false;
try {
  execFileSync('git', ['merge-base', '--is-ancestor', EXPECTED_COMMIT, currentHead], { stdio: 'ignore' });
  candidateIsAncestorOfHead = true;
} catch {}

const changedPaths = candidateExists
  ? git(['diff', '--name-only', `${EXPECTED_COMMIT}..HEAD`])
      .split(/\r?\n/)
      .filter(Boolean)
  : [];
const unexpectedChanges = changedPaths.filter((file) => !allowedChanges.has(file));

let rollbackLookup = null;
let rollbackCommit = null;
try {
  rollbackLookup = git(['ls-remote', '--heads', 'origin', ROLLBACK_REMOTE_REF]);
  const [sha, ref] = rollbackLookup.split(/\s+/);
  if (ref === ROLLBACK_REMOTE_REF && /^[0-9a-f]{40}$/.test(sha)) {
    rollbackCommit = sha;
  }
} catch {}

const lockExists = fs.existsSync(lockPath);
const actualLockSha256 = lockExists ? sha256File(lockPath) : null;

const freezePrepExists = fs.existsSync(freezePrepPath);
const freezePrep = freezePrepExists ? readJson(freezePrepPath) : null;
const freezePrepSha256 = freezePrepExists ? sha256File(freezePrepPath) : null;

const videoExists = fs.existsSync(videoPath);
const videoSha256 = videoExists ? sha256File(videoPath) : null;
let videoDurationSeconds = null;
if (videoExists) {
  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'json',
    videoPath,
  ], { windowsHide: true, encoding: 'utf8' });
  if (!probe.error && probe.status === 0) {
    videoDurationSeconds = Number(JSON.parse(probe.stdout).format?.duration ?? 0);
  }
}

const buildInfoExists = fs.existsSync(buildInfoPath);
const buildInfo = buildInfoExists ? readJson(buildInfoPath) : null;

const checks = {
  candidateCommitExists: candidateExists,
  candidateManifestCommitExact: manifest.candidateCommit === EXPECTED_COMMIT,
  candidateTreeExact:
    candidateTree === EXPECTED_TREE &&
    manifest.candidateTree === EXPECTED_TREE,
  rollbackRefExact:
    rollbackCommit === EXPECTED_COMMIT &&
    manifest.rollbackBranch === ROLLBACK_BRANCH,
  candidateIsAncestorOfBookkeepingHead: candidateIsAncestorOfHead,
  onlyFreezeBookkeepingChanged: unexpectedChanges.length === 0,
  nodeVersionExact:
    candidateNode === EXPECTED_NODE &&
    manifest.nodeVersion === EXPECTED_NODE,
  auditedLockfileExact:
    actualLockSha256 === EXPECTED_LOCK_SHA256 &&
    manifest.auditedPackageLockSha256 === EXPECTED_LOCK_SHA256,
  freezePrepExists,
  freezePrepPassed:
    freezePrep?.passed === true &&
    Array.isArray(freezePrep?.falseChecks) &&
    freezePrep.falseChecks.length === 0,
  freezePrepCandidateExact:
    freezePrep?.candidate?.commit === EXPECTED_COMMIT &&
    freezePrep?.candidate?.tree === EXPECTED_TREE,
  freezePrepRuntimeSourceExact:
    freezePrep?.runtime?.runtimeSourceSha256 === EXPECTED_RUNTIME_SOURCE_SHA256 &&
    manifest.runtime?.runtimeSourceSha256 === EXPECTED_RUNTIME_SOURCE_SHA256,
  freezePrepDistManifestExact:
    freezePrep?.build?.manifestSha256 === EXPECTED_DIST_MANIFEST_SHA256 &&
    manifest.freezePrep?.distManifestSha256 === EXPECTED_DIST_MANIFEST_SHA256,
  buildInfoMatchesCandidate:
    buildInfo?.commitSha === EXPECTED_COMMIT &&
    buildInfo?.runtimeSourceSha256 === EXPECTED_RUNTIME_SOURCE_SHA256,
  finalVideoExists: videoExists,
  finalVideoHashExact:
    videoSha256 === EXPECTED_VIDEO_SHA256 &&
    manifest.video?.sha256 === EXPECTED_VIDEO_SHA256,
  finalVideoUnder180Seconds:
    Number.isFinite(videoDurationSeconds) &&
    videoDurationSeconds > 0 &&
    videoDurationSeconds < 180,
  manualVisualReviewRecorded:
    manifest.video?.manualVisualReviewAccepted === true,
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
  candidate: {
    expectedCommit: EXPECTED_COMMIT,
    candidateTree,
    currentHead,
    changedPaths,
    unexpectedChanges,
    rollbackLookup,
    rollbackCommit,
  },
  dependencyBoundary: {
    candidateNode,
    actualLockSha256,
  },
  runtime: {
    expectedRuntimeSourceSha256: EXPECTED_RUNTIME_SOURCE_SHA256,
    buildInfo,
  },
  freezePrep: {
    path: freezePrepPath,
    sha256: freezePrepSha256,
    summary: freezePrep
      ? {
          passed: freezePrep.passed,
          candidate: freezePrep.candidate,
          runtimeSourceSha256: freezePrep.runtime?.runtimeSourceSha256 ?? null,
          distManifestSha256: freezePrep.build?.manifestSha256 ?? null,
        }
      : null,
  },
  video: {
    path: videoPath,
    sha256: videoSha256,
    durationSeconds: videoDurationSeconds,
  },
};

fs.mkdirSync(path.resolve('artifacts/dai-099-freeze'), { recursive: true });
fs.writeFileSync(
  path.resolve('artifacts/dai-099-freeze/dai-099-bookkeeping-audit.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    'DAI-099 candidate-freeze bookkeeping invariant failed: ' +
      falseChecks.join(', '),
  );
}
