import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const coreSrc = path.join(repoRoot, 'packages/core/src');
const scenePlanPath = path.join(repoRoot, 'packages/renderer-three/src/scene-plan.js');

function collectFiles(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) result.push(...collectFiles(full));
    else result.push(full);
  }
  return result;
}

test('Core does not depend on Three.js or renderer-three', () => {
  for (const file of collectFiles(coreSrc)) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /(?:from|require\s*\()\s*['\"]three['\"]/, `${file} imports three`);
    assert.doesNotMatch(source, /renderer-three/, `${file} depends on renderer-three`);
  }
});

test('scene-plan stays renderer-independent', () => {
  const source = readFileSync(scenePlanPath, 'utf8');
  assert.doesNotMatch(source, /(?:from|require\s*\()\s*['\"]three['\"]/, 'scene-plan imports three');
});
