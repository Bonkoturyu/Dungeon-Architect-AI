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

Write-Host 'Running DAI-033 supported event logic validation...'
npm run validate:event-logic
if ($LASTEXITCODE -ne 0) { throw 'DAI-033 event logic validation failed.' }

Write-Host ''
Write-Host 'DAI-033 validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/event-logic/dai-033-event-logic.json'
