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
  assert.equal(count, 39);
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
