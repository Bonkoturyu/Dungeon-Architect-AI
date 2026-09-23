$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

$Branch = git branch --show-current
if ($Branch -ne 'main') {
    throw "DAI-099 public validation must run from main. Current branch: $Branch"
}

git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

$LocalHead = git rev-parse HEAD
$OriginMain = git rev-parse origin/main
if ($LocalHead -ne $OriginMain) {
    throw "Local main is not origin/main. Local: $LocalHead Remote: $OriginMain"
}

if (-not (Test-Path $LockPath)) { throw 'Tracked audited package-lock.json is missing.' }
$LockSha = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($LockSha -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $LockSha."
}

Write-Host "[DAI-099 PUBLIC] Candidate HEAD: $LocalHead"
Write-Host "[DAI-099 PUBLIC] Installing exact reviewed dependencies..."
npm.cmd ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host '[DAI-099 PUBLIC] Rebuilding local candidate fingerprint...'
npm.cmd run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'build:hosting failed.' }

npm.cmd run validate:refreshed-build-fingerprint
if ($LASTEXITCODE -ne 0) { throw 'local build fingerprint audit failed.' }

if (-not $env:DAI_PUBLIC_URL) {
    $env:DAI_PUBLIC_URL = 'https://dungeon-architect-ai.pages.dev/'
}

Write-Host "[DAI-099 PUBLIC] Testing $env:DAI_PUBLIC_URL"
npm.cmd run smoke:refreshed-public
if ($LASTEXITCODE -ne 0) { throw 'DAI-099 refreshed public E2E failed.' }

Write-Host '[DAI-099 PUBLIC] Re-running candidate legal/privacy/metadata gates on main...'
npm.cmd run validate:legal-registers
if ($LASTEXITCODE -ne 0) { throw 'legal/provenance audit failed.' }

npm.cmd run validate:secret-privacy
if ($LASTEXITCODE -ne 0) { throw 'secret/privacy audit failed.' }

npm.cmd run validate:submission-metadata
if ($LASTEXITCODE -ne 0) { throw 'submission metadata audit failed.' }

npm.cmd run validate:refreshed-video-plan
if ($LASTEXITCODE -ne 0) { throw 'refreshed video-plan audit failed.' }

Write-Host ''
Write-Host '[DAI-099 PUBLIC] REFRESHED PUBLIC E2E PASSED.'
Write-Host '[DAI-099 PUBLIC] Candidate legal/privacy/metadata/video-plan gates also passed.'
Write-Host 'Next: visually confirm the deployment, then run npm run demo:refreshed-video.'
