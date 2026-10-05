import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runtimeSourceFingerprint, collectBundleManifest, manifestSha256 } from './runtime-fingerprint.mjs';

const distDir = path.resolve('dist');
const buildInfoPath = path.join(distDir, 'build-info.json');
const outputDir = path.resolve('artifacts/dai-099-predeploy');
fs.mkdirSync(outputDir, { recursive: true });

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

if (!fs.existsSync(buildInfoPath)) {
  throw new Error('dist/build-info.json missing. Run npm run build:hosting first.');
}

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
const head = git(['rev-parse', 'HEAD']).toLowerCase();
const recomputedRuntimeSourceSha256 = runtimeSourceFingerprint(process.cwd());
const manifest = collectBundleManifest(distDir);
const recomputedBundleSha256 = manifestSha256(manifest);
const headers = fs.readFileSync(path.join(distDir, '_headers'), 'utf8');

const checks = {
  buildInfoSchemaCurrent:
    buildInfo.schemaVersion === '1.0',
  commitShaPresent:
    /^[0-9a-f]{40}$/.test(buildInfo.commitSha ?? ''),
  localBuildCommitMatchesHead:
    buildInfo.commitSha === head,
  runtimeSourceHashPresent:
    /^[0-9a-f]{64}$/.test(buildInfo.runtimeSourceSha256 ?? ''),
  runtimeSourceHashRecomputes:
    buildInfo.runtimeSourceSha256 === recomputedRuntimeSourceSha256,
  runtimeBundleHashPresent:
    /^[0-9a-f]{64}$/.test(buildInfo.runtimeBundleSha256 ?? ''),
  runtimeBundleHashRecomputes:
    buildInfo.runtimeBundleSha256 === recomputedBundleSha256,
  buildInfoNoStore:
    headers.includes('/build-info.json') &&
    headers.includes('Cache-Control: no-store'),
  requiredRuntimeFilesPresent:
    ['index.html', '_headers', '_routes.json', 'THIRD_PARTY_NOTICES.txt']
      .every((required) => manifest.some((entry) => entry.path === required)),
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
  head,
  buildInfo,
  recomputedRuntimeSourceSha256,
  recomputedBundleSha256,
  fileCountExcludingBuildInfo: manifest.length,
  manifest,
};

fs.writeFileSync(
  path.join(outputDir, 'dai-099-build-fingerprint.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    `DAI-099 build fingerprint invariant failed: ${falseChecks.join(', ')}`,
  );
}
