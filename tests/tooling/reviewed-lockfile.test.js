import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { readReviewedLockfileSha256 } from '../../scripts/reviewed-lockfile.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifestPath = 'docs/legal/evidence/REVIEWED_PACKAGE_LOCK.json';
const current = JSON.parse(fs.readFileSync(path.join(repoRoot, manifestPath), 'utf8'));
const historicalHash = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc';
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

test('current reviewed manifest matches exact lock bytes and source-map-js provenance', () => {
  assert.equal(readReviewedLockfileSha256(repoRoot), digest(fs.readFileSync(path.join(repoRoot, 'package-lock.json'))));
  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  assert.deepEqual(lock.packages['node_modules/source-map-js'], {
    version: '1.2.2', resolved: 'https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz',
    integrity: 'sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==',
    dev: true, license: 'BSD-3-Clause', engines: { node: '>=0.10.0' },
  });
});

test('Vite pin, legal audit and production review agree with the reviewed lock', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(path.join(repoRoot,
    'docs/legal/evidence/VITE_8_1_6_REVIEW_2026-10-30.json'), 'utf8'));
  const vite = lock.packages['node_modules/vite'];
  const reviewed = evidence.packages.find((entry) => entry.name === 'vite' && entry.version === '8.1.6');
  assert.ok(reviewed, 'exact Vite production-review evidence is required');
  assert.equal(packageJson.devDependencies.vite, reviewed.version);
  assert.equal(lock.packages[''].devDependencies.vite, reviewed.version);
  assert.equal(vite.version, reviewed.version);
  assert.equal(vite.resolved, reviewed.tarball);
  assert.equal(vite.integrity, reviewed.integrity);
  assert.equal(evidence.lock.sha256, current.sha256);
  assert.equal(evidence.review, current.review);
  const review = fs.readFileSync(path.join(repoRoot, current.review), 'utf8');
  assert.ok(review.includes(`vite@${reviewed.version}`));
  const register = fs.readFileSync(path.join(repoRoot, 'docs/legal/THIRD_PARTY_DEPENDENCIES.md'), 'utf8');
  const rows = register.split('\n').filter((line) => line.startsWith('| PROD-DEP-003 |'));
  assert.equal(rows.length, 1);
  const columns = rows[0].split('|').map((value) => value.trim());
  assert.equal(columns[2], 'vite');
  assert.equal(columns[3], reviewed.version);
  assert.equal(columns[9], 'Approved');
  const audit = fs.readFileSync(path.join(repoRoot, 'scripts/run-dai-073-legal-audit.mjs'), 'utf8');
  assert.ok(audit.includes(`'vite': '${reviewed.version}'`), 'legal audit must pin the reviewed Vite version');
});

test('reviewed identity rejects missing, malformed, unsupported and invalid manifests', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-lock-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, manifestPath);
  assert.throws(() => readReviewedLockfileSha256(root));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const value of ['{', 'null', JSON.stringify({}),
    JSON.stringify({ ...current, schemaVersion: 2 }),
    JSON.stringify({ ...current, schemaVersion: '1' }),
    JSON.stringify({ ...current, schemaVersion: true }),
    JSON.stringify({ ...current, lockfile: 'other.json' }),
    JSON.stringify({ ...current, lockfile: 'PACKAGE-LOCK.JSON' }),
    JSON.stringify({ ...current, sha256: 1 }),
    JSON.stringify({ ...current, sha256: current.sha256.toUpperCase() }),
    JSON.stringify({ ...current, sha256: current.sha256.slice(1) })]) {
    fs.writeFileSync(file, value);
    assert.throws(() => readReviewedLockfileSha256(root));
  }
  fs.writeFileSync(file, JSON.stringify(current));
  assert.equal(readReviewedLockfileSha256(root), current.sha256);
});

test('active PowerShell gates use one shared identity; DAI-084 keeps its frozen historical identity', () => {
  const scripts = path.join(repoRoot, 'scripts');
  const wrappers = fs.readdirSync(scripts).filter((file) => file.endsWith('.ps1'));
  let count = 0;
  for (const file of wrappers) {
    const source = fs.readFileSync(path.join(scripts, file), 'utf8');
    if (!source.includes('$ExpectedLockSha256 =')) continue;
    if (file === 'run-dai-084-validation.ps1') {
      assert.ok(source.includes(historicalHash));
      continue;
    }
    count += 1;
    assert.ok(source.includes("$ExpectedLockSha256 = & (Join-Path $PSScriptRoot 'get-reviewed-lockfile-sha.ps1')"), file);
    assert.ok(!source.includes(historicalHash), file);
    assert.match(source, /Get-FileHash -Algorithm SHA256/, file);
    assert.match(source, /-ne \$ExpectedLockSha256/, file);
  }
  assert.equal(count, 37);
  const helper = fs.readFileSync(path.join(scripts, 'get-reviewed-lockfile-sha.ps1'), 'utf8');
  assert.ok(helper.includes('REVIEWED_PACKAGE_LOCK.json'));
  assert.ok(helper.includes("$ErrorActionPreference = 'Stop'"));
  assert.ok(helper.includes('-not $NumericSchemaVersion'));
  assert.ok(helper.includes("$Manifest.lockfile -cne 'package-lock.json'"));
  assert.ok(helper.includes("-cnotmatch '^[0-9a-f]{64}$'"));
});

test('Windows-style Git checkout preserves reviewed lock bytes and rejects EOL-only changes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-lock-checkout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lock = fs.readFileSync(path.join(repoRoot, 'package-lock.json'));
  fs.copyFileSync(path.join(repoRoot, '.gitattributes'), path.join(root, '.gitattributes'));
  fs.writeFileSync(path.join(root, 'package-lock.json'), lock);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'true'], { cwd: root });
  execFileSync('git', ['add', '.gitattributes', 'package-lock.json'], { cwd: root });
  fs.unlinkSync(path.join(root, 'package-lock.json'));
  execFileSync('git', ['checkout-index', '--force', 'package-lock.json'], { cwd: root });
  const checkedOut = fs.readFileSync(path.join(root, 'package-lock.json'));
  assert.equal(digest(checkedOut), current.sha256);
  assert.deepEqual(checkedOut, lock);
  assert.notEqual(digest(Buffer.from(lock.toString('utf8').replace(/\r?\n/g, '\r\n'))), current.sha256);
});
