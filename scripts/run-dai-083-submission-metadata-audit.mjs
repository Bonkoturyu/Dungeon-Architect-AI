import fs from 'node:fs';
import path from 'node:path';

const metadataPath = 'docs/submission/DAI-083_DESCRIPTION_CATEGORY.md';
const adrPath = 'docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md';
const decisionPath = 'docs/decisions/DECISION_LOG.md';
const productSpecPath = 'docs/requirements/PRODUCT_SPEC.md';
const checklistPath = 'docs/submission/CHECKLIST.md';

const metadata = fs.readFileSync(metadataPath, 'utf8');
const adr = fs.readFileSync(adrPath, 'utf8');
const decision = fs.readFileSync(decisionPath, 'utf8');
const productSpec = fs.readFileSync(productSpecPath, 'utf8');
const checklist = fs.readFileSync(checklistPath, 'utf8');

const primary = 'Dungeon Architect AI is a browser-based tool that turns plain-language game-design intent into a validated, editable, playable low-poly 3D dungeon. It addresses the gap between describing a level and building a functional prototype: an LLM converts the prompt into structured DesignIntent, deterministic generation produces a DungeonSpec, and the same browser experience lets users edit, validate, and play the result. AI also supports constrained natural-language edits without generating arbitrary runtime code.';
const compact = 'Dungeon Architect AI turns plain-language design intent into validated, editable, playable low-poly 3D dungeons in the browser, using AI for structured DesignIntent generation and constrained natural-language edits.';
const category = 'AI 3D Scene Generation';

const wordCount = (text) => text.trim().split(/\s+/).length;

const checks = {
  categoryExact:
    metadata.includes(`**${category}**`) &&
    adr.includes(`Final focus category: \`${category}\``) &&
    decision.includes(`selects \`${category}\` as the final focus category`) &&
    productSpec.includes(`Final focus category: \`${category}\` (ADR-004)`),

  publicCategorySourcesRecorded:
    metadata.includes('https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract') &&
    metadata.includes('https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3') &&
    adr.includes('https://www.kaggle.com/competitions/ai-builder-hackathon-2026/overview/abstract') &&
    adr.includes('https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3'),

  primaryTextExact:
    metadata.includes(`> ${primary}`) &&
    primary.length === 513 &&
    wordCount(primary) === 70,

  compactFallbackExact:
    metadata.includes(`> ${compact}`) &&
    compact.length === 215 &&
    wordCount(compact) === 27,

  descriptionCoversRequiredContent:
    primary.includes('browser-based tool') &&
    primary.includes('gap between describing a level and building a functional prototype') &&
    primary.includes('an LLM converts the prompt into structured DesignIntent') &&
    primary.includes('AI also supports constrained natural-language edits'),

  claimBoundariesPresent:
    [
      'arbitrary free-form runtime-code generation',
      'unrestricted multi-command natural-language editing',
      'physics-character locomotion',
      'final Perspective / Combat selection',
      'mobile support',
      'persistent accounts or cloud project storage',
    ].every((term) => metadata.includes(term)),

  decisionClosed:
    !decision.match(/## Open decisions[\s\S]*- Final focus category/) &&
    !productSpec.match(/## Unresolved by design[\s\S]*- Final focus category/),

  checklistClosed:
    checklist.includes('- [x] Short description') &&
    checklist.includes('- [x] Focus category'),
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  checks,
  category,
  primary: {
    characters: primary.length,
    words: wordCount(primary),
  },
  compactFallback: {
    characters: compact.length,
    words: wordCount(compact),
  },
  boundaries: {
    publicCategoryListMayChange: true,
    formLengthLimitCurrentlyUnknown: true,
  },
};

const outputDir = path.resolve('artifacts/submission-metadata');
fs.mkdirSync(outputDir, { recursive: true });
const evidencePath = path.join(outputDir, 'dai-083-submission-metadata.json');
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));

if (!passed) {
  throw new Error(`DAI-083 submission metadata invariant failed: ${JSON.stringify(checks)}`);
}
