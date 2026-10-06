import fs from 'node:fs';
import path from 'node:path';

// 現行の承認済みlockfile identity。過去のfreeze/evidenceは書き換えない。
export function readReviewedLockfileSha256(repoRoot = process.cwd()) {
  const manifestPath = path.join(repoRoot, 'docs/legal/evidence/REVIEWED_PACKAGE_LOCK.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.schemaVersion !== 1 || manifest.lockfile !== 'package-lock.json'
    || typeof manifest.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
    throw new Error('Invalid reviewed package-lock identity. Stop and re-review dependencies.');
  }
  return manifest.sha256;
}
