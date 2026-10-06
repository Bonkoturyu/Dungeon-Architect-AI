$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = & (Join-Path $PSScriptRoot 'get-reviewed-lockfile-sha.ps1')
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'

Set-Location $RepoRoot

if (-not (Test-Path $LockPath)) {
    throw 'Audited package-lock.json is missing from the working tree.'
}

$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256. Stop and re-review dependencies."
}

Write-Host "Audited lockfile: $ActualLockSha256"
Write-Host 'Installing the exact reviewed Node dependency graph...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Running the complete production Node test suite...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed.' }

Write-Host 'Building the production hosting distribution including legal notices...'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'Production hosting build failed.' }

Write-Host 'Running the built-surface Chrome hosting smoke after legal notice integration...'
npm run smoke:hosting
if ($LASTEXITCODE -ne 0) { throw 'Built hosting smoke failed after legal integration.' }

Write-Host 'Running deterministic legal-register and distribution-composition audit...'
npm run validate:legal-registers
if ($LASTEXITCODE -ne 0) { throw 'DAI-073 legal-register validation failed.' }

Write-Host ''
Write-Host 'DAI-073 validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/legal/dai-073-legal-registers.json'
Write-Host 'Hosting regression evidence: artifacts/hosting/dai-072-hosting.json'
Write-Host 'Hosting regression screenshot: artifacts/hosting/dai-072-hosting.png'
