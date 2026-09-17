import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const appRoot = path.join(repoRoot, 'apps', 'editor-slice');
const distDir = path.join(repoRoot, 'dist');
const fixtureSource = path.join(repoRoot, 'spec', 'dungeon', 'fixtures', 'minimal-valid-v1.json');
const fixtureTarget = path.join(distDir, 'spec', 'dungeon', 'fixtures', 'minimal-valid-v1.json');

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
].join('\n');
await fs.writeFile(path.join(distDir, '_headers'), headers, 'utf8');

const routes = {
  version: 1,
  include: ['/api/*'],
  exclude: [],
};
await fs.writeFile(path.join(distDir, '_routes.json'), `${JSON.stringify(routes, null, 2)}\n`, 'utf8');

const required = [
  path.join(distDir, 'index.html'),
  fixtureTarget,
  path.join(distDir, '_headers'),
  path.join(distDir, '_routes.json'),
];
for (const target of required) {
  await fs.access(target);
}

console.log(JSON.stringify({
  ok: true,
  appRoot,
  distDir,
  fixtureTarget,
  routes,
  required: required.map((target) => path.relative(repoRoot, target).replaceAll('\\', '/')),
}, null, 2));
