$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

Write-Host 'Refreshing Git refs...'
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

if (-not (Test-Path $LockPath)) { throw 'Audited package-lock.json is missing.' }
$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256."
}

Write-Host "Audited lockfile: $ActualLockSha256"
Write-Host 'Installing exact reviewed dependencies...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Running complete production Node suite...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed.' }

Write-Host 'Building production hosting output...'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'production hosting build failed.' }

Write-Host 'Validating frozen candidate / rollback ref / build manifest...'
node scripts/run-dai-084-candidate-freeze-audit.mjs
if ($LASTEXITCODE -ne 0) { throw 'DAI-084 candidate-freeze audit failed.' }

Write-Host ''
Write-Host 'DAI-084 candidate-freeze validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/candidate-freeze/dai-084-candidate-freeze.json'
Write-Host 'Dist manifest: artifacts/candidate-freeze/dai-084-dist-manifest.txt'
