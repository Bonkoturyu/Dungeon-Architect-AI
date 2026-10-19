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

const candidateRecordUrl = 'https://github.com/Bonkoturyu/Dungeon-Architect-AI/pull/74';
const liveRecordName = 'LIVE_PROVIDER_OWNER_EVIDENCE_2026-10-04.md';
const supportedCommands = [
  'move-entity', 'move-room', 'resize-room', 'add-entity', 'remove-entity',
  'add-room', 'remove-room', 'add-corridor', 'remove-corridor',
  'reconnect-corridor', 'set-corridor-doors',
];
const currentStoryboard = storyboard.split('## 歴史的DAI-099撮影計画')[0];
const currentChecklist = checklist.split('## Historical September DAI-099 checklist')[0];
const obsoleteCurrentClaims = [
  ['README.md', 'The current production generator is frozen as **Generator Version 1**'],
  ['README.md', 'spatial variability is a future Generator Version concern'],
  ['README.md', 'is constrained to entity relocation'],
  ['docs/submission/JUDGE_QUICKSTART.md', '**AVOID / RISK**'],
  ['docs/submission/KNOWN_LIMITATIONS.md', 'currently supports entity relocation (`move-entity`)'],
  ['docs/submission/KNOWN_LIMITATIONS.md', 'room/corridor generation, or event editing from natural language'],
];
const obsoleteClaimFindings = obsoleteCurrentClaims
  .filter(([file, claim]) => texts[file].includes(claim))
  .map(([file, claim]) => ({ file, claim }));

const checks = {
  requiredPublicDocsExist: publicDocs.every((file) => fs.existsSync(file)),
  readmeCurrentFlowAndEvidenceBoundary:
    allIncludes(readme, [
      'https://dungeon-architect-ai.pages.dev/', 'DESCRIBE', 'GENERATE',
      'EDIT', 'VALIDATE', 'TEST / MYSTERY', 'EXPLORE + ROOM EVENTS', 'RESULT',
      'ACCEPTANCE_GAP_2026-10-03.md', 'Historical M8 / DAI-099', candidateRecordUrl,
    ]),
  readmeLinksRequiredPublicDocs:
    allIncludes(readme, [
      'docs/submission/JUDGE_QUICKSTART.md', 'docs/submission/KNOWN_LIMITATIONS.md',
      'docs/submission/SAMPLE_PROMPTS.md', 'docs/privacy/PRIVACY_DATA_FLOW.md',
      'docs/legal/THIRD_PARTY_DEPENDENCIES.md', 'docs/legal/AI_USAGE.md',
      'docs/architecture/adr/ADR-001-PRODUCTION-RENDERER-THREEJS.md',
      'docs/architecture/adr/ADR-002-HOSTING-CLOUDFLARE-PAGES.md',
      'docs/architecture/adr/ADR-003-MOBILE-SCOPE-DESKTOP-ONLY.md',
      'docs/architecture/adr/ADR-004-FOCUS-CATEGORY-AI-3D-SCENE-GENERATION.md',
      'docs/submission/DAI-083_DESCRIPTION_CATEGORY.md', 'docs/submission/CHECKLIST.md',
    ]),
  desktopScopeExplicit:
    readme.includes('desktop Google Chrome on Windows') &&
    readme.includes('mobile/narrow layouts are best-effort only') &&
    quick.includes('desktop Google Chrome on Windows'),
  currentGeneratorScopeExplicit:
    allIncludes(readme, ['Recommended alias selects **V3**', '**11 generator strategies**',
      'V1/V2 and BSP remain selectable', 'not a claim of eleven independent terrain algorithms']),
  quickstartCurrentGenerationFlow:
    allIncludes(quick, ['Auto', 'Manual', '**Generate**', '**Cancel**', 'difficulty',
      '2', 'bounded fallback', 'Unspecified random choices']),
  quickstartCurrentPlayRules:
    allIncludes(quick, ['**TRY TO AVOID**', '**70%**', 'floor Seed and trap ID',
      '**Finish floor**', 'active enemies/traps', 'Shop purchases are optional',
      'LV / HP / EXP / G', 'Floor 2/2']),
  currentSingleCommandVocabulary:
    allIncludes(limits, supportedCommands) &&
    allIncludes(limits, ['exactly one', '11 supported command types', 'Batch transactions',
      'Event editing', 'arbitrary runtime code', 'corridor-width editing', 'doorway-offset editing']) &&
    quick.includes('11 single-command types'),
  boundedContextDocumented:
    allIncludes(quick, ['includeRoomRequests: true', '`x`', '`z`', '`width`', '`depth`',
      '`fromRoomId`', '`toRoomId`', '`kind`', '`fromSide`', '`toSide`',
      'Events, renderer objects, Play/Run state, files and credentials are excluded',
      'PRIVACY_DATA_FLOW.md']),
  limitedLiveEvidenceNotFullAcceptance:
    [readme, quick, prompts].every((text) =>
      text.includes(liveRecordName) && text.includes('全公開E2E') && text.includes('公開build-info')),
  knownLimitationsComplete:
    allIncludes(limits, [
      'DesignIntent → DungeonSpec mapping is deliberately bounded',
      'Natural-language edit vocabulary is narrow', 'Perspective and combat selection are Pending Evidence',
      'Player locomotion is room-graph based', 'Mobile is outside the supported submission scope',
      'No persistence/accounts', 'Submission packaging requires a refreshed candidate',
      'Fixture coverage', candidateRecordUrl,
    ]),
  samplePromptsPreserveHistoricalScope:
    allIncludes(prompts, ['Verified public generation prompt — historical M8',
      'Historical September DAI-099', 'matching build fingerprint',
      'Move the treasure to the room that contains the goal.', candidateRecordUrl]),
  checklistSeparatesHistoricalAndCurrent:
    allIncludes(checklist, ['## Historical M8 evidence retained',
      '## 現候補（2026-10-04）', '## Historical September DAI-099 checklist — retained snapshot',
      '- [x] Short description', '- [x] Focus category', candidateRecordUrl]) &&
    currentChecklist.includes('全ゲートPASSの宣言ではありません'),
  rollbackIsRecoveryPointNotFinalAcceptance:
    [readme, limits, currentChecklist].every((text) =>
      text.includes('rollback/pre-submission-2026-10-04') &&
      text.includes('8bcce65246663bc16625a0f915ec2f202c63b5e4')) &&
    limits.includes('recovery point, not final acceptance'),
  currentVideoIdentityAndBoundary:
    allIncludes(currentStoryboard, ['150-second glb_v5', '新規撮影は行いません',
      '161f7674bb6963df212118919601b1da284622c234e566a156ea73c93bb17f9e',
      '公開アップロード・最終提出の完了は主張しません', candidateRecordUrl]),
  historicalStoryboardRetained:
    storyboard.includes('## 歴史的DAI-099撮影計画') &&
    storyboard.includes('49.5-second capture remains historical evidence'),
  noObsoleteCurrentClaims: obsoleteClaimFindings.length === 0,
  submissionMetadataFinalized:
    allIncludes(submissionMetadata, ['**AI 3D Scene Generation**', '513 characters',
      '70 whitespace-delimited words', '215 characters', '27 whitespace-delimited words']),
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
  obsoleteClaimFindings,
  boundaries: {
    repositoryVisibilityChangedByDAI080: false,
    historicalHostedEvidencePreserved: true,
    candidateAcceptanceInferredFromDocs: false,
    actualVideoValidatedByThisAudit: false,
    liveProviderCalledByThisAudit: false,
    currentEvidenceRecord: candidateRecordUrl,

  },
};

const serialized = JSON.stringify(evidence, null, 2);
fs.writeFileSync(evidencePath, serialized + '\n');
console.log(serialized);
if (!passed) throw new Error(`DAI-080 public-doc invariant failed: ${JSON.stringify(checks)}`);
