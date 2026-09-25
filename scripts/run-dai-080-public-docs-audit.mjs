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
    links.push({
      raw,
      resolved: path.resolve(path.dirname(file), destination),
    });
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

const finalVideoSha256 =
  'deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7';
const runtimeSourceSha256 =
  'dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6';

const checks = {
  requiredPublicDocsExist:
    publicDocs.every((file) => fs.existsSync(file)),

  readmeCurrentPublicEvidenceTruthful:
    allIncludes(readme, [
      'https://dungeon-architect-ai.pages.dev/',
      'refreshed Cloudflare Pages production candidate passed DAI-099 public E2E',
      'DAI-090 then passed the final 20-case unexpected-prompt regression',
      'Refreshed Cloudflare Pages HTTPS candidate deployed',
      '59.9 s',
      finalVideoSha256,
      runtimeSourceSha256,
    ]),

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

  readmeRepositoryVisibilityBlockerExplicit:
    readme.includes('repository is still private') &&
    readme.includes('switched to Public before final submission'),

  judgeGuideCurrentFlowTruthful:
    allIncludes(quick, [
      'https://dungeon-architect-ai.pages.dev/',
      'Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.',
      'Floors',
      'LV / HP / EXP / G',
      'Floor 2/2',
      'Move the treasure to the room that contains the goal.',
      'desktop Google Chrome on Windows',
    ]),

  knownLimitationsComplete:
    allIncludes(limits, [
      'DesignIntent → DungeonSpec mapping is deliberately bounded',
      'Natural-language edit vocabulary is narrow',
      'Perspective and combat selection are Pending Evidence',
      'Player locomotion is room-graph based',
      'Mobile is outside the supported submission scope',
      'No persistence/accounts',
      'Refreshed submission packaging is complete; final compliance remains',
      'repository is still private',
      'DAI-090',
    ]),

  samplePromptsRefreshedEvidenceCurrent:
    allIncludes(prompts, [
      'Verified public generation prompt — historical M8',
      'Verified public generation prompt — refreshed DAI-099',
      'Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.',
      'refreshed verified public evidence',
      'Verified public natural-language edit',
      'Move the treasure to the room that contains the goal.',
      'DAI-090 unexpected-prompt verification',
    ]),

  checklistReflectsCompletedDAI099AndDAI090:
    checklist.includes('## Refreshed final candidate — current') &&
    checklist.includes('- [x] DAI-099 predeploy validation passes on the refreshed branch') &&
    checklist.includes('- [x] DAI-099 refreshed public E2E against the current 2-floor runtime passes') &&
    checklist.includes('- [x] DAI-099 refreshed demo video under 3 minutes is captured') &&
    checklist.includes('- [x] DAI-099 freeze-prep evidence passes') &&
    checklist.includes('- [x] DAI-099 new candidate hash / tree / runtime fingerprint / rollback point recorded') &&
    checklist.includes('- [x] DAI-090 unexpected-prompt checks') &&
    checklist.includes('BLOCKED: repository is currently Private') &&
    checklist.includes('- [ ] DAI-091 final compliance') &&
    checklist.includes('- [ ] DAI-092 submission completed before 2026-11-11 23:30 JST'),

  storyboardFinalCaptureAccepted:
    allIncludes(storyboard, [
      'FINAL REFRESHED CAPTURE ACCEPTED',
      '59.9 seconds',
      '1920×1080',
      '30 fps',
      'CLEARED / FLOOR 2/2',
      finalVideoSha256,
    ]),

  submissionMetadataFinalized:
    submissionMetadata.includes('**AI 3D Scene Generation**') &&
    submissionMetadata.includes('513 characters') &&
    submissionMetadata.includes('70 whitespace-delimited words') &&
    submissionMetadata.includes('215 characters') &&
    submissionMetadata.includes('27 whitespace-delimited words'),

  localMarkdownLinksResolve:
    missingLocalLinks.length === 0,

  noTodoOrTbdPlaceholders:
    placeholderFindings.length === 0,
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  publicDocs,
  missingLocalLinks,
  placeholderFindings,
  boundaries: {
    historicalHostedEvidencePreserved: true,
    refreshedHostedAcceptanceComplete: true,
    refreshedVideoAcceptanceComplete: true,
    dai090UnexpectedPromptRegressionComplete: true,
    repositoryVisibilityStillExternalBlocker: true,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
fs.writeFileSync(evidencePath, serialized + '\n');
console.log(serialized);

if (!evidence.passed) {
  throw new Error(
    'DAI-080 public-doc invariant failed: ' + falseChecks.join(', '),
  );
}
