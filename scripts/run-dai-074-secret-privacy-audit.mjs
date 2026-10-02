import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createOpenAIIntentRequest } from '../packages/cloud-intent/src/cloud-intent-adapter.js';
import { createOpenAIEditCommandRequest } from '../packages/cloud-intent/src/openai-edit-command-adapter.js';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { handleNaturalEditRequest } from '../functions/api/natural-edit.js';
import { handleDesignIntentRequest } from '../functions/api/design-intent.js';

const outputDir = path.resolve('artifacts/privacy');
const evidencePath = path.join(outputDir, 'dai-074-secret-privacy.json');
const distDir = path.resolve('dist');
fs.mkdirSync(outputDir, { recursive: true });

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function isText(buffer) {
  return !buffer.includes(0);
}

function normalize(p) {
  return p.replaceAll('\\\\', '/');
}

const files = trackedFiles();
const forbiddenTrackedPaths = files.filter((file) => {
  const p = normalize(file);
  const base = path.posix.basename(p);
  if (base === '.env') return true;
  if (base.startsWith('.env.') && base !== '.env.example') return true;
  if (base.startsWith('.dev.vars')) return true;
  if (/\.(?:pem|key|p12|pfx)$/i.test(base)) return true;
  if (p.startsWith('private/')) return true;
  if (p.startsWith('docs/legal/evidence/private/')) return true;
  if (p.startsWith('docs/registration/private/')) return true;
  return false;
});

const highConfidencePatterns = [
  ['openai-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

const genericSecretLiteral = /\b(OPENAI_API_KEY|CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\b\s*[:=]\s*['"]([^'"]{16,})['"]/g;
const dummyLiteral = /^(?:test|example|placeholder|dummy|fake)[-_]/i;
const syntheticSecretMarkers = [
  'test-secret',
  'never-log',
  'do-not-leak',
  'dummy',
  'placeholder',
  'example',
];

function isSyntheticSecret(value) {
  const normalized = String(value ?? '').toLowerCase();
  return syntheticSecretMarkers.some((marker) => normalized.includes(marker));
}

const currentSecretFindings = [];
for (const file of files) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
  const buffer = fs.readFileSync(file);
  if (!isText(buffer)) continue;
  const text = buffer.toString('utf8');
  for (const [name, pattern] of highConfidencePatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (!isSyntheticSecret(match[0])) {
        currentSecretFindings.push({ file: normalize(file), pattern: name });
      }
    }
  }
  genericSecretLiteral.lastIndex = 0;
  for (const match of text.matchAll(genericSecretLiteral)) {
    if (!dummyLiteral.test(match[2])) currentSecretFindings.push({ file: normalize(file), pattern: 'secret-literal-assignment' });
  }
}

let historyText = '';
try {
  historyText = execFileSync(
    'git',
    ['log', '-p', '--all', '--no-ext-diff', '--format=commit:%H'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
} catch {
  historyText = '';
}
const historySecretPatterns = [];
for (const [name, pattern] of highConfidencePatterns) {
  pattern.lastIndex = 0;
  let realFinding = false;
  for (const match of historyText.matchAll(pattern)) {
    if (!isSyntheticSecret(match[0])) {
      realFinding = true;
      break;
    }
  }
  if (realFinding) historySecretPatterns.push(name);
}

const gitignore = fs.readFileSync('.gitignore', 'utf8');
const gitignoreChecks = [
  '.env',
  '.env.*',
  '.dev.vars*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  'private/',
  'docs/legal/evidence/private/',
  'docs/registration/private/',
].every((entry) => gitignore.includes(entry));

if (!fs.existsSync(distDir)) throw new Error('dist/ missing. Run npm run build:hosting before DAI-074 audit.');
const distFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else distFiles.push(full);
  }
}
walk(distDir);

const distForbiddenFindings = [];
const distForbiddenTerms = [
  ['openai-secret-name', 'OPENAI_API_KEY'],
  ['openai-endpoint', 'api.openai.com/v1/responses'],
  ['authorization-header', 'authorization:'],
  ['bearer-header', 'Bearer '],
  ['private-key-marker', 'PRIVATE KEY-----'],
];
for (const file of distFiles) {
  const buffer = fs.readFileSync(file);
  if (!isText(buffer)) continue;
  const text = buffer.toString('utf8');
  for (const [name, term] of distForbiddenTerms) {
    if (text.includes(term)) distForbiddenFindings.push({ file: normalize(path.relative(process.cwd(), file)), pattern: name });
  }
  for (const [name, pattern] of highConfidencePatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (!isSyntheticSecret(match[0])) {
        distForbiddenFindings.push({ file: normalize(path.relative(process.cwd(), file)), pattern: name });
      }
    }
  }
}

const prompt = 'DAI074 private request sentinel: move the treasure to goal.';
const context = {
  rooms: [
    { id: 'room-start', x: 0, z: 0, width: 8, depth: 8 },
    { id: 'room-goal', x: 12, z: 0, width: 8, depth: 8 },
  ],
  entities: [
    { id: 'treasure-1', type: 'treasure', roomId: 'room-start' },
    { id: 'goal-1', type: 'goal', roomId: 'room-goal' },
  ],
  corridors: [
    {
      id: 'corridor-1',
      fromRoomId: 'room-start',
      toRoomId: 'room-goal',
      width: 3,
      kind: 'manual',
      fromSide: 'east',
      toSide: 'west',
    },
  ],
};

const intentRequest = createOpenAIIntentRequest('Create a fair exploratory dungeon.');
const editRequest = createOpenAIEditCommandRequest(prompt, context);
const parsedEditInput = JSON.parse(editRequest.input);
const roomContextKeys = [...new Set(parsedEditInput.context.rooms.flatMap((room) => Object.keys(room)))].sort();
const entityContextKeys = [...new Set(parsedEditInput.context.entities.flatMap((entity) => Object.keys(entity)))].sort();
const corridorContextKeys = [...new Set(
  parsedEditInput.context.corridors.flatMap((corridor) => Object.keys(corridor)),
)].sort();
const naturalEditContextKeys = Object.keys(parsedEditInput.context).sort();

const secret = 'test-secret-do-not-leak';
const functionRequest = new Request('https://example.pages.dev/api/natural-edit', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt, context }),
});
const functionResponse = await handleNaturalEditRequest(functionRequest, { OPENAI_API_KEY: secret }, {
  createTransport: () => async () => ({ ok: true }),
  generate: async () => ({
    ok: true,
    command: { type: 'move-entity', entityId: 'treasure-1', roomId: 'room-goal' },
    meta: { provider: 'openai', model: 'test-model', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  }),
});
const functionResponseText = await functionResponse.text();

const generationPrompt = 'DAI074 private generation sentinel: fair exploratory dungeon.';
const designFunctionRequest = new Request('https://example.pages.dev/api/design-intent', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: generationPrompt }),
});
const designFunctionResponse = await handleDesignIntentRequest(designFunctionRequest, { OPENAI_API_KEY: secret }, {
  route: async () => ({
    status: 'success',
    selectedProvider: 'cloud',
    intent: { ...DEFAULT_DESIGN_INTENT, exploration: 0.8 },
    meta: { provider: 'openai', model: 'test-model', usage: null },
    attempts: [],
  }),
});
const designFunctionResponseText = await designFunctionResponse.text();

const functionSource = fs.readFileSync('functions/api/natural-edit.js', 'utf8');
const designFunctionSource = fs.readFileSync('functions/api/design-intent.js', 'utf8');
const editorSource = fs.readFileSync('apps/editor-slice/main.js', 'utf8');

const persistenceTerms = ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie'];
const persistenceFindings = [];
const productionSourcePrefixes = [
  'apps/editor-slice/',
  'packages/editor-core/',
  'packages/play-core/',
  'packages/renderer-three/',
  'packages/onboarding/',
];
for (const file of files.filter((file) => productionSourcePrefixes.some((prefix) => normalize(file).startsWith(prefix)))) {
  const buffer = fs.readFileSync(file);
  if (!isText(buffer)) continue;
  const text = buffer.toString('utf8');
  for (const term of persistenceTerms) {
    if (text.includes(term)) persistenceFindings.push({ file: normalize(file), term });
  }
}

const checks = {
  noForbiddenTrackedSecretPaths: forbiddenTrackedPaths.length === 0,
  noHighConfidenceCurrentSecrets: currentSecretFindings.length === 0,
  noHighConfidenceSecretsInGitPatchHistory: historySecretPatterns.length === 0,
  expectedSecretPathsIgnored: gitignoreChecks,
  browserDistContainsNoProviderSecretBoundary: distForbiddenFindings.length === 0,
  designIntentStoreFalse: intentRequest.store === false,
  naturalEditStoreFalse: editRequest.store === false,
  naturalEditInputShapeBounded:
    Object.keys(parsedEditInput).sort().join(',') === 'context,request' &&
    naturalEditContextKeys.join(',') === 'corridors,entities,rooms' &&
    roomContextKeys.join(',') === 'depth,id,width,x,z' &&
    entityContextKeys.join(',') === 'id,roomId,type' &&
    corridorContextKeys.join(',') ===
      'fromRoomId,fromSide,id,kind,toRoomId,toSide,width',
  functionResponseDoesNotEchoPrompt: !functionResponseText.includes(prompt),
  functionResponseDoesNotEchoSecret: !functionResponseText.includes(secret),
  functionResponseNoStore: functionResponse.headers.get('cache-control') === 'no-store',
  designIntentFunctionResponseDoesNotEchoPrompt: !designFunctionResponseText.includes(generationPrompt),
  designIntentFunctionResponseDoesNotEchoSecret: !designFunctionResponseText.includes(secret),
  designIntentFunctionResponseNoStore: designFunctionResponse.headers.get('cache-control') === 'no-store',
  functionSourceHasNoConsoleLogging:
    !/\bconsole\.(?:log|error|warn|info)\b/.test(functionSource) &&
    !/\bconsole\.(?:log|error|warn|info)\b/.test(designFunctionSource),
  browserHasNoPersistentStorageUse: persistenceFindings.length === 0,
  browserGenerationUsesPromptAndFixedSchemaFlag:
    editorSource.includes("window.__DAI_DESIGN_INTENT_ENDPOINT__ || '/api/design-intent'") &&
    editorSource.includes('body: JSON.stringify({ prompt, includeRoomRequests: true })'),
  browserNaturalEditUsesBoundedContext:
    editorSource.includes('body: JSON.stringify({ prompt, context: naturalEditContext() })') &&
    editorSource.includes('rooms: authoringSpec().rooms.map((room) => ({') &&
    editorSource.includes('id: room.id') &&
    editorSource.includes('x: room.x') &&
    editorSource.includes('z: room.z') &&
    editorSource.includes('width: room.width') &&
    editorSource.includes('depth: room.depth') &&
    editorSource.includes('entities: authoringSpec().entities.map((entity) => ({') &&
    editorSource.includes('id: entity.id') &&
    editorSource.includes('type: entity.type') &&
    editorSource.includes('roomId: entity.roomId') &&
    editorSource.includes('corridors: authoringSpec().corridors.map((corridor) => ({') &&
    editorSource.includes('id: corridor.id') &&
    editorSource.includes('fromRoomId: corridor.fromRoomId') &&
    editorSource.includes('toRoomId: corridor.toRoomId') &&
    editorSource.includes('width: corridor.width') &&
    editorSource.includes('kind: corridor.kind ?? null') &&
    editorSource.includes('fromSide: corridor.fromSide ?? null') &&
    editorSource.includes('toSide: corridor.toSide ?? null'),
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  checks,
  trackedFileCount: files.length,
  distFileCount: distFiles.length,
  forbiddenTrackedPaths,
  currentSecretFindings,
  historySecretPatterns,
  distForbiddenFindings,
  persistenceFindings,
  outboundNaturalEditContext: {
    topLevelKeys: Object.keys(parsedEditInput).sort(),
    contextKeys: naturalEditContextKeys,
    roomKeys: roomContextKeys,
    entityKeys: entityContextKeys,
    corridorKeys: corridorContextKeys,
  },
  privacyBoundary: {
    designIntentStore: intentRequest.store,
    naturalEditStore: editRequest.store,
    functionResponseCacheControl: functionResponse.headers.get('cache-control'),
    designIntentFunctionResponseCacheControl: designFunctionResponse.headers.get('cache-control'),
    fullPromptIncludedInEvidence: false,
    secretIncludedInEvidence: false,
  },
};

const serialized = JSON.stringify(evidence, null, 2);
if (serialized.includes(prompt) || serialized.includes(generationPrompt) || serialized.includes(secret)) {
  throw new Error('DAI-074 evidence unexpectedly contains private sentinel data.');
}
fs.writeFileSync(evidencePath, serialized + '\n');
console.log(serialized);
if (!passed) throw new Error(`DAI-074 secret/privacy invariant failed: ${JSON.stringify(checks)}`);
