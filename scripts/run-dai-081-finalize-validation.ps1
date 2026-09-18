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

Write-Host 'Building production hosting output for post-integration audits...'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'production hosting build failed.' }

Write-Host 'Re-running DAI-074 secret/privacy audit including /api/design-intent...'
npm run validate:secret-privacy
if ($LASTEXITCODE -ne 0) { throw 'DAI-074 post-integration privacy audit failed.' }

Write-Host 'Re-running DAI-080 public documentation audit for the live hosted candidate...'
npm run validate:public-docs
if ($LASTEXITCODE -ne 0) { throw 'DAI-080 post-integration public-doc audit failed.' }

Write-Host ''
Write-Host 'DAI-081 governance finalization validation completed successfully.' -ForegroundColor Green
Write-Host 'Privacy evidence: artifacts/privacy/dai-074-secret-privacy.json'
Write-Host 'Public-doc evidence: artifacts/public-docs/dai-080-public-docs.json'
