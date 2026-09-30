import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts', 'legal');
const expectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc';

const creativeExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
  '.glb', '.gltf', '.fbx', '.obj',
  '.wav', '.mp3', '.ogg', '.flac',
  '.ttf', '.otf', '.woff', '.woff2',
]);

const excludedDirectories = new Set([
  '.git', 'node_modules', 'dist', 'artifacts', 'build', 'coverage',
  '.tmp', '.cache', '.browser-cache', 'Library', 'Temp', 'Logs', 'obj', 'UserSettings',
]);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walk(relativeDir = '.') {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const relativePath = path.normalize(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) files.push(...walk(relativePath));
    else if (entry.isFile()) files.push(relativePath.replaceAll('\\', '/'));
  }
  return files;
}

function extractImports(source) {
  const imports = [];
  const staticDeclaration =
    /^[ \t]*(?:import|export)[ \t]+(?:(?:[A-Za-z0-9_$*{}, \t\r\n]+?)[ \t]+from[ \t]+)?['"]([^'"\r\n]+)['"][ \t]*;?/gm;

  let match;
  while ((match = staticDeclaration.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

const importParserFixture = [
  "import three from 'three';",
  "import { value } from './local.js';",
  "export { other } from './other.js';",
  "const message = \"after propagating from ' + index\";",
  "const provider = 'import';",
].join('\n');

const importParserFixtureResult =
  extractImports(importParserFixture);

function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(repoRoot, path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(repoRoot, candidate).replaceAll('\\', '/');
    }
  }
  throw new Error(`Unable to resolve production local import ${specifier} from ${fromFile}`);
}

function collectProductionImports(entryFiles) {
  const queue = [...entryFiles];
  const visited = new Set();
  const external = new Set();

  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const source = read(file);
    for (const specifier of extractImports(source)) {
      const local = resolveLocalImport(file, specifier);
      if (local) {
        if (!visited.has(local)) queue.push(local);
      } else if (!specifier.startsWith('/') && !specifier.startsWith('node:')) {
        external.add(specifier.split('/')[0].startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0]);
      }
    }
  }

  return {
    files: [...visited].sort(),
    external: [...external].sort(),
  };
}

fs.mkdirSync(outputDir, { recursive: true });

const allRepoFiles = walk('.');
const creativeCandidates = allRepoFiles
  .filter((file) => creativeExtensions.has(path.extname(file).toLowerCase()))
  .sort();

const productionImports = collectProductionImports([
  'apps/editor-slice/main.js',
  'apps/editor-slice/onboarding.js',
]);

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const rootLock = packageLock.packages?.[''] ?? {};
const expectedTopLevel = {
  '@babylonjs/core': '9.18.0',
  'playwright-core': '1.62.0',
  'three': '0.185.1',
  'vite': '8.1.5',
};

const dependencyVersionsExact = Object.entries(expectedTopLevel).every(([name, version]) =>
  packageJson.devDependencies?.[name] === version && rootLock.devDependencies?.[name] === version);

const rootNoticesPath = path.join(repoRoot, 'THIRD_PARTY_NOTICES.txt');
const distNoticesPath = path.join(repoRoot, 'dist', 'THIRD_PARTY_NOTICES.txt');
const aiUsage = read('docs/legal/AI_USAGE.md');
const dependencies = read('docs/legal/THIRD_PARTY_DEPENDENCIES.md');
const assets = read('docs/legal/THIRD_PARTY_ASSETS.md');
const services = read('docs/legal/THIRD_PARTY_SERVICES.md');
const notice = read('NOTICE');
const thirdPartyNotices = read('THIRD_PARTY_NOTICES.txt');

const checks = {
  auditedLockfileUnchanged: sha256(path.join(repoRoot, 'package-lock.json')) === expectedLockSha256,
  dependencyVersionsExact,
  importParserRejectsStringContent:
    JSON.stringify(importParserFixtureResult) ===
      JSON.stringify(['three', './local.js', './other.js']),
  productionRuntimeExternalImportsOnlyThree:
    JSON.stringify(productionImports.external) === JSON.stringify(['three']),
  noCreativeAssetFilesDetected: creativeCandidates.length === 0,
  aiDevelopmentUsageRecorded:
    aiUsage.includes('PROD-AI-DEV-001') && aiUsage.includes('GPT-5.6 Sol'),
  aiRuntimeUsageRecorded:
    aiUsage.includes('PROD-AI-RUN-001') && aiUsage.includes('gpt-5.6-luna'),
  runtimeDependencyRecorded:
    dependencies.includes('PROD-DEP-001') && dependencies.includes('three') && dependencies.includes('0.185.1'),
  buildAndBenchmarkDependencyScopesRecorded:
    dependencies.includes('PROD-DEP-002') && dependencies.includes('PROD-DEP-003') &&
    dependencies.includes('PROD-DEP-004') && dependencies.includes('PROD-DEP-005'),
  zeroExternalCreativeAssetsRecorded:
    assets.includes('No third-party creative assets are included') && assets.includes('no AI-generated'),
  productionServicesRecorded:
    services.includes('PROD-SVC-001') && services.includes('Cloudflare Pages') &&
    services.includes('PROD-SVC-002') && services.includes('OpenAI Responses API'),
  noticeReferencesDistributionNotices:
    notice.includes('THIRD_PARTY_NOTICES.txt') && notice.includes('docs/legal/'),
  threeMitNoticePresent:
    thirdPartyNotices.includes('three.js 0.185.1 / r185') &&
    thirdPartyNotices.includes('Copyright © 2010-2026 three.js authors') &&
    thirdPartyNotices.includes('The MIT License'),
  distributionNoticeCopied:
    fs.existsSync(distNoticesPath) && fs.readFileSync(rootNoticesPath).equals(fs.readFileSync(distNoticesPath)),
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  checks,
  packageLockSha256: sha256(path.join(repoRoot, 'package-lock.json')),
  thirdPartyNoticesSha256: sha256(rootNoticesPath),
  distributionNoticesSha256: fs.existsSync(distNoticesPath) ? sha256(distNoticesPath) : null,
  productionImportClosure: productionImports,
  creativeAssetCandidates: creativeCandidates,
  exactTopLevelDependencies: expectedTopLevel,
};

const evidencePath = path.join(outputDir, 'dai-073-legal-registers.json');
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));

if (!passed) {
  throw new Error(`DAI-073 legal register invariant failed: ${JSON.stringify(checks)}`);
}
