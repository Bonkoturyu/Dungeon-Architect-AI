import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import { findBrowser, runLocal, stopProcessTree } from '../../scripts/start-local-runtime.mjs';

function discoveryFs(files, denied = []) {
  return {
    statSync: (name) => ({ isFile: () => files.includes(name) }),
    accessSync: (name) => { if (denied.includes(name)) throw new Error('EACCES'); },
  };
}

test('Windows Chrome locations retain priority; every Chrome/Edge location works', () => {
  const env = { LOCALAPPDATA: 'C:\\Local', PROGRAMFILES: 'C:\\Programs', 'PROGRAMFILES(X86)': 'C:\\Programs86' };
  const candidates = [
    'C:\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Programs\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Programs86\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Programs\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Programs86\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (let index = 0; index < candidates.length; index++) {
    assert.equal(findBrowser({ platform: 'win32', env, fileSystem: discoveryFs(candidates.slice(index)) }), candidates[index]);
  }
  assert.equal(findBrowser({ platform: 'win32', env: {}, fileSystem: discoveryFs([]) }), null);
});

test('Linux discovers executable PATH browsers and distro Chromium; skips directories and nonexecutables', () => {
  const options = { platform: 'linux', env: { PATH: '/custom::relative:/usr/bin' } };
  assert.equal(findBrowser({ ...options, fileSystem: discoveryFs(['/custom/google-chrome', '/usr/bin/chromium']) }), '/custom/google-chrome');
  assert.equal(findBrowser({ ...options, fileSystem: discoveryFs(['/custom/google-chrome', '/usr/bin/chromium'], ['/custom/google-chrome']) }), '/usr/bin/chromium');
  assert.equal(findBrowser({ ...options, env: {}, fileSystem: discoveryFs(['/usr/bin/chromium']) }), '/usr/bin/chromium');
  assert.equal(findBrowser({ ...options, fileSystem: discoveryFs(['chromium', 'relative/chromium']) }), null);
  assert.equal(findBrowser({ platform: 'darwin', env: {}, fileSystem: discoveryFs(['/usr/bin/chromium']) }), null);
});

function harness(platform = 'linux', { browserError, serverError, browserThrow, serverThrow, ready = true, missingFiles = false, missingBrowser = false } = {}) {
  const runtime = new EventEmitter();
  Object.assign(runtime, { platform, env: platform === 'linux' ? { PATH: '/usr/bin' } : { PROGRAMFILES: 'C:\\Programs' }, cwd: () => '/repo', execPath: '/node' });
  const browserPath = platform === 'linux' ? '/usr/bin/chromium' : 'C:\\Programs\\Microsoft\\Edge\\Application\\msedge.exe';
  const calls = [], kills = [], removals = [], errors = [], children = [];
  const finish = (child, code = 0, signal = null) => {
    child.exitCode = code; child.signalCode = signal; child.emit('exit', code, signal); child.emit('close', code, signal);
  };
  runtime.kill = (pid, signal) => {
    kills.push([pid, signal]);
    const child = children.find((item) => item.pid === -pid);
    if (child?.exitCode === null) queueMicrotask(() => finish(child, null, signal));
  };
  const fileSystem = {
    ...discoveryFs(missingBrowser ? [] : [browserPath]), existsSync: () => !missingFiles,
    mkdtempSync: () => '/tmp/dai-test-profile', rmSync: (...args) => removals.push(args),
  };
  const spawnImpl = (...args) => {
    const isBrowser = calls.length === 1;
    calls.push(args);
    if ((isBrowser && browserThrow) || (!isBrowser && serverThrow)) throw new Error('spawn threw');
    const child = new EventEmitter();
    Object.assign(child, { pid: 100 + children.length, exitCode: null, signalCode: null, kill: (signal) => finish(child, null, signal) });
    children.push(child);
    if ((isBrowser && browserError) || (!isBrowser && serverError)) queueMicrotask(() => {
      child.pid = undefined;
      child.emit('error', new Error('spawn failed'));
      child.emit('close', -2, null);
    });
    return child;
  };
  const taskkills = [];
  const spawnSyncImpl = (...args) => {
    taskkills.push(args);
    const child = children.find((item) => String(item.pid) === args[1][1]);
    queueMicrotask(() => finish(child, 1));
    return { status: 0 };
  };
  const options = { runtime, fileSystem, spawnImpl, spawnSyncImpl, fetchImpl: async () => ({ ok: ready }), logger: { log() {}, error: (message) => errors.push(message) }, timeoutMs: 20, graceMs: 20 };
  return { options, runtime, calls, kills, removals, errors, children, finish, taskkills };
}

for (const platform of ['linux', 'win32']) {
  test(`${platform}: dedicated window, close stops server and removes profile`, async () => {
    const h = harness(platform);
    const done = runLocal(h.options);
    await nextTurn();
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0][2].detached, platform === 'linux');
    assert.ok(h.calls[0][1].includes('--strictPort'));
    assert.deepEqual(h.calls[1][1], ['--app=http://127.0.0.1:4173/apps/editor-slice/index.html', '--user-data-dir=/tmp/dai-test-profile', '--no-first-run', '--no-default-browser-check']);
    assert.equal(h.calls[1][2].windowsHide, false);
    assert.equal(h.calls[1][2].detached, platform === 'linux');
    h.finish(h.children[1]);
    assert.equal(await done, 0);
    assert.equal(h.removals.length, 1);
    assert.equal(h.runtime.listenerCount('SIGINT'), 0);
    if (platform === 'linux') assert.ok(h.kills.some(([pid, signal]) => pid === -100 && signal === 'SIGTERM'));
    else assert.deepEqual(h.taskkills[0], ['taskkill', ['/PID', '100', '/T', '/F'], { stdio: 'ignore', windowsHide: true }]);
  });

  test(`${platform}: signal stops both processes once`, async () => {
    const h = harness(platform);
    const done = runLocal(h.options);
    await nextTurn();
    h.runtime.emit('SIGINT'); h.runtime.emit('SIGTERM');
    assert.equal(await done, 0);
    assert.equal(h.removals.length, 1);
    if (platform === 'win32') assert.equal(h.taskkills.length, 2);
    else assert.deepEqual(h.kills.filter(([, signal]) => signal === 'SIGTERM').map(([pid]) => pid).sort((a, b) => a - b), [-101, -100]);
  });

  for (const failure of ['serverError', 'browserError', 'serverThrow', 'browserThrow']) {
    test(`${platform}: ${failure} reports failure and cleans up`, async () => {
      const h = harness(platform, { [failure]: true });
      assert.equal(await runLocal(h.options), 1);
      assert.equal(h.removals.length, 1);
      assert.ok(h.errors.some((message) => message.includes('spawn')));
    });
  }
}

test('readiness timeout never launches browser and cleans up', async () => {
  const h = harness('linux', { ready: false });
  assert.equal(await runLocal(h.options), 1);
  assert.equal(h.calls.length, 1);
  assert.match(h.errors[0], /did not start/);
  assert.equal(h.removals.length, 1);
});

test('server exits during readiness: no late browser launch', async () => {
  const h = harness();
  h.options.fetchImpl = async () => { h.finish(h.children[0], 1); return { ok: true }; };
  assert.equal(await runLocal(h.options), 1);
  assert.equal(h.calls.length, 1);
});

test('browser abnormal exit is unsuccessful', async () => {
  const h = harness();
  const done = runLocal(h.options);
  await nextTurn(); h.finish(h.children[1], 1);
  assert.equal(await done, 1);
});

test('missing prerequisites do not start processes or allocate a profile', async () => {
  for (const option of ['missingFiles', 'missingBrowser']) {
    const h = harness('linux', { [option]: true });
    await assert.rejects(runLocal(h.options));
    assert.equal(h.calls.length, 0);
    assert.equal(h.removals.length, 0);
  }
});

test('Linux group cleanup escalates after grace timeout and tolerates exited groups', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 42, exitCode: null, signalCode: null });
  const kills = [];
  await stopProcessTree(child, { platform: 'linux', graceMs: 1, kill: (...args) => kills.push(args) });
  assert.deepEqual(kills, [[-42, 'SIGTERM'], [-42, 'SIGKILL']]);
  await stopProcessTree({ pid: 42, exitCode: 0 }, { platform: 'linux', kill: () => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); } });
  await assert.rejects(stopProcessTree({ pid: 42, exitCode: 0 }, { platform: 'linux', kill: () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); } }), /denied/);
});

test('Windows taskkill failure falls back to child termination; spawn errors surface', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 42, exitCode: null, signalCode: null });
  let killed;
  child.kill = (signal) => { killed = signal; child.emit('close'); };
  await stopProcessTree(child, { platform: 'win32', spawnSyncImpl: () => ({ status: 1 }), graceMs: 1 });
  assert.equal(killed, 'SIGTERM');
  await assert.rejects(stopProcessTree(child, { platform: 'win32', spawnSyncImpl: () => ({ error: new Error('taskkill missing') }), graceMs: 1 }), /taskkill missing/);
});
