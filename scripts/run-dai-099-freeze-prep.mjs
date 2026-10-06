import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { runtimeSourceFingerprint, collectBundleManifest, manifestSha256 } from './runtime-fingerprint.mjs';
import { captureFileState, validateFreezeEvidence } from './recording-evidence.mjs';
import { readReviewedLockfileSha256 } from './reviewed-lockfile.mjs';

const EXPECTED_LOCK_SHA256 = readReviewedLockfileSha256();
const EXPECTED_PUBLIC_URL = 'https://dungeon-architect-ai.pages.dev/';
const outputDir = path.resolve('artifacts/dai-099-freeze');
const distDir = path.resolve('dist');

const evidenceFiles = {
  buildFingerprint: 'artifacts/dai-099-predeploy/dai-099-build-fingerprint.json',
  publicE2E: 'artifacts/dai-099-public/dai-099-refreshed-public.json',
  videoPlan: 'artifacts/dai-099-video/dai-099-video-plan.json',
  videoRun: 'artifacts/dai-099-video/dai-099-recording-run.json',
  legal: 'artifacts/legal/dai-073-legal-registers.json',
  privacy: 'artifacts/privacy/dai-074-secret-privacy.json',
  metadata: 'artifacts/submission-metadata/dai-083-submission-metadata.json',
  publicDocs: 'artifacts/public-docs/dai-080-public-docs.json',
};
const videoPath = 'artifacts/dai-099-video/dai-099-refreshed-demo.mp4';
const buildInfoPath = 'dist/build-info.json';
const lockPath = 'package-lock.json';

fs.mkdirSync(outputDir, { recursive: true });

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

function collectFiles(rootDir) {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  }

  walk(rootDir);
  return files.sort((a, b) => a.localeCompare(b));
}

const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const originMain = git(['rev-parse', 'origin/main']);
const tree = git(['show', '-s', '--format=%T', head]);
const commitTimestamp = git(['show', '-s', '--format=%cI', head]);
const commitMessage = git(['show', '-s', '--format=%s', head]);
const trackedStatus = git(['status', '--porcelain', '--untracked-files=no']);

for (const file of [lockPath, buildInfoPath, videoPath, ...Object.values(evidenceFiles)]) {
  if (!fs.existsSync(file)) {
    throw new Error('DAI-099 freeze prep missing required evidence: ' + file);
  }
}
if (!fs.existsSync(distDir)) throw new Error('dist/ missing.');

// 過去のpassedだけでは現候補のdocsを証明できないため、このcheckoutで必ず再監査する。
const publicDocsAudit = spawnSync(process.execPath, ['scripts/run-dai-080-public-docs-audit.mjs'], {
  cwd: process.cwd(),
  windowsHide: true,
  encoding: 'utf8',
});
if (publicDocsAudit.error || publicDocsAudit.status !== 0) {
  throw new Error('DAI-099 freeze prep requires a fresh passing public-doc audit.\n'
    + (publicDocsAudit.error?.message || publicDocsAudit.stderr || publicDocsAudit.stdout || 'Audit did not exit successfully.'));
}

const lockSha256 = sha256File(lockPath);
const buildInfo = readJson(buildInfoPath);
const publicEvidence = readJson(evidenceFiles.publicE2E);
const videoPlan = readJson(evidenceFiles.videoPlan);
const videoRun = readJson(evidenceFiles.videoRun);
const legal = readJson(evidenceFiles.legal);
const privacy = readJson(evidenceFiles.privacy);
const metadata = readJson(evidenceFiles.metadata);
const buildFingerprint = readJson(evidenceFiles.buildFingerprint);
const publicDocs = readJson(evidenceFiles.publicDocs);
const videoState = captureFileState(videoPath);
const currentRuntimeSourceSha256 = runtimeSourceFingerprint(process.cwd());
const currentRuntimeBundleSha256 = manifestSha256(collectBundleManifest(distDir));

const ffprobe = spawnSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration,size',
  '-of', 'json',
  videoPath,
], {
  windowsHide: true,
  encoding: 'utf8',
});
if (ffprobe.error || ffprobe.status !== 0) {
  throw new Error('ffprobe is required for final DAI-099 video freeze validation.');
}
const videoProbe = JSON.parse(ffprobe.stdout);
const videoDurationSeconds = Number(videoProbe.format?.duration ?? 0);

const distFiles = collectFiles(distDir);
const distManifest = distFiles.map((file) => {
  const relative = path.relative(distDir, file).replaceAll('\\', '/');
  return {
    path: relative,
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  };
});
const distManifestText = distManifest
  .map((entry) => entry.path + '\t' + entry.bytes + '\t' + entry.sha256 + '\n')
  .join('');
const distManifestSha256 = crypto
  .createHash('sha256')
  .update(distManifestText)
  .digest('hex');

const evidenceSha256 = Object.fromEntries(
  Object.entries(evidenceFiles).map(([name, file]) => [name, sha256File(file)]),
);
const remoteBuild = publicEvidence.buildFingerprint?.remote ?? null;
const checks = {
  ...validateFreezeEvidence({ buildInfo, runtimeBundleSha256: currentRuntimeBundleSha256,
    runtimeSourceSha256: currentRuntimeSourceSha256,
    videoRun, videoState, publicDocs, publicEvidence }),
  runningFromMain: branch === 'main',
  localMainMatchesOrigin: head === originMain,
  trackedWorkingTreeClean: trackedStatus === '',
  auditedLockfileExact: lockSha256 === EXPECTED_LOCK_SHA256,
  localBuildMatchesCandidateCommit:
    buildInfo.commitSha === head &&
    buildFingerprint.head === head &&
    buildFingerprint.passed === true,
  publicEvidencePassed:
    publicEvidence.passed === true &&
    publicEvidence.publicUrl === EXPECTED_PUBLIC_URL,
  publicEvidenceMatchesCandidateCommit:
    remoteBuild?.commitSha === head,
  publicRuntimeSourceMatchesCandidate:
    remoteBuild?.runtimeSourceSha256 === buildInfo.runtimeSourceSha256,
  videoPlanPassed:
    videoPlan.passed === true &&
    videoPlan.actualVideoValidated === false,
  finalVideoExists:
    fs.statSync(videoPath).size > 0,
  finalVideoUnder180Seconds:
    Number.isFinite(videoDurationSeconds) &&
    videoDurationSeconds > 0 &&
    videoDurationSeconds < 180,
  legalAuditPassed: legal.passed === true,
  privacyAuditPassed: privacy.passed === true,
  submissionMetadataAuditPassed: metadata.passed === true,
  distPresent: distManifest.length > 0,
  distHasBuildInfo:
    distManifest.some((entry) => entry.path === 'build-info.json'),
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
    commit: head,
    tree,
    commitTimestamp,
    commitMessage,
    branch,
    originMain,
  },
  dependencyBoundary: {
    packageLockSha256: lockSha256,
  },
  runtime: {
    publicUrl: EXPECTED_PUBLIC_URL,
    buildInfo,
    runtimeSourceSha256: buildInfo.runtimeSourceSha256,
    recomputedRuntimeSourceSha256: currentRuntimeSourceSha256,
    runtimeBundleSha256: buildInfo.runtimeBundleSha256,
    recomputedRuntimeBundleSha256: currentRuntimeBundleSha256,
    publicBuildInfo: remoteBuild,
    publicBundleDiagnosticMatches:
      remoteBuild?.runtimeBundleSha256 === buildInfo.runtimeBundleSha256,
  },
  video: {
    path: videoPath,
    sha256: sha256File(videoPath),
    durationSeconds: videoDurationSeconds,
    sizeBytes: fs.statSync(videoPath).size,
  },
  evidenceSha256,
  finalPublicDocsBoundary:
    'The public-doc audit is rerun against this checkout during freeze; final bookkeeping is audited again after acceptance.',
  build: {
    fileCount: distManifest.length,
    manifestSha256: distManifestSha256,
  },
};

fs.writeFileSync(
  path.join(outputDir, 'dai-099-freeze-prep.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(outputDir, 'dai-099-dist-manifest.txt'),
  distManifestText,
);

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    'DAI-099 freeze-prep invariant failed: ' + falseChecks.join(', '),
  );
}
