import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createOpenAIHttpTransport } from '../packages/cloud-intent/src/openai-http-transport.js';
import {
  DEFAULT_CLOUD_EDIT_MODEL,
  generateOpenAIEditCommand,
} from '../packages/cloud-intent/src/openai-edit-command-adapter.js';

const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for DAI-053 live natural-edit validation.');

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const vitePort = Number(process.env.DAI_NATURAL_EDIT_VITE_PORT || '4180');
const backendPort = Number(process.env.DAI_NATURAL_EDIT_BACKEND_PORT || '4181');
const outputDir = path.resolve('artifacts/natural-edit');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const editorUrl = `http://127.0.0.1:${vitePort}/apps/editor-slice/index.html`;
const backendUrl = `http://127.0.0.1:${backendPort}/api/natural-edit`;
const testPrompt = 'Move the treasure to the room that contains the goal.';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed. Run npm ci using the reviewed dependency graph first.');
fs.mkdirSync(outputDir, { recursive: true });

const transport = createOpenAIHttpTransport({ apiKey });
const providerCalls = [];

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('request body exceeds limit'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

const allowedOrigin = `http://127.0.0.1:${vitePort}`;
const backend = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {}, allowedOrigin);
    return;
  }
  if (request.method !== 'POST' || request.url !== '/api/natural-edit') {
    sendJson(response, 404, { ok: false, error: { code: 'NOT_FOUND' } }, allowedOrigin);
    return;
  }

  const started = performance.now();
  try {
    const body = await readJsonBody(request);
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const context = body?.context;
    const result = await generateOpenAIEditCommand(prompt, context, {
      transport,
      model: DEFAULT_CLOUD_EDIT_MODEL,
      reasoningEffort: 'low',
      maxOutputTokens: 512,
    });
    const durationMs = performance.now() - started;

    providerCalls.push({
      ok: result.ok === true,
      durationMs,
      model: result.ok ? result.meta.model : DEFAULT_CLOUD_EDIT_MODEL,
      usage: result.ok ? result.meta.usage : null,
      errorCode: result.ok ? null : result.error.code,
    });

    if (!result.ok) {
      sendJson(response, 422, { ok: false, error: { code: result.error.code } }, allowedOrigin);
      return;
    }

    sendJson(response, 200, {
      ok: true,
      command: result.command,
      meta: { provider: result.meta.provider, model: result.meta.model, usage: result.meta.usage },
    }, allowedOrigin);
  } catch {
    sendJson(response, 400, { ok: false, error: { code: 'REQUEST_INVALID' } }, allowedOrigin);
  }
});

await new Promise((resolve, reject) => {
  backend.once('error', reject);
  backend.listen(backendPort, '127.0.0.1', resolve);
});

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteOutput = '';
vite.stdout.on('data', (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on('data', (chunk) => { viteOutput += chunk.toString(); });

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite natural-edit server did not become ready.\n${viteOutput}`);
}

function entityRoom(state, id) {
  return state.entities.find((entity) => entity.id === id)?.roomId ?? null;
}

let browser;
try {
  await waitForServer(editorUrl);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((endpoint) => {
    window.__DAI_NATURAL_EDIT_ENDPOINT__ = endpoint;
  }, backendUrl);

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  await page.goto(editorUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true, null, { timeout: 60_000 });
  const startup = await page.evaluate(() => ({
    failed: window.__DAI_EDITOR_SLICE__.failed,
    message: window.__DAI_EDITOR_SLICE__.message ?? null,
    state: window.__DAI_EDITOR_SLICE__.getState?.() ?? null,
  }));
  if (startup.failed) throw new Error(startup.message || 'editor slice startup failed');

  const initialRoom = entityRoom(startup.state, 'treasure-1');
  if (initialRoom !== 'room-middle') throw new Error(`unexpected treasure start room: ${initialRoom}`);

  await page.fill('#naturalEditInput', testPrompt);
  await page.click('#applyNaturalEdit');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.naturalEditBusy === false && state.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-goal';
  }, null, { timeout: 60_000 });
  const afterNaturalEdit = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#undo');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-middle');
  const afterUndo = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#redo');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-goal');
  const afterRedo = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const result = {
    initialTreasureRoom: initialRoom,
    translatedCommand: afterNaturalEdit.lastNaturalEditCommand,
    treasureMovedToGoal: entityRoom(afterNaturalEdit, 'treasure-1') === 'room-goal',
    selectedEntityAfterEdit: afterNaturalEdit.selectedEntityId === 'treasure-1',
    selectedRoomAfterEdit: afterNaturalEdit.selectedRoomId === 'room-goal',
    undoReturnedTreasure: entityRoom(afterUndo, 'treasure-1') === 'room-middle',
    redoReturnedTreasureToGoal: entityRoom(afterRedo, 'treasure-1') === 'room-goal',
    providerCallCount: providerCalls.length,
  };

  const passed =
    result.treasureMovedToGoal &&
    result.selectedEntityAfterEdit &&
    result.selectedRoomAfterEdit &&
    result.undoReturnedTreasure &&
    result.redoReturnedTreasureToGoal &&
    result.providerCallCount === 1 &&
    result.translatedCommand?.type === 'move-entity' &&
    result.translatedCommand?.entityId === 'treasure-1' &&
    result.translatedCommand?.roomId === 'room-goal';

  const screenshotPath = path.join(outputDir, 'dai-053-natural-edit.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    chromePath,
    editorUrl,
    model: DEFAULT_CLOUD_EDIT_MODEL,
    liveProviderCallMade: providerCalls.length > 0,
    passed,
    result,
    providerCalls,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    safety: { apiKeyLeak: false, fullPromptLeak: false },
  };

  let serialized = JSON.stringify(evidence, null, 2);
  evidence.safety.apiKeyLeak = serialized.includes(apiKey);
  evidence.safety.fullPromptLeak = serialized.includes(testPrompt);
  serialized = JSON.stringify(evidence, null, 2);

  const evidencePath = path.join(outputDir, 'dai-053-natural-edit.json');
  fs.writeFileSync(evidencePath, serialized);

  if (!passed) throw new Error(`natural-edit smoke invariant failed: ${JSON.stringify(result)}`);
  if (evidence.safety.apiKeyLeak || evidence.safety.fullPromptLeak) throw new Error('natural-edit evidence leaked secret or full prompt');
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`natural-edit smoke emitted errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
  await new Promise((resolve) => backend.close(resolve));
}
