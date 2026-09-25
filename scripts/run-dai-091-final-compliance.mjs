import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const REPO = 'Bonkoturyu/Dungeon-Architect-AI';
const PUBLIC_DEMO = 'https://dungeon-architect-ai.pages.dev/';
const TERMS_URL = 'https://www.victoriavr.com/hackathon/2026/terms';
const BUILD_PERIOD_URL =
  'https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3';

const CANDIDATE_COMMIT =
  '027b0f3f6a5adc648dbff4cd00e28c0abe4778a3';
const RUNTIME_SOURCE_SHA256 =
  'dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6';
const FINAL_VIDEO_SHA256 =
  'deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7';
const LOCK_SHA256 =
  'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc';

const outputDir = path.resolve('artifacts/dai-091');
const outputPath = path.join(outputDir, 'dai-091-final-compliance.json');

const evidenceFiles = {
  publicDocs: 'artifacts/public-docs/dai-080-public-docs.json',
  legal: 'artifacts/legal/dai-073-legal-registers.json',
  privacy: 'artifacts/privacy/dai-074-secret-privacy.json',
  metadata: 'artifacts/submission-metadata/dai-083-submission-metadata.json',
  dai090: 'artifacts/dai-090/dai-090-unexpected-prompt-regression.json',
  prePublic: 'artifacts/dai-091/dai-091-pre-public-audit.json',
};

const videoPath =
  'artifacts/dai-099-video/dai-099-refreshed-demo.mp4';

const allowedVerificationChanges = new Set([
  'README.md',
  'docs/submission/CHECKLIST.md',
  'docs/submission/DEMO_STORYBOARD.md',
  'docs/submission/JUDGE_QUICKSTART.md',
  'docs/submission/KNOWN_LIMITATIONS.md',
  'docs/submission/SAMPLE_PROMPTS.md',
  'docs/testing/DAI-090_UNEXPECTED_PROMPT_REGRESSION.md',
  'docs/testing/DAI-091_FINAL_COMPLIANCE.md',
  'scripts/run-dai-080-public-docs-audit.mjs',
  'scripts/run-dai-090-unexpected-prompt-regression.mjs',
  'scripts/run-dai-091-final-compliance.mjs',
  'scripts/run-dai-091-pre-public-audit.mjs',
  'spec/prompt-regression/fixtures/dai-090-unexpected-prompt-v1.json',
]);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'Dungeon-Architect-AI-DAI-091-Compliance',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  return {
    status: response.status,
    text: await response.text(),
  };
}

function htmlText(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const trackedStatus = git([
  'status',
  '--porcelain',
  '--untracked-files=no',
]);

let descendsFromCandidate = false;
try {
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', CANDIDATE_COMMIT, head],
    { stdio: 'ignore' },
  );
  descendsFromCandidate = true;
} catch {}

const changedPaths = git([
  'diff',
  '--name-only',
  `${CANDIDATE_COMMIT}..HEAD`,
])
  .split(/\r?\n/)
  .filter(Boolean);

const unexpectedVerificationChanges = changedPaths.filter(
  (file) => !allowedVerificationChanges.has(file),
);

const requiredTrackedFiles = [
  'LICENSE',
  'NOTICE',
  'THIRD_PARTY_NOTICES.txt',
  'README.md',
  'docs/requirements/HACKATHON_REQUIREMENTS.md',
  'docs/legal/AI_USAGE.md',
  'docs/legal/THIRD_PARTY_ASSETS.md',
  'docs/legal/THIRD_PARTY_DEPENDENCIES.md',
  'docs/legal/THIRD_PARTY_SERVICES.md',
  'docs/privacy/PRIVACY_DATA_FLOW.md',
  'docs/submission/CHECKLIST.md',
  'docs/submission/JUDGE_QUICKSTART.md',
  'docs/submission/KNOWN_LIMITATIONS.md',
  'docs/submission/SAMPLE_PROMPTS.md',
  'docs/submission/DEMO_STORYBOARD.md',
  'docs/submission/DAI-083_DESCRIPTION_CATEGORY.md',
  'docs/testing/DAI-090_UNEXPECTED_PROMPT_REGRESSION.md',
  'spec/prompt-regression/fixtures/dai-090-unexpected-prompt-v1.json',
];

const missingTrackedFiles = requiredTrackedFiles.filter(
  (file) => !fs.existsSync(file),
);

const lockSha256 = fs.existsSync('package-lock.json')
  ? sha256File('package-lock.json')
  : null;

const demoBuildResponse = await fetchText(
  `${PUBLIC_DEMO}build-info.json?nocache=${Date.now()}`,
);
let publicBuildInfo = null;
try {
  publicBuildInfo = JSON.parse(demoBuildResponse.text);
} catch {}

const githubPublicResponse = await fetchText(
  `https://api.github.com/repos/${REPO}`,
  {
    headers: {
      accept: 'application/vnd.github+json',
    },
  },
);
let githubPublicRepo = null;
try {
  githubPublicRepo = JSON.parse(githubPublicResponse.text);
} catch {}

const termsResponse = await fetchText(TERMS_URL);
const buildPeriodResponse = await fetchText(BUILD_PERIOD_URL);
const termsText = htmlText(termsResponse.text);
const buildPeriodText = htmlText(buildPeriodResponse.text);

const officialRequirements = {
  publicCodeRepository:
    /public code repository/i.test(termsText) &&
    /public code repository/i.test(buildPeriodText),
  hostedBrowserDemo:
    /hosted browser demo/i.test(termsText) &&
    /hosted browser demo/i.test(buildPeriodText),
  demoVideoUnderThreeMinutes:
    /demo video under three minutes/i.test(termsText) &&
    /demo video under three minutes/i.test(buildPeriodText),
  shortWrittenDescription:
    /short written description/i.test(termsText) ||
    /short-written description/i.test(buildPeriodText),
  selectedFocusCategory:
    /selected focus category/i.test(termsText) ||
    /chosen focus category/i.test(buildPeriodText),
  plainLanguageTo3DAndLogic:
    /plain language into 3D scenes and working logic/i.test(termsText) &&
    /plain language into 3D scenes and working logic/i.test(buildPeriodText),
  judgingMayUseOwnPrompts:
    /Judges may test submissions using their own prompts/i.test(termsText),
  publicRepoAndDemoRemainAccessible:
    /repositories and demo links must remain accessible/i.test(termsText),
  deadlinePresent:
    /11 November 2026/i.test(termsText) &&
    /16:30 CEST/i.test(termsText),
};

const missingEvidenceFiles = Object.values(evidenceFiles).filter(
  (file) => !fs.existsSync(file),
);

const evidence = Object.fromEntries(
  Object.entries(evidenceFiles)
    .filter(([, file]) => fs.existsSync(file))
    .map(([name, file]) => [name, readJson(file)]),
);

let videoDurationSeconds = null;
let videoSha256 = null;
if (fs.existsSync(videoPath)) {
  videoSha256 = sha256File(videoPath);
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      videoPath,
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
    },
  );
  if (!probe.error && probe.status === 0) {
    try {
      videoDurationSeconds = Number(
        JSON.parse(probe.stdout).format?.duration ?? 0,
      );
    } catch {}
  }
}

const readme = fs.existsSync('README.md')
  ? fs.readFileSync('README.md', 'utf8')
  : '';
const checklist = fs.existsSync('docs/submission/CHECKLIST.md')
  ? fs.readFileSync('docs/submission/CHECKLIST.md', 'utf8')
  : '';

const checks = {
  runningFromDAI091VerificationBranch:
    branch === 'verify/dai-091-final-compliance-2026-09-25',
  verificationBranchDescendsFromFrozenCandidate:
    descendsFromCandidate,
  verificationBranchHasNoRuntimeChanges:
    unexpectedVerificationChanges.length === 0,
  trackedWorkingTreeClean:
    trackedStatus === '',
  requiredTrackedMaterialsPresent:
    missingTrackedFiles.length === 0,
  auditedLockfileExact:
    lockSha256 === LOCK_SHA256,

  officialTermsReachable:
    termsResponse.status === 200 &&
    buildPeriodResponse.status === 200,
  officialSubmissionRequirementsStillMatch:
    Object.values(officialRequirements).every(Boolean),

  productionDemoReachable:
    demoBuildResponse.status === 200 &&
    publicBuildInfo?.schemaVersion === '1.0',
  productionRuntimeSourceMatchesFrozenCandidate:
    publicBuildInfo?.runtimeSourceSha256 === RUNTIME_SOURCE_SHA256,

  repositoryPublic:
    githubPublicResponse.status === 200 &&
    githubPublicRepo?.visibility === 'public' &&
    githubPublicRepo?.private === false,

  requiredEvidencePresent:
    missingEvidenceFiles.length === 0,
  finalPublicDocsAuditPassed:
    evidence.publicDocs?.passed === true,
  legalAuditPassed:
    evidence.legal?.passed === true,
  privacyAuditPassed:
    evidence.privacy?.passed === true,
  submissionMetadataAuditPassed:
    evidence.metadata?.passed === true,
  unexpectedPromptAuditPassed:
    evidence.dai090?.passed === true &&
    Array.isArray(evidence.dai090?.failedCaseIds) &&
    evidence.dai090.failedCaseIds.length === 0,
  prePublicExposureAuditPassed:
    evidence.prePublic?.passed === true &&
    Array.isArray(evidence.prePublic?.falseChecks) &&
    evidence.prePublic.falseChecks.length === 0,

  finalVideoExact:
    videoSha256 === FINAL_VIDEO_SHA256,
  finalVideoUnderThreeMinutes:
    Number.isFinite(videoDurationSeconds) &&
    videoDurationSeconds > 0 &&
    videoDurationSeconds < 180,

  readmeNamesCurrentPublicDemo:
    readme.includes(PUBLIC_DEMO) &&
    readme.includes('DAI-099 predeploy acceptance passed 22/22') &&
    readme.includes('DAI-090 unexpected-prompt verification passed 20/20'),

  checklistLeavesOnlyFinalPublicationAndSubmissionWork:
    checklist.includes('- [ ] Final repository visibility requirement confirmed') &&
    checklist.includes('- [x] DAI-090 unexpected-prompt checks') &&
    checklist.includes('- [ ] DAI-091 final compliance') &&
    checklist.includes('- [ ] DAI-092 submission completed before 2026-11-11 23:30 JST'),
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
  candidate: {
    frozenCommit: CANDIDATE_COMMIT,
    runtimeSourceSha256: RUNTIME_SOURCE_SHA256,
    publicBuildInfo,
    verificationBranch: branch,
    verificationHead: head,
    changedPaths,
    unexpectedVerificationChanges,
  },
  officialRules: {
    checkedAt: new Date().toISOString(),
    termsUrl: TERMS_URL,
    buildingPeriodUrl: BUILD_PERIOD_URL,
    termsStatus: termsResponse.status,
    buildingPeriodStatus: buildPeriodResponse.status,
    requirements: officialRequirements,
  },
  repository: {
    fullName: REPO,
    unauthenticatedStatus: githubPublicResponse.status,
    visibility: githubPublicRepo?.visibility ?? null,
    private: githubPublicRepo?.private ?? null,
  },
  artifacts: {
    missingEvidenceFiles,
    videoPath,
    videoSha256,
    videoDurationSeconds,
  },
  dependencyBoundary: {
    packageLockSha256: lockSha256,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(result, null, 2) + '\n',
);

console.log(JSON.stringify(result, null, 2));

if (!result.passed) {
  throw new Error(
    'DAI-091 final compliance failed: ' + falseChecks.join(', '),
  );
}
