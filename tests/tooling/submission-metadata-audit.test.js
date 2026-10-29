import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditSubmissionMetadata, extractSubmissionCopies } from '../../scripts/run-dai-083-submission-metadata-audit.mjs';

const read = (relative) => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
const metadata = read('docs/submission/DAI-083_DESCRIPTION_CATEGORY.md');
const sources = {
  metadata,
  adr: read('docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md'),
  decision: read('docs/decisions/DECISION_LOG.md'),
  productSpec: read('docs/requirements/PRODUCT_SPEC.md'),
  checklist: read('docs/submission/CHECKLIST.md'),
};

test('current submission metadata passes and counts extracted copy', () => {
  const result = auditSubmissionMetadata(sources);
  assert.equal(result.passed, true, JSON.stringify(result));
  const { copies } = extractSubmissionCopies(metadata);
  assert.equal(result.primary.characters, Array.from(copies.primary.text).length);
  assert.equal(result.compactFallback.words, copies.compact.text.split(/\s+/u).length);
  assert.ok(result.expanded.words > result.primary.words);
});

test('historical text alone cannot satisfy the current audit', () => {
  const historical = metadata.slice(metadata.indexOf('\n## Historical description and evidence'));
  const result = auditSubmissionMetadata({ ...sources, metadata: historical });
  assert.equal(result.passed, false);
  assert.equal(result.checks.currentCopyMarkersValid, false);
});

test('duplicate markers fail closed', () => {
  assert.throws(() => extractSubmissionCopies(metadata + '\n<!-- submission-copy:primary:start -->'), /exactly one/u);
});

test('current markers moved into the history section are rejected', () => {
  assert.throws(() => extractSubmissionCopies('\n## Historical description and evidence\n' + metadata), /Current copy missing/u);
});

test('stale declared character count fails the audit', () => {
  const changed = metadata.replace(/Measured length: \*\*\d+ characters/u, 'Measured length: **1 characters');
  assert.equal(auditSubmissionMetadata({ ...sources, metadata: changed }).checks.currentMeasuredCountsMatch, false);
});

test('required how-to content must be in the current expanded copy', () => {
  const changed = metadata.replace('> Open the demo in desktop Chrome on Windows.', '> Open the demo.');
  const result = auditSubmissionMetadata({ ...sources, metadata: changed });
  assert.equal(result.passed, false);
  assert.equal(result.checks.expandedCoversRequiredContent, false);
});

test('a missing current quote marker is rejected', () => {
  assert.throws(() => extractSubmissionCopies(metadata.replace('> Dungeon Architect AI helps', 'Dungeon Architect AI helps')), /plain Markdown quote/u);
});
