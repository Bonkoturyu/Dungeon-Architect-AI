$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = & (Join-Path $PSScriptRoot 'get-reviewed-lockfile-sha.ps1')
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

Write-Host 'Building production hosting output...'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'production hosting build failed.' }

Write-Host 'Running integrated DESCRIBE -> GENERATE -> EDIT -> START -> PLAY smoke...'
npm run smoke:generation-surface
if ($LASTEXITCODE -ne 0) { throw 'DAI-081 generation surface smoke failed.' }

Write-Host 'Running built-surface hosting regression smoke...'
npm run smoke:hosting
if ($LASTEXITCODE -ne 0) { throw 'hosting regression smoke failed.' }

Write-Host ''
Write-Host 'DAI-081 generation-surface validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/generation-surface/dai-081-generation-surface.json'
Write-Host 'Screenshot: artifacts/generation-surface/dai-081-generation-surface.png'
Write-Host 'DAI-081 remains IN PROGRESS until the merged main candidate is deployed and passes the public HTTPS smoke.'
