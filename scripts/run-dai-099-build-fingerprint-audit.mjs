import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const distDir = path.resolve('dist');
const buildInfoPath = path.join(distDir, 'build-info.json');
const outputDir = path.resolve('artifacts/dai-099-predeploy');
fs.mkdirSync(outputDir, { recursive: true });

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function canonicalFingerprintPath(relativePath) {
  return relativePath.replace(
    /^assets\/index-[^/]+\.(js|css)$/i,
    (_match, extension) => `assets/index.${extension.toLowerCase()}`,
  );
}

function canonicalFingerprintBytes(relativePath, bytes) {
  const textLike =
    relativePath === '_headers' ||
    relativePath === '_routes.json' ||
    /\.(?:html|css|js|json|txt)$/i.test(relativePath);

  if (!textLike) return bytes;

  let text = bytes.toString('utf8').replace(/\r\n?/g, '\n');
  if (relativePath === 'index.html') {
    text = text.replace(
      /\/assets\/index-[^"'\s>]+\.(js|css)/gi,
      (_match, extension) => `/assets/index.${extension.toLowerCase()}`,
    );
  }
  return Buffer.from(text, 'utf8');
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function collect(dir) {
  const entries = [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(dir, full).replaceAll('\\', '/');
      if (relative === 'build-info.json') continue;
      const bytes = fs.readFileSync(full);
      const fingerprintBytes = canonicalFingerprintBytes(relative, bytes);
      entries.push({
        path: canonicalFingerprintPath(relative),
        bytes: fingerprintBytes.length,
        sha256: sha256(fingerprintBytes),
      });
    }
  }

  walk(dir);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

if (!fs.existsSync(buildInfoPath)) {
  throw new Error('dist/build-info.json missing. Run npm run build:hosting first.');
}

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
const head = git(['rev-parse', 'HEAD']).toLowerCase();
const manifest = collect(distDir);
const manifestText = manifest
  .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`)
  .join('');
const recomputedBundleSha256 = sha256(Buffer.from(manifestText, 'utf8'));
const headers = fs.readFileSync(path.join(distDir, '_headers'), 'utf8');

const checks = {
  buildInfoSchemaCurrent:
    buildInfo.schemaVersion === '1.0',
  commitShaPresent:
    /^[0-9a-f]{40}$/.test(buildInfo.commitSha ?? ''),
  localBuildCommitMatchesHead:
    buildInfo.commitSha === head,
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
