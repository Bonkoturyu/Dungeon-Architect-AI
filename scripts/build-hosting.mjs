import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const appRoot = path.join(repoRoot, 'apps', 'editor-slice');
const distDir = path.join(repoRoot, 'dist');
const fixtureSource = path.join(repoRoot, 'spec', 'dungeon', 'fixtures', 'minimal-valid-v1.json');
const fixtureTarget = path.join(distDir, 'spec', 'dungeon', 'fixtures', 'minimal-valid-v1.json');
const noticesSource = path.join(repoRoot, 'THIRD_PARTY_NOTICES.txt');
const noticesTarget = path.join(distDir, 'THIRD_PARTY_NOTICES.txt');
const buildInfoTarget = path.join(distDir, 'build-info.json');

function gitHead() {
  const fromPages = String(process.env.CF_PAGES_COMMIT_SHA || '').trim();
  if (/^[0-9a-f]{40}$/i.test(fromPages)) {
    return { commitSha: fromPages.toLowerCase(), source: 'CF_PAGES_COMMIT_SHA' };
  }

  const fromGitHub = String(process.env.GITHUB_SHA || '').trim();
  if (/^[0-9a-f]{40}$/i.test(fromGitHub)) {
    return { commitSha: fromGitHub.toLowerCase(), source: 'GITHUB_SHA' };
  }

  try {
    const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim().toLowerCase();
    if (/^[0-9a-f]{40}$/.test(commitSha)) {
      return { commitSha, source: 'git' };
    }
  } catch {}

  return { commitSha: null, source: 'unavailable' };
}

async function collectDistManifest(dir, { exclude = new Set() } = {}) {
  const entries = [];

  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;

      const relative = path.relative(dir, full).replaceAll('\\', '/');
      if (exclude.has(relative)) continue;
      const bytes = await fs.readFile(full);
      entries.push({
        path: relative,
        bytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }

  await walk(dir);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

function manifestSha256(entries) {
  const text = entries
    .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`)
    .join('');
  return crypto.createHash('sha256').update(text).digest('hex');
}

await build({
  root: appRoot,
  base: '/',
  build: {
    outDir: distDir,
    emptyOutDir: true,
  },
});

await fs.mkdir(path.dirname(fixtureTarget), { recursive: true });
await fs.copyFile(fixtureSource, fixtureTarget);
await fs.copyFile(noticesSource, noticesTarget);

const headers = [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  '',
  '/index.html',
  '  Cache-Control: no-store',
  '',
  '/spec/*',
  '  Cache-Control: public, max-age=300',
  '',
  '/THIRD_PARTY_NOTICES.txt',
  '  Cache-Control: public, max-age=300',
  '',
  '/build-info.json',
  '  Cache-Control: no-store',
  '',
].join('\n');
await fs.writeFile(path.join(distDir, '_headers'), headers, 'utf8');

const routes = {
  version: 1,
  include: ['/api/*'],
  exclude: [],
};
await fs.writeFile(path.join(distDir, '_routes.json'), `${JSON.stringify(routes, null, 2)}\n`, 'utf8');

const distManifestWithoutBuildInfo = await collectDistManifest(distDir, {
  exclude: new Set(['build-info.json']),
});
const runtimeBundleSha256 = manifestSha256(distManifestWithoutBuildInfo);
const source = gitHead();
const buildInfo = {
  schemaVersion: '1.0',
  commitSha: source.commitSha,
  commitSource: source.source,
  runtimeBundleSha256,
  generatedAt: new Date().toISOString(),
};
await fs.writeFile(buildInfoTarget, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

const required = [
  path.join(distDir, 'index.html'),
  fixtureTarget,
  noticesTarget,
  path.join(distDir, '_headers'),
  path.join(distDir, '_routes.json'),
  buildInfoTarget,
];
for (const target of required) {
  await fs.access(target);
}

console.log(JSON.stringify({
  ok: true,
  appRoot,
  distDir,
  fixtureTarget,
  noticesTarget,
  buildInfoTarget,
  buildInfo,
  routes,
  required: required.map((target) => path.relative(repoRoot, target).replaceAll('\\', '/')),
}, null, 2));
