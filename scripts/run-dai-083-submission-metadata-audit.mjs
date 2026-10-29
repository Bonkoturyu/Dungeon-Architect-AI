import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const metadataPath = 'docs/submission/DAI-083_DESCRIPTION_CATEGORY.md';
const category = 'AI 3D Scene Generation';
const copyKeys = ['primary', 'compact', 'expanded', 'ai_role'];
const historicalHeading = '\n## Historical description and evidence';

const wordCount = (text) => text.trim().split(/\s+/u).filter(Boolean).length;
const characterCount = (text) => Array.from(text).length;

// Only current marked copy is eligible. Historical quoted copy must never satisfy
// today's text/count checks just because an earlier exact string still exists.
export function extractSubmissionCopies(metadata) {
  const historyIndex = metadata.indexOf(historicalHeading);
  const current = historyIndex < 0 ? metadata : metadata.slice(0, historyIndex);
  const copies = {};
  for (const key of copyKeys) {
    const start = `<!-- submission-copy:${key}:start -->`;
    const end = `<!-- submission-copy:${key}:end -->`;
    if (metadata.split(start).length !== 2 || metadata.split(end).length !== 2) {
      throw new Error(`Expected exactly one current marker pair for ${key}`);
    }
    const startIndex = current.indexOf(start);
    const endIndex = current.indexOf(end);
    if (startIndex < 0 || endIndex <= startIndex) {
      throw new Error(`Current copy missing or marker order invalid for ${key}`);
    }
    const lines = current.slice(startIndex + start.length, endIndex).trim().split('\n');
    if (!lines.every((line) => /^>(?: |$)/u.test(line))) {
      throw new Error(`Current ${key} copy must use plain Markdown quote lines`);
    }
    const text = lines.map((line) => line.replace(/^> ?/u, '')).join('\n').trim();
    if (!text) throw new Error(`Empty current copy for ${key}`);
    const after = current.slice(endIndex + end.length).split(/^## /mu)[0];
    const declared = after.match(/Measured length: \*\*(\d+) characters \/ (\d+) whitespace-delimited words\*\*/u);
    copies[key] = {
      text,
      characters: characterCount(text),
      words: wordCount(text),
      declaredCharacters: declared ? Number(declared[1]) : null,
      declaredWords: declared ? Number(declared[2]) : null,
    };
  }
  return { current, copies };
}

export function auditSubmissionMetadata({ metadata, adr, decision, productSpec, checklist }) {
  let current = '';
  let copies = {};
  const errors = [];
  try {
    ({ current, copies } = extractSubmissionCopies(metadata));
  } catch (error) {
    errors.push(error.message);
  }
  const primary = copies.primary?.text ?? '';
  const compact = copies.compact?.text ?? '';
  const expanded = copies.expanded?.text ?? '';
  const aiRole = copies.ai_role?.text ?? '';
  const includesAll = (text, terms) => terms.every((term) => text.includes(term));
  const checks = {
    currentCopyMarkersValid: errors.length === 0,
    categoryExact:
      current.includes(`**${category}**`) &&
      adr.includes(`Final focus category: \`${category}\``) &&
      decision.includes(`selects \`${category}\` as the final focus category`) &&
      productSpec.includes(`Final focus category: \`${category}\` (ADR-004)`),
    publicCategorySourcesRecorded:
      [current, adr].every((text) => includesAll(text, [
        'https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract',
        'https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3',
      ])),
    currentMeasuredCountsMatch: copyKeys.every((key) => {
      const copy = copies[key];
      return Boolean(copy && copy.characters === copy.declaredCharacters && copy.words === copy.declaredWords);
    }),
    // These are editorial fallback budgets, not organizer-verified form limits.
    shortCopyBudgets: Boolean(primary && compact && copies.primary.characters <= 500 && copies.compact.characters <= 200),
    primaryCoversProblemAiAndReuse: includesAll(primary, [
      'helps indie level designers', 'editable, playable', 'validated design intent',
      'one supported edit command per edit request', 'deterministic generators',
      'renderer-independent DungeonSpec', 'Full JSON', 'Layout JSON',
      "one floor's static appearance",
    ]),
    compactCoversCore: includesAll(compact, [
      'helps indie level designers', 'playable 3D dungeons', 'validated AI intent',
      'constrained editing', 'across generation strategies',
    ]),
    expandedCoversRequiredContent: includesAll(expanded, [
      'Open the demo in desktop Chrome on Windows', 'Play > Test',
      'schema-validated DesignIntent', 'single supported EditCommand',
      'does not generate or execute arbitrary runtime code',
      'same normalized input, Seed, settings, strategy and version',
      'renderer-independent DungeonSpec', 'Full JSON', 'Layout JSON', 'GLB',
      'JavaScript', 'Three.js', 'OpenAI Responses API', 'Cloudflare Pages',
      'Node.js', 'Vite', 'Playwright', 'OpenAI assistants', 'Claude Code',
      'GitHub Copilot', 'Kokoro', 'September 12 through October 19',
      'October 20 freeze', '806d70c',
    ]),
    expandedBoundariesPresent: includesAll(expanded, [
      'adoption and time savings have not yet been measured',
      'not necessarily for a fresh live-model response',
      'not 11 independent terrain algorithms', 'not in-progress play saves',
      'without gameplay or re-import into this app',
      'reuse in other domains remains a future possibility',
    ]),
    separateAiRoleBounded: includesAll(aiRole, [
      'schema-validated DesignIntent', 'one supported EditCommand',
      'Independent validation', 'does not generate or execute arbitrary runtime code',
      'Live-model responses are not claimed to be deterministic',
    ]),
    claimBoundariesPresent: includesAll(current, [
      'arbitrary free-form runtime-code generation',
      'unrestricted multi-command natural-language editing',
      'physics-character locomotion', 'final Perspective / Combat selection',
      'mobile support', 'persistent accounts or cloud project storage',
    ]),
    decisionClosed:
      !decision.match(/## Open decisions[\s\S]*- Final focus category/u) &&
      !productSpec.match(/## Unresolved by design[\s\S]*- Final focus category/u),
    checklistClosed:
      checklist.includes('- [x] Short description') &&
      checklist.includes('- [x] Focus category'),
  };
  const summary = (key) => copies[key] ? {
    characters: copies[key].characters,
    words: copies[key].words,
  } : null;
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    errors,
    category,
    primary: summary('primary'),
    compactFallback: summary('compact'),
    expanded: summary('expanded'),
    aiRole: summary('ai_role'),
    boundaries: {
      publicCategoryListMayChange: true,
      formLengthLimitCurrentlyUnknown: true,
      currentCopyOnly: true,
      runtimeOrLiveProviderAcceptance: false,
      automatedContentChecksDoNotReplaceEditorialReview: true,
    },
  };
}

function main() {
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    ...auditSubmissionMetadata({
      metadata: fs.readFileSync(metadataPath, 'utf8'),
      adr: fs.readFileSync('docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md', 'utf8'),
      decision: fs.readFileSync('docs/decisions/DECISION_LOG.md', 'utf8'),
      productSpec: fs.readFileSync('docs/requirements/PRODUCT_SPEC.md', 'utf8'),
      checklist: fs.readFileSync('docs/submission/CHECKLIST.md', 'utf8'),
    }),
  };
  const outputDir = path.resolve('artifacts/submission-metadata');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'dai-083-submission-metadata.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.passed) throw new Error(`DAI-083 submission metadata invariant failed: ${JSON.stringify(evidence.checks)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
