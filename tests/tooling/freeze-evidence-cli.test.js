import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { runtimeSourceFingerprint, collectBundleManifest, manifestSha256 } from '../../scripts/runtime-fingerprint.mjs';
import { captureFileState } from '../../scripts/recording-evidence.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const publicUrl = 'https://dungeon-architect-ai.pages.dev/';
const commitSha = 'a'.repeat(40);
const paths = {
  buildFingerprint: 'artifacts/dai-099-predeploy/dai-099-build-fingerprint.json',
  publicE2E: 'artifacts/dai-099-public/dai-099-refreshed-public.json',
  videoPlan: 'artifacts/dai-099-video/dai-099-video-plan.json',
  videoRun: 'artifacts/dai-099-video/dai-099-recording-run.json',
  legal: 'artifacts/legal/dai-073-legal-registers.json',
  privacy: 'artifacts/privacy/dai-074-secret-privacy.json',
  metadata: 'artifacts/submission-metadata/dai-083-submission-metadata.json',
  publicDocs: 'artifacts/public-docs/dai-080-public-docs.json',
};

// 一時fixtureのみ。git HEAD/statusとffprobe応答をstubし、実録画・production freezeを行わない。
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-freeze-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const json = (file, value) => write(file, JSON.stringify(value));
  for (const script of ['runtime-fingerprint.mjs', 'recording-evidence.mjs',
    'run-dai-099-freeze-prep.mjs', 'run-dai-099-build-fingerprint-audit.mjs']) {
    write(`scripts/${script}`, fs.readFileSync(path.join(repoRoot, 'scripts', script)));
  }
  write('package-lock.json', fs.readFileSync(path.join(repoRoot, 'package-lock.json')));
  write('apps/editor-slice/main.js', 'export const fixture = true;\n');
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  write('fixture-process-hook.mjs', `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const actualExecFileSync = childProcess.execFileSync;
    childProcess.execFileSync = (command, args, options) => {
      if (command !== 'git') throw new Error('Unexpected fixture command: ' + command);
      if (args[0] === 'ls-files') return actualExecFileSync(command, args, options);
      if (args[0] === 'rev-parse') return '${commitSha}';
      if (args[0] === 'branch') return 'main';
      if (args[0] === 'status') return '';
      if (args.includes('--format=%T')) return '${'b'.repeat(40)}';
      if (args.includes('--format=%cI')) return '2026-10-05T00:00:00Z';
      if (args.includes('--format=%s')) return 'Synthetic fixture';
      throw new Error('Unexpected fixture git args: ' + args);
    };
    childProcess.spawnSync = (command) => {
      if (command !== 'ffprobe') throw new Error('Unexpected fixture process: ' + command);
      return { status: 0, stdout: JSON.stringify({ format: { duration: '120', size: '27' } }) };
    };
    syncBuiltinESMExports();
  `);
  write('dist/index.html', '<script src="/assets/index-fixture.js"></script>\n');
  write('dist/assets/index-fixture.js', 'console.log("fixture");\n');
  write('dist/_headers', '/build-info.json\n  Cache-Control: no-store\n');
  write('dist/_routes.json', '{}\n');
  write('dist/THIRD_PARTY_NOTICES.txt', 'Synthetic fixture\n');
  const buildInfo = { schemaVersion: '1.0', commitSha, runtimeSourceSha256: runtimeSourceFingerprint(root),
    runtimeBundleSha256: manifestSha256(collectBundleManifest(path.join(root, 'dist'))) };
  json('dist/build-info.json', buildInfo);
  const remote = { ...buildInfo, runtimeBundleSha256: 'd'.repeat(64) };
  const videoPath = 'artifacts/dai-099-video/dai-099-refreshed-demo.mp4';
  write(videoPath, 'Synthetic non-video fixture');
  const capture = captureFileState(path.join(root, videoPath));
  const videoRun = {
    passed: true, publicUrl, buildFingerprint: { start: remote, end: remote },
    recordingBoundary: { actualVideoFileValidated: true, captureBefore: null,
      captureStartedAtMs: capture.modifiedAtMs - 1000, captureFile: capture,
      captureProbe: { sizeBytes: capture.sizeBytes, durationSeconds: 120,
        formatName: 'mov,mp4,m4a,3gp,3g2,mj2', streams: [{ codec_type: 'video' }] } },
  };
  const evidence = {
    buildFingerprint: { passed: true, head: commitSha, buildInfo },
    publicE2E: { passed: true, publicUrl, buildFingerprint: { remote } },
    videoPlan: { passed: true, actualVideoValidated: false }, videoRun,
    legal: { passed: true }, privacy: { passed: true }, metadata: { passed: true }, publicDocs: { passed: true },
  };
  for (const [name, value] of Object.entries(evidence)) json(paths[name], value);
  function run(script = 'run-dai-099-freeze-prep.mjs') {
    const result = spawnSync(process.execPath, ['--import', './fixture-process-hook.mjs', `scripts/${script}`], {
      cwd: root, encoding: 'utf8', windowsHide: true,
    });
    assert.ifError(result.error);
    const output = script.includes('freeze-prep') ? 'artifacts/dai-099-freeze/dai-099-freeze-prep.json' : paths.buildFingerprint;
    const file = path.join(root, output);
    return { ...result, evidence: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null };
  }
  return { root, write, json, run, evidence, buildInfo, videoPath };
}

test('freeze CLI accepts complete fixture evidence and records recomputed source/bundle values', (t) => {
  const { run, buildInfo } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.evidence.passed, true);
  assert.equal(result.evidence.runtime.recomputedRuntimeSourceSha256, buildInfo.runtimeSourceSha256);
  assert.equal(result.evidence.runtime.recomputedRuntimeBundleSha256, buildInfo.runtimeBundleSha256);
  assert.equal(result.evidence.runtime.publicBundleDiagnosticMatches, false);
});

test('freeze CLI rejects missing public-doc evidence before producing a freeze', (t) => {
  const { root, run } = fixture(t);
  fs.unlinkSync(path.join(root, paths.publicDocs));
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing required evidence: artifacts\/public-docs/);
  assert.equal(result.evidence, null);
});

test('freeze CLI rejects failed public-doc evidence', (t) => {
  const { run, json } = fixture(t);
  json(paths.publicDocs, { passed: false });
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.publicDocsAuditPassed, false);
});

test('freeze CLI rejects modified dist bytes even when prior fingerprint audit passed', (t) => {
  const { run, write } = fixture(t);
  write('dist/assets/index-fixture.js', 'console.log("modified after audit");\n');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.localRuntimeBundleRecomputes, false);
});

test('freeze CLI rejects new untracked runtime source after the passing audit', (t) => {
  const { run, write } = fixture(t);
  write('apps/editor-slice/untracked.js', 'export const newSource = true;');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.localRuntimeSourceRecomputes, false);
});

test('freeze CLI rejects replaced capture and interaction-only recording evidence', (t) => {
  const { run, write, videoPath, json } = fixture(t);
  write(videoPath, 'Synthetic different fixture');
  let result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.videoCaptureMatchesValidatedFile, false);
  json(paths.videoRun, { passed: true });
  result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.videoCaptureValidated, false);
});

test('freeze CLI rejects video from a different public deployment bundle', (t) => {
  const { run, json, evidence } = fixture(t);
  evidence.publicE2E.buildFingerprint.remote = { ...evidence.publicE2E.buildFingerprint.remote, runtimeBundleSha256: '0'.repeat(64) };
  json(paths.publicE2E, evidence.publicE2E);
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.videoBuildMatchesCandidate, false);
});

test('fingerprint audit CLI passes matching fixture and fails unstaged Cloud Intent or dist mutations', (t) => {
  const { run, write } = fixture(t);
  let result = run('run-dai-099-build-fingerprint-audit.mjs');
  assert.equal(result.status, 0, result.stderr);
  write('packages/cloud-intent/src/provider.js', 'export const schema = "changed";\n');
  write('dist/assets/index-fixture.js', 'console.log("changed");\n');
  result = run('run-dai-099-build-fingerprint-audit.mjs');
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence.checks.runtimeSourceHashRecomputes, false);
  assert.equal(result.evidence.checks.runtimeBundleHashRecomputes, false);
});
