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

Write-Host 'Running final DAI-082 video evidence audit...'
npm run validate:video-plan
if ($LASTEXITCODE -ne 0) { throw 'DAI-082 final video audit failed.' }

Write-Host 'Running public documentation revalidation after DAI-082 completion...'
npm run validate:public-docs
if ($LASTEXITCODE -ne 0) { throw 'DAI-080 public-doc revalidation after DAI-082 failed.' }

Write-Host ''
Write-Host 'DAI-082 finalization validation completed successfully.' -ForegroundColor Green
Write-Host 'Video evidence: artifacts/video/dai-082-video-plan.json'
Write-Host 'Public-doc evidence: artifacts/public-docs/dai-080-public-docs.json'
