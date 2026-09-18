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
  readmeDistinguishesCurrentAndTargetFlow:
    readme.includes('Current verified browser build') &&
    readme.includes('Not yet submission-complete') &&
    readme.includes('VALID SAMPLE') &&
    readme.includes('DESCRIBE → GENERATE → EDIT → VALIDATE → START → PLAY → RESULT / REVEAL'),
  readmeDoesNotClaimInitialGenerationIntegrated:
    readme.includes('initial full-dungeon') &&
    readme.includes('not exposed') &&
    readme.includes('required integration before final submission'),
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
      'docs/submission/CHECKLIST.md',
    ]),
  readmeDesktopScopeExplicit:
    readme.includes('desktop Google Chrome on Windows') &&
    readme.includes('Mobile/narrow layouts are best-effort only'),
  readmePendingSubmissionItemsExplicit:
    readme.includes('DAI-081') &&
    readme.includes('DAI-082') &&
    readme.includes('DAI-083') &&
    readme.includes('DAI-084') &&
    readme.includes('public-repository visibility switch is also still pending'),
  judgeGuideCurrentFlowTruthful:
    quick.includes('does **not yet expose the initial full-dungeon DESCRIBE → GENERATE prompt surface**') &&
    quick.includes('Move the treasure to the room that contains the goal.') &&
    quick.includes('desktop Google Chrome on Windows'),
  knownLimitationsComplete:
    allIncludes(limits, [
      'Initial full-dungeon generation UI is not integrated yet',
      'Natural-language edit vocabulary is narrow',
      'Perspective and combat selection are still Pending Evidence',
      'Mobile is outside the supported submission scope',
      'No persistence/accounts',
      'Public deployment is not final yet',
    ]),
  samplePromptsSeparateIntegratedAndBackend:
    prompts.includes('Current verified judge-facing prompt') &&
    prompts.includes('Move the treasure to the room that contains the goal.') &&
    prompts.includes('Backend DesignIntent regression prompts') &&
    prompts.includes('not yet the current editor-screen generation workflow'),
  checklistCompletedDocsAndCompliance:
    checklist.includes('- [x] Third-party disclosure complete') &&
    checklist.includes('- [x] AI usage disclosure complete') &&
    checklist.includes('- [x] LICENSE / NOTICE complete') &&
    checklist.includes('- [x] Secret/privacy audit pass') &&
    checklist.includes('- [x] Known limitations documented') &&
    checklist.includes('- [x] Sample prompts documented'),
  checklistDoesNotPrematurelyCloseSubmission:
    checklist.includes('- [ ] Public repository') &&
    checklist.includes('- [ ] Hosted browser demo') &&
    checklist.includes('- [ ] Demo video under 3 minutes') &&
    checklist.includes('- [ ] Short description') &&
    checklist.includes('- [ ] Focus category'),
  storyboardBlocksMisleadingFinalCapture:
    storyboard.includes('BLOCKED FOR FINAL RECORDING') &&
    storyboard.includes('DESCRIBE → GENERATE') &&
    storyboard.includes('Do not splice separately tested backend generation'),
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
    hostedUrlClaimedComplete: false,
    generationUiClaimedComplete: false,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
fs.writeFileSync(evidencePath, serialized + '\n');
console.log(serialized);
if (!passed) throw new Error(`DAI-080 public-doc invariant failed: ${JSON.stringify(checks)}`);
