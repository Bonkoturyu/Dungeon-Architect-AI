import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const FROZEN_CANDIDATE =
  '027b0f3f6a5adc648dbff4cd00e28c0abe4778a3';
const EXPECTED_RUNTIME_SOURCE_SHA256 =
  'dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6';
const EXPECTED_VIDEO_SHA256 =
  'deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7';
const EXPECTED_PUBLIC_URL =
  'https://dungeon-architect-ai.pages.dev/';
const REPO_API =
  'https://api.github.com/repos/Bonkoturyu/Dungeon-Architect-AI';
const outputDir = path.resolve('artifacts/dai-091');

const evidenceFiles = {
  freezePrep: 'artifacts/dai-099-freeze/dai-099-freeze-prep.json',
  publicE2E: 'artifacts/dai-099-public/dai-099-refreshed-public.json',
  dai090: 'artifacts/dai-090/dai-090-unexpected-prompt-regression.json',
  legal: 'artifacts/legal/dai-073-legal-registers.json',
  privacy: 'artifacts/privacy/dai-074-secret-privacy.json',
  publicDocs: 'artifacts/public-docs/dai-080-public-docs.json',
  metadata: 'artifacts/submission-metadata/dai-083-submission-metadata.json',
};
const videoPath =
  'artifacts/dai-099-video/dai-099-refreshed-demo.mp4';

const runtimePathPrefixes = [
  'apps/editor-slice/',
  'functions/',
  'packages/audio-presentation/src/',
  'packages/core/src/',
  'packages/editor-core/src/',
  'packages/generator/src/',
  'packages/intent/src/',
  'packages/onboarding/src/',
  'packages/play-core/src/',
  'packages/renderer-three/src/',
  'packages/run-core/src/',
];
const runtimeExactPaths = new Set([
  'spec/dungeon/fixtures/minimal-valid-v1.json',
  'THIRD_PARTY_NOTICES.txt',
  'package.json',
  'package-lock.json',
  'scripts/build-hosting.mjs',
]);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isRuntimePath(file) {
  return (
    runtimeExactPaths.has(file) ||
    runtimePathPrefixes.some((prefix) => file.startsWith(prefix))
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json, application/json',
      'user-agent': 'Dungeon-Architect-AI-DAI-091',
      'cache-control': 'no-cache',
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json };
}

fs.mkdirSync(outputDir, { recursive: true });

const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const trackedStatus = git([
  'status',
  '--porcelain',
  '--untracked-files=no',
]);

let descendsFromFrozenCandidate = false;
try {
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', FROZEN_CANDIDATE, head],
    { stdio: 'ignore' },
  );
  descendsFromFrozenCandidate = true;
} catch {}

const changedPaths = git([
  'diff',
  '--name-only',
  `${FROZEN_CANDIDATE}..HEAD`,
])
  .split(/\r?\n/)
  .filter(Boolean);
const runtimeChangedPaths = changedPaths.filter(isRuntimePath);

const missingEvidence = Object.entries(evidenceFiles)
  .filter(([, file]) => !fs.existsSync(file))
  .map(([name]) => name);

const evidence = Object.fromEntries(
  Object.entries(evidenceFiles)
    .filter(([, file]) => fs.existsSync(file))
    .map(([name, file]) => [name, readJson(file)]),
);

const repoResponse = await fetchJson(REPO_API);
const buildResponse = await fetchJson(
  EXPECTED_PUBLIC_URL + 'build-info.json?nocache=' + Date.now(),
);

const videoExists = fs.existsSync(videoPath);
const videoSha256 = videoExists ? sha256File(videoPath) : null;
let videoDurationSeconds = null;
if (videoExists) {
  const probe = spawnSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      videoPath,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (!probe.error && probe.status === 0) {
    videoDurationSeconds =
      Number(JSON.parse(probe.stdout).format?.duration ?? 0);
  }
}

const dai090 = evidence.dai090 ?? null;
const freezePrep = evidence.freezePrep ?? null;
const publicE2E = evidence.publicE2E ?? null;
const legal = evidence.legal ?? null;
const privacy = evidence.privacy ?? null;
const publicDocs = evidence.publicDocs ?? null;
const metadata = evidence.metadata ?? null;

const checks = {
  branchIsFinalComplianceOrMain:
    branch === 'final/dai-091-compliance-2026-09-25' ||
    branch === 'main',

  trackedWorkingTreeClean:
    trackedStatus === '',

  branchDescendsFromFrozenCandidate:
    descendsFromFrozenCandidate,

  frozenRuntimeSourceBoundaryUnchanged:
    runtimeChangedPaths.length === 0,

  allRequiredEvidencePresent:
    missingEvidence.length === 0,

  publicDemoBuildInfoAvailable:
    buildResponse.status === 200 &&
    buildResponse.json?.schemaVersion === '1.0',

  publicRuntimeSourceStillFrozen:
    buildResponse.json?.runtimeSourceSha256 ===
    EXPECTED_RUNTIME_SOURCE_SHA256,

  repositoryPublic:
    repoResponse.status === 200 &&
    repoResponse.json?.private === false &&
    repoResponse.json?.visibility === 'public',

  repositoryDefaultBranchMain:
    repoResponse.status === 200 &&
    repoResponse.json?.default_branch === 'main',

  repositoryLicenseApache2:
    repoResponse.status === 200 &&
    repoResponse.json?.license?.spdx_id === 'Apache-2.0',

  dai099FreezePrepPassed:
    freezePrep?.passed === true &&
    Array.isArray(freezePrep?.falseChecks) &&
    freezePrep.falseChecks.length === 0,

  dai099FreezeRuntimeSourceExact:
    freezePrep?.runtime?.runtimeSourceSha256 ===
    EXPECTED_RUNTIME_SOURCE_SHA256,

  dai099PublicE2EPassed:
    publicE2E?.passed === true &&
    publicE2E?.publicUrl === EXPECTED_PUBLIC_URL,

  dai090Passed:
    dai090?.passed === true &&
    Array.isArray(dai090?.falseChecks) &&
    dai090.falseChecks.length === 0 &&
    Array.isArray(dai090?.failedCaseIds) &&
    dai090.failedCaseIds.length === 0,

  dai090TwentyCases:
    dai090?.corpus?.caseCount === 20 &&
    dai090?.checks?.allCasesPassed === true,

  dai090RuntimeSourceExact:
    dai090?.candidate?.expectedRuntimeSourceSha256 ===
    EXPECTED_RUNTIME_SOURCE_SHA256,

  legalAuditPassed:
    legal?.passed === true,

  privacyAuditPassed:
    privacy?.passed === true,

  publicDocsAuditPassed:
    publicDocs?.passed === true,

  submissionMetadataAuditPassed:
    metadata?.passed === true,

  finalVideoExists:
    videoExists,

  finalVideoHashExact:
    videoSha256 === EXPECTED_VIDEO_SHA256,

  finalVideoUnder180Seconds:
    Number.isFinite(videoDurationSeconds) &&
    videoDurationSeconds > 0 &&
    videoDurationSeconds < 180,

  licenseFilePresent:
    fs.existsSync('LICENSE'),

  thirdPartyNoticesPresent:
    fs.existsSync('THIRD_PARTY_NOTICES.txt'),

  finalComplianceDocPresent:
    fs.existsSync('docs/submission/DAI-091_FINAL_COMPLIANCE.md'),
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const result = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  git: {
    branch,
    head,
    frozenCandidate: FROZEN_CANDIDATE,
    changedPaths,
    runtimeChangedPaths,
    trackedStatus,
  },
  public: {
    demoUrl: EXPECTED_PUBLIC_URL,
    buildInfoStatus: buildResponse.status,
    buildInfo: buildResponse.json,
    repositoryApiStatus: repoResponse.status,
    repository: repoResponse.json
      ? {
          fullName: repoResponse.json.full_name ?? null,
          private: repoResponse.json.private ?? null,
          visibility: repoResponse.json.visibility ?? null,
          defaultBranch: repoResponse.json.default_branch ?? null,
          licenseSpdx: repoResponse.json.license?.spdx_id ?? null,
        }
      : null,
  },
  evidence: {
    missingEvidence,
    dai090CaseCount: dai090?.corpus?.caseCount ?? null,
    dai090FailedCaseIds: dai090?.failedCaseIds ?? null,
    freezeCandidate: freezePrep?.candidate ?? null,
    runtimeSourceSha256:
      freezePrep?.runtime?.runtimeSourceSha256 ?? null,
  },
  video: {
    path: videoPath,
    sha256: videoSha256,
    durationSeconds: videoDurationSeconds,
  },
  officialRequirementSnapshot: {
    checkedAt: '2026-09-25',
    publicRepoRequired: true,
    browserDemoRequired: true,
    keepRepoAndDemoAccessibleThroughJudging: true,
    submissionDeadlineCest: '2026-11-11T16:30:00+02:00',
    submissionDeadlineJst: '2026-11-11T23:30:00+09:00',
    sourceVictoriaVr:
      'https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3',
    sourceKaggle:
      'https://www.kaggle.com/competitions/ai-builder-hackathon-2026',
  },
};

fs.writeFileSync(
  path.join(outputDir, 'dai-091-final-compliance.json'),
  JSON.stringify(result, null, 2) + '\n',
);

console.log(JSON.stringify(result, null, 2));

if (!result.passed) {
  throw new Error(
    'DAI-091 final compliance failed: ' + falseChecks.join(', '),
  );
}
