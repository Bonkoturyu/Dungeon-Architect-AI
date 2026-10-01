import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const host = '127.0.0.1';
const port = 4173;
const url = `http://${host}:${port}/apps/editor-slice/index.html`;
const serverEntry = path.resolve('node_modules/vite/bin/vite.js');
const serverConfig = path.resolve('scripts/start-local.config.mjs');

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findBrowser() {
  if (process.platform !== 'win32') return null;

  const local = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];

  return firstExistingPath([
    local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    programFiles && path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    programFilesX86 && path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    programFiles && path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    programFilesX86 && path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]);
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Local preview did not start.');
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return;

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  child.kill('SIGTERM');
}

if (!fs.existsSync(serverEntry) || !fs.existsSync(serverConfig)) {
  throw new Error('Local preview files are missing. Run npm install and git pull first.');
}

const browserPath = findBrowser();
if (!browserPath) {
  throw new Error('Chrome or Edge was not found.');
}

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dungeon-architect-ai-local-'));

const server = spawn(process.execPath, [
  serverEntry,
  '--host',
  host,
  '--port',
  String(port),
  '--strictPort',
  '--config',
  serverConfig,
], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
});

let browser = null;
let shuttingDown = false;

function cleanup(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  stopProcessTree(browser);
  stopProcessTree(server);

  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  process.exit(exitCode);
}

server.once('exit', (code) => {
  if (!shuttingDown) cleanup(code ?? 1);
});

process.once('SIGINT', () => cleanup(0));
process.once('SIGTERM', () => cleanup(0));

try {
  await waitForServer();

  browser = spawn(browserPath, [
    `--app=${url}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], {
    stdio: 'ignore',
    windowsHide: false,
  });

  browser.once('exit', () => cleanup(0));

  console.log('');
  console.log('Dungeon Architect AI is open.');
  console.log('Close the browser window to stop the local preview.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  cleanup(1);
}
