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

const staleFinalCandidateFindings = [];
const stalePatterns = [
  /DAI-099 REFRESH IN PROGRESS/i,
  /FINAL CAPTURE PENDING/i,
  /refreshed deployment[^\n]*pending DAI-099/i,
  /DAI-099 must redeploy/i,
  /not claimed as refreshed public evidence until/i,
];
for (const [file, text] of Object.entries(texts)) {
  if (stalePatterns.some((pattern) => pattern.test(text))) {
    staleFinalCandidateFindings.push(file);
  }
}

const candidateCommit = '027b0f3f6a5adc648dbff4cd00e28c0abe4778a3';
const runtimeSourceSha256 =
  'dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6';
const finalVideoSha256 =
  'deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7';

const checks = {
  requiredPublicDocsExist: publicDocs.every((file) => fs.existsSync(file)),

  readmeReflectsRefreshedPublicCandidate:
    allIncludes(readme, [
      'https://dungeon-architect-ai.pages.dev/',
      'DESCRIBE',
      'GENERATE',
      'EDIT',
      'VALIDATE',
      'TEST / MYSTERY',
      'EXPLORE + ROOM EVENTS',
      'RESULT',
      'DAI-099 predeploy acceptance passed 22/22',
      'DAI-090 unexpected-prompt verification passed 20/20',
      candidateCommit,
      runtimeSourceSha256,
      '59.9 seconds',
      finalVideoSha256,
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

  judgeGuideMatchesAcceptedProduction:
    allIncludes(quick, [
      'refreshed DAI-099 production candidate',
      'DAI-090 unexpected-prompt verification passed 20/20',
      'Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.',
      'Move the treasure to the room that contains the goal.',
      'LV / HP / EXP / G',
      'Floor 2/2',
      'desktop Google Chrome on Windows',
    ]),

  knownLimitationsCurrent:
    allIncludes(limits, [
      'DesignIntent → DungeonSpec mapping is deliberately bounded',
      'Natural-language edit vocabulary is narrow',
      'Perspective and combat selection are Pending Evidence',
      'Player locomotion is room-graph based',
      'Mobile is outside the supported submission scope',
      'No persistence/accounts',
      'The refreshed DAI-099 candidate is complete',
      'DAI-090 unexpected-prompt verification subsequently passed 20/20',
      'DAI-091 final compliance/public repository readiness',
      'DAI-092 submission',
    ]),

  samplePromptsAreRefreshedPublicEvidence:
    allIncludes(prompts, [
      'DAI-099 refreshed public validation prompt',
      'refreshed verified public evidence',
      'Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.',
      'Verified public natural-language edit',
      'Move the treasure to the room that contains the goal.',
      'DAI-090',
      'all 20 total DAI-090 cases passed',
    ]),

  checklistReflectsCompletedDAI099AndDAI090:
    allIncludes(checklist, [
      '## Refreshed final candidate',
      '- [x] DAI-099 predeploy validation passes on the refreshed branch',
      '- [x] DAI-099 refreshed public E2E against the current 2-floor runtime passes',
      '- [x] DAI-099 refreshed demo video under 3 minutes is captured',
      '- [x] DAI-099 freeze-prep evidence passes',
      '- [x] DAI-099 new candidate hash / tree / runtime fingerprint / rollback point recorded',
      '- [x] DAI-090 unexpected-prompt checks',
      '- [ ] Final repository visibility requirement confirmed',
      '- [ ] DAI-091 final compliance',
      '- [ ] DAI-092 submission completed before 2026-11-11 23:30 JST',
    ]),

  storyboardRecordsAcceptedFinalCapture:
    allIncludes(storyboard, [
      'DAI-099 REFRESHED CAPTURE ACCEPTED',
      '59.9 seconds',
      '1920×1080',
      finalVideoSha256,
      'real hosted DAI-099 candidate',
    ]),

  submissionMetadataFinalized:
    submissionMetadata.includes('**AI 3D Scene Generation**') &&
    submissionMetadata.includes('513 characters') &&
    submissionMetadata.includes('70 whitespace-delimited words') &&
    submissionMetadata.includes('215 characters') &&
    submissionMetadata.includes('27 whitespace-delimited words'),

  localMarkdownLinksResolve: missingLocalLinks.length === 0,
  noTodoOrTbdPlaceholders: placeholderFindings.length === 0,
  noStaleFinalCandidateLanguage: staleFinalCandidateFindings.length === 0,
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
  staleFinalCandidateFindings,
  candidate: {
    commit: candidateCommit,
    runtimeSourceSha256,
    finalVideoSha256,
  },
  boundaries: {
    repositoryVisibilityChangedByThisAudit: false,
    refreshedHostedAcceptanceComplete: true,
    refreshedVideoAcceptanceComplete: true,
    DAI090UnexpectedPromptAcceptanceComplete: true,
    DAI091RepositoryVisibilityStillSeparate: true,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
fs.writeFileSync(evidencePath, serialized + '\n');
console.log(serialized);

if (!evidence.passed) {
  throw new Error(
    'DAI-080 final public-doc invariant failed: ' + falseChecks.join(', '),
  );
}
