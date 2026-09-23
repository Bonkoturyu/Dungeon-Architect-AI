import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('artifacts/public-docs');
fs.mkdirSync(outputDir, { recursive: true });
const evidencePath = path.join(outputDir, 'dai-080-public-docs.json');

const publicDocs = [
  'README.md',
  'docs/submission/JUDGE_QUICKSTART.md',
  'docs/submission/KNOWN_LIMITATIONS.md',
  'docs/submission/SAMPLE_PROMPTS.md',
  'docs/submission/CHECKLIST.md',
  'docs/submission/DEMO_STORYBOARD.md',
  'docs/submission/DAI-083_DESCRIPTION_CATEGORY.md',
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const texts = Object.fromEntries(publicDocs.map((file) => [file, read(file)]));
const readme = texts['README.md'];
const quick = texts['docs/submission/JUDGE_QUICKSTART.md'];
const limits = texts['docs/submission/KNOWN_LIMITATIONS.md'];
const prompts = texts['docs/submission/SAMPLE_PROMPTS.md'];
const checklist = texts['docs/submission/CHECKLIST.md'];
const storyboard = texts['docs/submission/DEMO_STORYBOARD.md'];
const submissionMetadata = texts['docs/submission/DAI-083_DESCRIPTION_CATEGORY.md'];

function allIncludes(text, terms) {
  return terms.every((term) => text.includes(term));
}

function markdownLocalLinks(file, text) {
  const links = [];
  const regex = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(regex)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || /^[a-z]+:/i.test(raw)) continue;
    const destination = raw.split('#')[0];
    if (!destination) continue;
    const resolved = path.resolve(path.dirname(file), destination);
    links.push({ raw, resolved });
  }
  return links;
}

const missingLocalLinks = [];
for (const [file, text] of Object.entries(texts)) {
  for (const link of markdownLocalLinks(file, text)) {
    if (!fs.existsSync(link.resolved)) {
      missingLocalLinks.push({ file, link: link.raw });
    }
  }
}

const placeholderFindings = [];
for (const [file, text] of Object.entries(texts)) {
  if (/\b(?:TODO|TBD)\b/i.test(text)) placeholderFindings.push(file);
}

const checks = {
  requiredPublicDocsExist: publicDocs.every((file) => fs.existsSync(file)),
  readmeClaimsVerifiedFullFlow:
    readme.includes('https://dungeon-architect-ai.pages.dev/') &&
    readme.includes('DESCRIBE') &&
    readme.includes('GENERATE') &&
    readme.includes('EDIT') &&
    readme.includes('VALIDATE') &&
    readme.includes('START') &&
    readme.includes('PLAY') &&
    readme.includes('RESULT') &&
    readme.includes('production public E2E'),
  readmeLinksRequiredPublicDocs:
    allIncludes(readme, [
      'docs/submission/JUDGE_QUICKSTART.md',
      'docs/submission/KNOWN_LIMITATIONS.md',
      'docs/submission/SAMPLE_PROMPTS.md',
      'docs/privacy/PRIVACY_DATA_FLOW.md',
      'docs/legal/THIRD_PARTY_DEPENDENCIES.md',
      'docs/legal/AI_USAGE.md',
      'docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md',
      'docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md',
      'docs/architecture/adr/ADR-003-MOBILE-SCOPE-DESKTOP-ONLY.md',
      'docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md',
      'docs/submission/DAI-083_DESCRIPTION_CATEGORY.md',
      'docs/submission/CHECKLIST.md',
    ]),
  readmeDesktopScopeExplicit:
    readme.includes('desktop Google Chrome on Windows') &&
    readme.includes('mobile/narrow layouts are best-effort only'),
  readmeCandidateGenerationExplicit:
    readme.includes('Focus category: **AI 3D Scene Generation**') &&
    readme.includes('Historical DAI-084 rollback point') &&
    readme.includes('historical evidence') &&
    readme.includes('DAI-099') &&
    readme.includes('refreshed'),
  judgeGuideCurrentFlowTruthful:
    quick.includes('https://dungeon-architect-ai.pages.dev/') &&
    quick.includes('Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.') &&
    quick.includes('Move the treasure to the room that contains the goal.') &&
    quick.includes('desktop Google Chrome on Windows'),
  knownLimitationsComplete:
    allIncludes(limits, [
      'DesignIntent → DungeonSpec mapping is deliberately bounded',
      'Natural-language edit vocabulary is narrow',
      'Perspective and combat selection are Pending Evidence',
      'Player locomotion is room-graph based',
      'Mobile is outside the supported submission scope',
      'No persistence/accounts',
      'Submission packaging requires a refreshed candidate',
      'DAI-099',
    ]),
  samplePromptsReflectPublicE2E:
    prompts.includes('Verified public generation prompt') &&
    prompts.includes('Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.') &&
    prompts.includes('Verified public natural-language edit') &&
    prompts.includes('Move the treasure to the room that contains the goal.'),
  checklistSeparatesHistoricalAndRefreshed:
    checklist.includes('## Historical M8 evidence retained') &&
    checklist.includes('## Refreshed final candidate — pending') &&
    checklist.includes('- [x] Historical fresh-browser public E2E passed') &&
    checklist.includes('- [x] Historical demo video under 3 minutes recorded and reviewed') &&
    checklist.includes('- [ ] DAI-099 refreshed public E2E against the current runtime') &&
    checklist.includes('- [ ] DAI-099 refreshed demo video under 3 minutes') &&
    checklist.includes('- [ ] DAI-099 new candidate hash / rollback point including tracked `package-lock.json`') &&
    checklist.includes('- [ ] DAI-092 submission completed before 2026-11-11 23:30 JST'),
  storyboardRefreshPendingTruthful:
    storyboard.includes('REFRESH REQUIRED UNDER DAI-099') &&
    storyboard.includes('49.5-second capture remains historical evidence') &&
    storyboard.includes('DAI-099 has deployed the refreshed runtime'),
  submissionMetadataFinalized:
    submissionMetadata.includes('**AI 3D Scene Generation**') &&
    submissionMetadata.includes('513 characters') &&
    submissionMetadata.includes('70 whitespace-delimited words') &&
    submissionMetadata.includes('215 characters') &&
    submissionMetadata.includes('27 whitespace-delimited words'),
  localMarkdownLinksResolve: missingLocalLinks.length === 0,
  noTodoOrTbdPlaceholders: placeholderFindings.length === 0,
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  checks,
  publicDocs,
  missingLocalLinks,
  placeholderFindings,
  boundaries: {
    repositoryVisibilityChangedByDAI080: false,
    historicalHostedEvidencePreserved: true,
    refreshedHostedAcceptanceStillPending: true,
    generationUiClaimedCompleteLocally: true,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
fs.writeFileSync(evidencePath, serialized + '\n');
console.log(serialized);
if (!passed) throw new Error(`DAI-080 public-doc invariant failed: ${JSON.stringify(checks)}`);
