import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { runtimeSourceFingerprint, collectBundleManifest, manifestSha256 } from '../../scripts/runtime-fingerprint.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '--quiet');
  write('apps/editor-slice/main.js', 'export const value = 1;\n');
  write('packages/cloud-intent/src/provider.js', 'export const model = "reviewed";\n');
  write('functions/api/design-intent.js', 'export const handler = 1;\n');
  git('add', '.');
  return { root, write, git };
}

test('runtime source hashes actual unstaged worktree bytes, not index blob IDs', (t) => {
  const { root, write, git } = fixture(t);
  const before = runtimeSourceFingerprint(root);
  const indexBefore = git('ls-files', '-s');
  write('apps/editor-slice/main.js', 'export const value = 2;\n');
  assert.equal(git('ls-files', '-s'), indexBefore);
  const after = runtimeSourceFingerprint(root);
  assert.notEqual(after, before);
  git('add', '.');
  assert.equal(runtimeSourceFingerprint(root), after, 'staging identical bytes must not change identity');
  write('apps/editor-slice/main.js', 'export const value = 1;\n');
  assert.equal(runtimeSourceFingerprint(root), before);
});

test('Cloud Intent dependencies and new source files change the runtime fingerprint', (t) => {
  const { root, write } = fixture(t);
  const before = runtimeSourceFingerprint(root);
  write('packages/cloud-intent/src/provider.js', 'export const model = "changed";\n');
  const changed = runtimeSourceFingerprint(root);
  assert.notEqual(changed, before);
  write('packages/cloud-intent/src/new-validator.js', 'export const valid = false;\n');
  assert.notEqual(runtimeSourceFingerprint(root), changed);
});

test('missing tracked source fails closed and unrelated evidence does not alter source identity', (t) => {
  const { root, write } = fixture(t);
  const before = runtimeSourceFingerprint(root);
  write('artifacts/diagnostic.json', '{}');
  write('docs/testing/example.md', '# Notes');
  assert.equal(runtimeSourceFingerprint(root), before);
  fs.unlinkSync(path.join(root, 'packages/cloud-intent/src/provider.js'));
  assert.throws(() => runtimeSourceFingerprint(root), /ENOENT/);
});

test('runtime source hash normalizes source text CRLF and CR while retaining actual edits', (t) => {
  const { root, write } = fixture(t);
  const before = runtimeSourceFingerprint(root);
  for (const eol of ['\r\n', '\r']) {
    write('apps/editor-slice/main.js', `export const value = 1;${eol}`);
    assert.equal(runtimeSourceFingerprint(root), before);
  }
  write('apps/editor-slice/main.js', 'export const value = 2;\r\n');
  assert.notEqual(runtimeSourceFingerprint(root), before);
});

test('Git Windows-style CRLF checkout and LF checkout produce the same source fingerprint', (t) => {
  const { root, write, git } = fixture(t);
  write('.gitattributes', 'package-lock.json -text\n');
  write('package-lock.json', '{\r\n  "lockfileVersion": 3\r\n}\r\n');
  git('add', '.');
  const before = runtimeSourceFingerprint(root);
  git('config', 'core.autocrlf', 'true');
  fs.unlinkSync(path.join(root, 'apps/editor-slice/main.js'));
  git('checkout-index', '--all', '--force');
  assert.match(fs.readFileSync(path.join(root, 'apps/editor-slice/main.js'), 'utf8'), /\r\n$/);
  assert.equal(runtimeSourceFingerprint(root), before);
  git('config', 'core.autocrlf', 'false');
  fs.unlinkSync(path.join(root, 'apps/editor-slice/main.js'));
  git('checkout-index', '--all', '--force');
  assert.equal(runtimeSourceFingerprint(root), before);
});

test('lockfile, binary files, and non-line-ending source bytes remain byte-sensitive', (t) => {
  const { root, write } = fixture(t);
  for (const file of ['package-lock.json', 'apps/editor-slice/asset.bin']) {
    write(file, Buffer.from([65, 13, 10]));
    const before = runtimeSourceFingerprint(root);
    write(file, Buffer.from([65, 10]));
    assert.notEqual(runtimeSourceFingerprint(root), before, file);
  }
  write('apps/editor-slice/main.js', Buffer.from([128, 13, 10]));
  const before = runtimeSourceFingerprint(root);
  write('apps/editor-slice/main.js', Buffer.from([129, 10]));
  assert.notEqual(runtimeSourceFingerprint(root), before, 'do not collapse non-UTF-8 bytes via text decoding');
});

test('bundle recomputation excludes build-info but detects runtime file mutations', (t) => {
  const { root, write } = fixture(t);
  write('dist/index.html', '<script src="/assets/index-abc.js"></script>\n');
  write('dist/assets/index-abc.js', 'console.log(1);\n');
  write('dist/build-info.json', '{"generatedAt":"before"}');
  const digest = () => manifestSha256(collectBundleManifest(path.join(root, 'dist')));
  const before = digest();
  write('dist/build-info.json', '{"generatedAt":"after"}');
  assert.equal(digest(), before);
  write('dist/assets/index-abc.js', 'console.log(2);\n');
  assert.notEqual(digest(), before);
});

test('build and audit share the source and bundle algorithms; freeze recomputes actual dist', () => {
  const read = (file) => fs.readFileSync(new URL(`../../scripts/${file}`, import.meta.url), 'utf8');
  const build = read('build-hosting.mjs');
  const audit = read('run-dai-099-build-fingerprint-audit.mjs');
  const freeze = read('run-dai-099-freeze-prep.mjs');
  for (const source of [build, audit]) {
    assert.match(source, /from '\.\/runtime-fingerprint\.mjs'/);
    assert.match(source, /runtimeSourceFingerprint\(/);
    assert.match(source, /collectBundleManifest\(distDir\)/);
    assert.doesNotMatch(source, /ls-files.*'-s'/);
  }
  assert.match(build, /runtimeSourceFingerprint\(repoRoot\) !== runtimeSourceSha256/);
  assert.match(freeze, /manifestSha256\(collectBundleManifest\(distDir\)\)/);
  assert.match(freeze, /runtimeBundleSha256: currentRuntimeBundleSha256/);
});
