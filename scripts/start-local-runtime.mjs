import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export function findBrowser({ platform = process.platform, env = process.env, fileSystem = fs } = {}) {
  let candidates = [];
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    const programFiles = env.PROGRAMFILES;
    const programFilesX86 = env['PROGRAMFILES(X86)'];
    candidates = [
      local && path.win32.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      programFiles && path.win32.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      programFilesX86 && path.win32.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      programFiles && path.win32.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      programFilesX86 && path.win32.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
  } else if (platform === 'linux') {
    const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'];
    // 空の PATH 要素（作業ディレクトリ）は自動探索しない。
    const directories = [...new Set([...(env.PATH || '').split(':').filter((dir) => path.posix.isAbsolute(dir)), '/usr/bin', '/opt/google/chrome', '/snap/bin'])];
    candidates = directories.flatMap((dir) => names.map((name) => path.posix.join(dir, name)));
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (!fileSystem.statSync(candidate).isFile()) continue;
      if (platform === 'linux') fileSystem.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

export async function stopProcessTree(child, {
  platform = process.platform, kill = process.kill.bind(process), spawnSyncImpl = spawnSync,
  graceMs = 1500,
} = {}) {
  if (!child?.pid) return;
  const active = child.exitCode === null && child.signalCode == null;
  let timer;
  let onClose;
  const closed = active ? new Promise((resolve) => {
    onClose = resolve;
    child.once('close', onClose);
    timer = setTimeout(resolve, graceMs);
  }) : Promise.resolve();
  try {
    if (platform === 'win32') {
      if (active) {
        const result = spawnSyncImpl('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        if (result.error) throw result.error;
        if (result.status !== 0 && child.exitCode === null && child.signalCode == null) child.kill('SIGTERM');
      }
    } else {
      // detached で作成したこのランチャー専用グループだけを停止する。
      try { kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await closed;
    if (platform === 'linux') {
      // 親プロセスが先に終了しても、残った子孫を取り残さない。
      try { kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  } finally {
    clearTimeout(timer);
    if (onClose) child.removeListener('close', onClose);
  }
}

export async function runLocal({
  runtime = process, fileSystem = fs, spawnImpl = spawn, spawnSyncImpl = spawnSync,
  fetchImpl = fetch, logger = console, tempDir = os.tmpdir(), timeoutMs = 30_000, graceMs = 1500,
} = {}) {
  const host = '127.0.0.1';
  const port = 4173;
  const url = `http://${host}:${port}/apps/editor-slice/index.html`;
  const serverEntry = path.resolve(runtime.cwd(), 'node_modules/vite/bin/vite.js');
  const serverConfig = path.resolve(runtime.cwd(), 'scripts/start-local.config.mjs');
  if (!fileSystem.existsSync(serverEntry) || !fileSystem.existsSync(serverConfig)) {
    throw new Error('Local preview files are missing. Run npm ci first.');
  }
  const browserPath = findBrowser({ platform: runtime.platform, env: runtime.env, fileSystem });
  if (!browserPath) throw new Error('Chrome, Chromium or Edge was not found (Windows and Linux supported).');
  const profileDir = fileSystem.mkdtempSync(path.join(tempDir, 'dungeon-architect-ai-local-'));
  const controller = new AbortController();
  let server;
  let browser;
  let shuttingDown = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const stop = (child) => stopProcessTree(child, {
    platform: runtime.platform, kill: runtime.kill.bind(runtime), spawnSyncImpl, graceMs,
  });
  const cleanup = async (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    controller.abort();
    const results = await Promise.allSettled([stop(browser), stop(server)]);
    for (const result of results) {
      if (result.status === 'rejected') { logger.error(result.reason.message); code = 1; }
    }
    try { fileSystem.rmSync(profileDir, { recursive: true, force: true }); } catch (error) {
      logger.error(`Could not remove temporary browser profile: ${error.message}`);
      code = 1;
    }
    runtime.removeListener('SIGINT', onSignal);
    runtime.removeListener('SIGTERM', onSignal);
    resolveDone(code);
  };
  const fail = (error) => { logger.error(error instanceof Error ? error.message : String(error)); void cleanup(1); };
  const onSignal = () => { void cleanup(0); };
  runtime.once('SIGINT', onSignal);
  runtime.once('SIGTERM', onSignal);
  try {
    server = spawnImpl(runtime.execPath, [serverEntry, '--host', host, '--port', String(port), '--strictPort', '--config', serverConfig], {
      cwd: runtime.cwd(), stdio: 'inherit', windowsHide: true, detached: runtime.platform === 'linux',
    });
    server.once('error', fail);
    server.once('exit', (code) => { void cleanup(code ?? 1); });
    const deadline = Date.now() + timeoutMs;
    let ready = false;
    while (!shuttingDown && Date.now() < deadline) {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(Math.min(1000, Math.max(1, deadline - Date.now())))]) });
        if (response.ok) { ready = true; break; }
      } catch {}
      if (!shuttingDown) await delay(Math.min(200, Math.max(1, deadline - Date.now())), undefined, { signal: controller.signal });
    }
    if (!shuttingDown) {
      if (!ready) throw new Error('Local preview did not start.');
      browser = spawnImpl(browserPath, [`--app=${url}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check'], {
        stdio: 'ignore', windowsHide: false, detached: runtime.platform === 'linux',
      });
      browser.once('error', fail);
      browser.once('exit', (code, signal) => { void cleanup(code === 0 && !signal ? 0 : 1); });
      logger.log('\nDungeon Architect AI is open.\nClose the browser window to stop the local preview.');
    }
  } catch (error) {
    if (!shuttingDown) fail(error);
  }
  return done;
}
