$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
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

Write-Host 'Running the complete production Node test suite, including the Pages Function contract tests...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed.' }

Write-Host 'Building the production Cloudflare Pages static output...'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'DAI-072 hosting build failed.' }

Write-Host 'Running the built-output visible-Chrome hosting smoke...'
npm run smoke:hosting
if ($LASTEXITCODE -ne 0) { throw 'DAI-072 hosting smoke failed.' }

Write-Host ''
Write-Host 'DAI-072 repository-side hosting validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/hosting/dai-072-hosting.json'
Write-Host 'Screenshot: artifacts/hosting/dai-072-hosting.png'
Write-Host 'Next gate: create the Cloudflare Pages project, set OPENAI_API_KEY as a Secret, deploy, and verify the public pages.dev URL.'
