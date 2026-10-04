import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const audits = {
  publicDocs: ['scripts/run-dai-080-public-docs-audit.mjs', 'artifacts/public-docs/dai-080-public-docs.json'],
  videoPlan: ['scripts/run-dai-099-video-plan-audit.mjs', 'artifacts/dai-099-video/dai-099-video-plan.json'],
};

function withFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-public-docs-'));
  try {
    for (const entry of ['README.md', 'package.json', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt', 'docs', 'spec', 'scripts']) {
      fs.cpSync(path.join(repoRoot, entry), path.join(root, entry), { recursive: true });
    }
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function edit(root, file, before, after) {
  const target = path.join(root, file);
  const text = fs.readFileSync(target, 'utf8');
  assert.ok(text.includes(before), `Fixture text missing in ${file}: ${before}`);
  fs.writeFileSync(target, text.replace(before, after));
}

function run(root, name) {
  const [script, result] = audits[name];
  const processResult = spawnSync(process.execPath, [script], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
  assert.ifError(processResult.error);
  return { status: processResult.status, evidence: JSON.parse(fs.readFileSync(path.join(root, result), 'utf8')) };
}

test('current docs pass while preserving limited evidence and historical records', () => withFixture((root) => {
  const { status, evidence } = run(root, 'publicDocs');
  assert.equal(status, 0, JSON.stringify(evidence));
  assert.equal(evidence.passed, true);
  assert.deepEqual(evidence.obsoleteClaimFindings, []);
  assert.equal(evidence.boundaries.candidateAcceptanceInferredFromDocs, false);
  assert.equal(evidence.boundaries.liveProviderCalledByThisAudit, false);
  assert.equal(evidence.checks.historicalStoryboardRetained, true);
}));

test('retired V1-only claim is rejected even if current V3 wording is also present', () => withFixture((root) => {
  fs.appendFileSync(path.join(root, 'README.md'), '\nThe current production generator is frozen as **Generator Version 1**.\n');
  const { status, evidence } = run(root, 'publicDocs');
  assert.notEqual(status, 0);
  assert.equal(evidence.checks.noObsoleteCurrentClaims, false);
}));

test('omitting a supported structural command fails the vocabulary gate', () => withFixture((root) => {
  edit(root, 'docs/submission/KNOWN_LIMITATIONS.md', '`set-corridor-doors`', '`unsupported-example`');
  const { status, evidence } = run(root, 'publicDocs');
  assert.notEqual(status, 0);
  assert.equal(evidence.checks.currentSingleCommandVocabulary, false);
}));

test('old trap choice and missing outbound corridor fields are rejected', () => withFixture((root) => {
  edit(root, 'docs/submission/JUDGE_QUICKSTART.md', '**TRY TO AVOID**', '**AVOID / RISK**');
  edit(root, 'docs/submission/JUDGE_QUICKSTART.md', ' / `fromSide`', '');
  const { status, evidence } = run(root, 'publicDocs');
  assert.notEqual(status, 0);
  assert.equal(evidence.checks.quickstartCurrentPlayRules, false);
  assert.equal(evidence.checks.boundedContextDocumented, false);
  assert.equal(evidence.checks.noObsoleteCurrentClaims, false);
}));

test('limited live evidence requires its public build identity caveat', () => withFixture((root) => {
  edit(root, 'README.md', '公開build-info', 'deployment');
  const { status, evidence } = run(root, 'publicDocs');
  assert.notEqual(status, 0);
  assert.equal(evidence.checks.limitedLiveEvidenceNotFullAcceptance, false);
}));

test('video-plan audit records v2 identity without claiming actual video or current UI validation', () => withFixture((root) => {
  const { status, evidence } = run(root, 'videoPlan');
  assert.equal(status, 0, JSON.stringify(evidence));
  assert.equal(evidence.passed, true);
  assert.equal(evidence.retainedCandidateDurationSeconds, 150);
  assert.equal(evidence.actualVideoValidated, false);
  assert.equal(evidence.runtimeUiValidated, false);
  assert.equal(evidence.historicalRunnerCompatibilityWithCurrentUiVerified, false);
}));

test('changing the current video identity fails both audits despite preserved historical plan', () => withFixture((root) => {
  edit(root, 'docs/submission/DEMO_STORYBOARD.md',
    '3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8', '0'.repeat(64));
  const docs = run(root, 'publicDocs');
  const video = run(root, 'videoPlan');
  assert.notEqual(docs.status, 0);
  assert.equal(docs.evidence.checks.currentVideoIdentityAndBoundary, false);
  assert.notEqual(video.status, 0);
  assert.equal(video.evidence.checks.retainedVideoCandidateRecorded, false);
}));
