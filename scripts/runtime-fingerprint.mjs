import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Functionsの依存も含める。indexではなく実worktreeを読み、source textの改行だけOS間で正規化する。
export const runtimeSourcePathspecs = [
  'apps/editor-slice', 'functions', ':(glob)packages/**/src/**',
  'spec/dungeon/fixtures/minimal-valid-v1.json', 'THIRD_PARTY_NOTICES.txt',
  'package.json', 'package-lock.json', 'scripts/build-hosting.mjs',
  'scripts/runtime-fingerprint.mjs',
];

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function manifestSha256(entries) {
  return sha256(entries.map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`).join(''));
}

function canonicalSourceBytes(relativePath, bytes) {
  // 監査済みlockfileは.gitattributesの-text指定どおりraw bytesを維持する。
  if (relativePath === 'package-lock.json' || !/\.(?:[cm]?js|json|html|css|txt)$/i.test(relativePath)) return bytes;
  // UTF-8 decode/re-encodeは行わず、改行以外のbyteをそのまま保持する。
  const normalized = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 13) {
      normalized.push(10);
      if (bytes[index + 1] === 10) index += 1;
    } else normalized.push(bytes[index]);
  }
  return Buffer.from(normalized);
}

export function runtimeSourceFingerprint(repoRoot) {
  const paths = execFileSync('git', [
    'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...runtimeSourcePathspecs,
  ], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
  if (paths.length === 0) throw new Error('Runtime source inventory is empty.');
  const entries = [...new Set(paths)].sort().map((relative) => {
    const bytes = canonicalSourceBytes(relative, fs.readFileSync(path.join(repoRoot, relative)));
    return { path: relative, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return manifestSha256(entries);
}

function canonicalFingerprintPath(relativePath) {
  return relativePath.replace(/^assets\/index-[^/]+\.(js|css)$/i,
    (_match, extension) => `assets/index.${extension.toLowerCase()}`);
}

function canonicalFingerprintBytes(relativePath, bytes) {
  const textLike = relativePath === '_headers' || relativePath === '_routes.json'
    || /\.(?:html|css|js|json|txt)$/i.test(relativePath);
  if (!textLike) return bytes;
  let text = bytes.toString('utf8').replace(/\r\n?/g, '\n');
  if (relativePath === 'index.html') text = text.replace(/\/assets\/index-[^"'\s>]+\.(js|css)/gi,
    (_match, extension) => `/assets/index.${extension.toLowerCase()}`);
  return Buffer.from(text, 'utf8');
}

export function collectBundleManifest(dir) {
  const entries = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      const relative = path.relative(dir, full).replaceAll('\\', '/');
      if (relative === 'build-info.json') continue;
      const bytes = canonicalFingerprintBytes(relative, fs.readFileSync(full));
      entries.push({ path: canonicalFingerprintPath(relative), bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  walk(dir);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
