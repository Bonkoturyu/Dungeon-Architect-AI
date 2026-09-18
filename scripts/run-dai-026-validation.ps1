$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

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

Write-Host 'Running DAI-026 visible-Chrome orthogonal corridor regression...'
npm run smoke:orthogonal-corridors
if ($LASTEXITCODE -ne 0) { throw 'DAI-026 orthogonal corridor smoke failed.' }

Write-Host ''
Write-Host 'DAI-026 validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/orthogonal-corridors/dai-026-orthogonal-corridors.json'
Write-Host 'Screenshot: artifacts/orthogonal-corridors/dai-026-orthogonal-corridors.png'
