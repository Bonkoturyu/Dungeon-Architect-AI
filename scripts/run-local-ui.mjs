import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = path.join(repoRoot, 'dist');
const host = '127.0.0.1';
const port = Number.parseInt(process.env.DAI_LOCAL_UI_PORT ?? '8000', 10);
const upstreamBase = process.env.DAI_LOCAL_API_BASE ?? 'https://dungeon-architect-ai.pages.dev';

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

async function readBody(req, limit = 128 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyApi(req, res, pathname) {
  if (!['/api/design-intent', '/api/natural-edit'].includes(pathname)) {
    send(res, 404, JSON.stringify({ ok: false, error: { code: 'API_ROUTE_NOT_FOUND' } }), {
      'content-type': 'application/json; charset=utf-8',
    });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    send(res, 413, JSON.stringify({ ok: false, error: { code: 'REQUEST_TOO_LARGE' } }), {
      'content-type': 'application/json; charset=utf-8',
    });
    return;
  }

  try {
    const upstream = await fetch(new URL(pathname, upstreamBase), {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] ?? 'application/json',
      },
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body,
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    send(res, upstream.status, responseBody, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    });
  } catch (error) {
    send(res, 502, JSON.stringify({
      ok: false,
      error: {
        code: 'LOCAL_API_PROXY_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }), {
      'content-type': 'application/json; charset=utf-8',
    });
  }
}

async function serveStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
    send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
    return;
  }

  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  try {
    relative = decodeURIComponent(relative);
  } catch {
    send(res, 400, 'Bad Request');
    return;
  }

  const resolved = path.resolve(distRoot, relative);
  if (resolved !== distRoot && !resolved.startsWith(distRoot + path.sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  let filePath = resolved;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const data = await fs.readFile(filePath);
    const type = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      send(res, 404, 'Not Found');
      return;
    }
    send(res, 500, 'Local server error');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  if (url.pathname.startsWith('/api/')) {
    await proxyApi(req, res, url.pathname);
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(port, host, () => {
  console.log('');
  console.log('Dungeon Architect AI - Local UI');
  console.log('--------------------------------');
  console.log(`UI:       http://${host}:${port}/`);
  console.log(`API proxy: ${upstreamBase}/api/*`);
  console.log('');
  console.log('Keep this window open while checking the UI.');
  console.log('Close this window when you are finished.');
});

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
