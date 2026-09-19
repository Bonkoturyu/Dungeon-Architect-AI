import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EXPECTED_COMMIT = 'cacba2a1f8f079ab6401768b97f9fc91fff8f3b9';
const EXPECTED_TREE = 'e2938bb46e1cf2eedc3a90e2b7603bd6050486ad';
const ROLLBACK_REMOTE_REF = 'refs/remotes/origin/rollback/submission-candidate-m8-2026-09-19';
const EXPECTED_NODE = '24.15.0';
const EXPECTED_LOCK_SHA256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc';

const allowedChanges = new Set([
  '.gitignore',
  'README.md',
  'docs/planning/ISSUE_BACKLOG.md',
  'docs/submission/CHECKLIST.md',
  'docs/submission/KNOWN_LIMITATIONS.md',
  'docs/submission/CANDIDATE_FREEZE.json',
  'docs/submission/DAI-084_CANDIDATE_FREEZE.md',
  'scripts/run-dai-084-candidate-freeze-audit.mjs',
  'scripts/run-dai-084-validation.ps1',
]);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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
  return files;
}

const manifest = JSON.parse(fs.readFileSync('docs/submission/CANDIDATE_FREEZE.json', 'utf8'));
const lockPath = path.resolve('package-lock.json');
const distDir = path.resolve('dist');

let candidateExists = false;
try {
  execFileSync('git', ['cat-file', '-e', `${EXPECTED_COMMIT}^{commit}`], { stdio: 'ignore' });
  candidateExists = true;
} catch {}

let rollbackCommit = null;
try {
  rollbackCommit = git(['rev-parse', ROLLBACK_REMOTE_REF]);
} catch {}

const candidateTree = candidateExists ? git(['show', '-s', '--format=%T', EXPECTED_COMMIT]) : null;
const candidateNode = candidateExists ? git(['show', `${EXPECTED_COMMIT}:.node-version`]).trim() : null;
const currentHead = git(['rev-parse', 'HEAD']);

let candidateIsAncestorOfHead = false;
try {
  execFileSync('git', ['merge-base', '--is-ancestor', EXPECTED_COMMIT, currentHead], { stdio: 'ignore' });
  candidateIsAncestorOfHead = true;
} catch {}

const changedPaths = candidateExists
  ? git(['diff', '--name-only', `${EXPECTED_COMMIT}..HEAD`]).split(/\r?\n/).filter(Boolean)
  : [];
const unexpectedChanges = changedPaths.filter((file) => !allowedChanges.has(file));

const lockExists = fs.existsSync(lockPath);
const lockSha256 = lockExists ? sha256File(lockPath) : null;

const distExists = fs.existsSync(distDir);
const distFiles = distExists ? collectFiles(distDir).sort((a, b) => a.localeCompare(b)) : [];
const distManifest = distFiles.map((file) => {
  const relativePath = path.relative(distDir, file).replaceAll('\\', '/');
  return {
    path: relativePath,
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  };
});
const distManifestText = distManifest
  .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`)
  .join('');
const distManifestSha256 = crypto.createHash('sha256').update(distManifestText).digest('hex');

const checks = {
  candidateCommitExists: candidateExists,
  candidateCommitExact: manifest.candidateCommit === EXPECTED_COMMIT,
  candidateTreeExact: candidateTree === EXPECTED_TREE && manifest.candidateTree === EXPECTED_TREE,
  rollbackRefExact: rollbackCommit === EXPECTED_COMMIT && manifest.rollbackBranch === 'rollback/submission-candidate-m8-2026-09-19',
  candidateIsAncestorOfCurrentHead,
  onlyDAI084BookkeepingChanged: unexpectedChanges.length === 0,
  nodeVersionExact: candidateNode === EXPECTED_NODE && manifest.nodeVersion === EXPECTED_NODE,
  auditedLockfilePresent: lockExists,
  auditedLockfileExact: lockSha256 === EXPECTED_LOCK_SHA256 && manifest.auditedPackageLockSha256 === EXPECTED_LOCK_SHA256,
  productionBuildPresent: distExists && distManifest.length > 0,
  productionBuildHasRequiredFiles:
    ['index.html', '_headers', '_routes.json', 'THIRD_PARTY_NOTICES.txt']
      .every((required) => distManifest.some((entry) => entry.path === required)),
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  candidate: {
    id: manifest.candidateId,
    commit: EXPECTED_COMMIT,
    tree: candidateTree,
    rollbackRemoteRef: ROLLBACK_REMOTE_REF,
    rollbackCommit,
    currentHead,
    changedPaths,
    unexpectedChanges,
  },
  dependencyBoundary: {
    expectedNodeVersion: EXPECTED_NODE,
    candidateNodeVersion: candidateNode,
    expectedPackageLockSha256: EXPECTED_LOCK_SHA256,
    actualPackageLockSha256: lockSha256,
  },
  build: {
    fileCount: distManifest.length,
    manifestSha256: distManifestSha256,
    files: distManifest,
  },
  checks,
};

fs.mkdirSync(path.resolve('artifacts/candidate-freeze'), { recursive: true });
fs.writeFileSync(
  path.resolve('artifacts/candidate-freeze/dai-084-candidate-freeze.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
fs.writeFileSync(
  path.resolve('artifacts/candidate-freeze/dai-084-dist-manifest.txt'),
  distManifestText,
);

console.log(JSON.stringify(evidence, null, 2));
if (!passed) {
  throw new Error(`DAI-084 candidate-freeze invariant failed: ${JSON.stringify(checks)}`);
}
