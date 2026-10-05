import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sameBuildFingerprint, validateRecordingCandidate, fetchRecordingBuild,
  captureFileState, validateCapture, validateFreezeEvidence } from '../../scripts/recording-evidence.mjs';

const publicUrl = 'https://dungeon-architect-ai.pages.dev/';
const candidate = { commitSha: 'a'.repeat(40), runtimeSourceSha256: 'b'.repeat(64), runtimeBundleSha256: 'c'.repeat(64) };
const remote = { ...candidate, runtimeBundleSha256: 'd'.repeat(64) };
const publicEvidence = { passed: true, publicUrl, buildFingerprint: { remote } };
const capture = { sizeBytes: 100, modifiedAtMs: 2000, sha256: 'e'.repeat(64) };
const probe = { sizeBytes: 100, durationSeconds: 120, formatName: 'mov,mp4,m4a,3gp,3g2,mj2', streams: [{ codec_type: 'video' }] };
const captureArgs = { before: null, after: capture, startedAtMs: 1000, probe };

function freezeArgs() {
  return {
    buildInfo: candidate, runtimeBundleSha256: candidate.runtimeBundleSha256, runtimeSourceSha256: candidate.runtimeSourceSha256, publicDocs: { passed: true },
    publicEvidence, videoState: capture,
    videoRun: { passed: true, publicUrl, buildFingerprint: { start: remote, end: remote }, recordingBoundary: {
      actualVideoFileValidated: true, captureBefore: null, captureFile: capture, captureProbe: probe, captureStartedAtMs: 1000,
    } },
  };
}

test('recording requires passing public evidence and candidate commit/source, allows OS-specific bundle diagnostic', () => {
  const args = { baseUrl: publicUrl, candidateBuild: candidate, publicEvidence };
  assert.equal(validateRecordingCandidate(args), true);
  for (const patch of [{ passed: false }, { publicUrl: 'https://different.example/' }, { buildFingerprint: { remote: { ...remote, runtimeSourceSha256: '0'.repeat(64) } } }]) {
    assert.equal(validateRecordingCandidate({ ...args, publicEvidence: { ...publicEvidence, ...patch } }), false);
  }
  assert.equal(validateRecordingCandidate({ ...args, baseUrl: 'http://localhost/' }), false);
  assert.equal(sameBuildFingerprint({}, {}), false);
  assert.equal(sameBuildFingerprint(remote, candidate), false);
});

test('recording fetches no-cache build-info and binds to exact public deployment fingerprint', async () => {
  const calls = [];
  const fetchMock = async (...args) => { calls.push(args); return { ok: true, json: async () => remote }; };
  assert.deepEqual(await fetchRecordingBuild(publicUrl, remote, fetchMock), remote);
  assert.equal(String(calls[0][0]), `${publicUrl}build-info.json`);
  await fetchRecordingBuild(`${publicUrl}nested/`, remote, fetchMock);
  assert.equal(String(calls[1][0]), `${publicUrl}build-info.json`);
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].headers['cache-control'], 'no-cache');
  for (const key of ['commitSha', 'runtimeSourceSha256', 'runtimeBundleSha256']) {
    await assert.rejects(fetchRecordingBuild(publicUrl, remote, async () => ({ ok: true,
      json: async () => ({ ...remote, [key]: '0'.repeat(remote[key].length) }) })), /differs/);
  }
  await assert.rejects(fetchRecordingBuild(publicUrl, remote, async () => ({ ok: false, status: 404 })), /HTTP 404/);
  await assert.rejects(fetchRecordingBuild(publicUrl, remote, async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } })), /Invalid JSON/);
});

test('fresh hashed and probed capture passes for both automatic and manual capture', () => {
  assert.equal(validateCapture(captureArgs).passed, true);
  assert.equal(validateCapture({ ...captureArgs, before: { ...capture, sha256: '0'.repeat(64) } }).passed, true);
});

test('missing, stale, touched-only, unprobed, wrong-format and over-limit captures fail closed', () => {
  const cases = [
    { after: null }, { after: { ...capture, sizeBytes: 0 } }, { after: { ...capture, sha256: null } },
    { after: { ...capture, modifiedAtMs: 999 } }, { before: { ...capture, modifiedAtMs: 1 } },
    { probe: null }, { probe: { ...probe, streams: [] } }, { probe: { ...probe, sizeBytes: 99 } },
    { probe: { ...probe, formatName: 'webm' } }, { startedAtMs: null },
    ...[0, 180, 181, NaN].map((durationSeconds) => ({ probe: { ...probe, durationSeconds } })),
  ];
  for (const patch of cases) assert.equal(validateCapture({ ...captureArgs, ...patch }).passed, false, JSON.stringify(patch));
});

test('capture state measures actual file bytes and replacements alter its SHA-256', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-capture-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'synthetic-fixture.mp4');
  assert.equal(captureFileState(file), null);
  fs.writeFileSync(file, 'fixture 1');
  const first = captureFileState(file);
  fs.writeFileSync(file, 'fixture 2');
  const second = captureFileState(file);
  assert.equal(first.sizeBytes, second.sizeBytes);
  assert.notEqual(first.sha256, second.sha256);
});

test('freeze accepts matching evidence while public/local bundle diagnostics may differ', () => {
  assert.ok(Object.values(validateFreezeEvidence(freezeArgs())).every((value) => value === true));
});

test('freeze rejects missing/failed docs, changed dist, stale or replaced video and changed deployment', () => {
  for (const publicDocs of [undefined, { passed: false }, { passed: 'true' }]) {
    assert.equal(validateFreezeEvidence({ ...freezeArgs(), publicDocs }).publicDocsAuditPassed, false);
  }
  assert.equal(validateFreezeEvidence({ ...freezeArgs(), runtimeSourceSha256: '0'.repeat(64) }).localRuntimeSourceRecomputes, false);
  assert.equal(validateFreezeEvidence({ ...freezeArgs(), runtimeBundleSha256: '0'.repeat(64) }).localRuntimeBundleRecomputes, false);
  assert.equal(validateFreezeEvidence({ ...freezeArgs(), videoState: { ...capture, sha256: '0'.repeat(64) } }).videoCaptureMatchesValidatedFile, false);
  const noCapture = freezeArgs(); noCapture.videoRun.recordingBoundary.actualVideoFileValidated = false;
  assert.equal(validateFreezeEvidence(noCapture).videoCaptureValidated, false);
  const noProbe = freezeArgs(); noProbe.videoRun.recordingBoundary.captureProbe = null;
  assert.equal(validateFreezeEvidence(noProbe).videoCaptureValidated, false);
  const changed = freezeArgs(); changed.videoRun.buildFingerprint.end = candidate;
  assert.equal(validateFreezeEvidence(changed).videoBuildMatchesCandidate, false);
});

test('recording runner checks build-info before and after interaction and validates manual capture unconditionally', () => {
  const source = fs.readFileSync(new URL('../../scripts/run-dai-099-recording-demo.mjs', import.meta.url), 'utf8');
  assert.equal((source.match(/await fetchRecordingBuild\(baseUrl, expectedPublicBuild\)/g) ?? []).length, 2);
  assert.match(source, /if \(!validateRecordingCandidate\(/);
  assert.match(source, /else if \(!auto\) await rl\.question\(`Stop and save/);
  assert.match(source, /const captureValidation = validateCapture\(/);
  assert.match(source, /Object\.assign\(evidence\.checks, captureValidation\.checks\)/);
  assert.match(source, /evidence\.passed = Object\.values\(evidence\.checks\)\.every/);
});
