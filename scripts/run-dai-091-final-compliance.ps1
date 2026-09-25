$ErrorActionPreference = 'Stop'

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $RepoRoot

Write-Host '[DAI-091] Installing exact reviewed dependencies...'
npm.cmd ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host '[DAI-091] Syntax gate...'
npm.cmd run validate:syntax
if ($LASTEXITCODE -ne 0) { throw 'syntax validation failed.' }

Write-Host '[DAI-091] Legal / provenance...'
npm.cmd run validate:legal-registers
if ($LASTEXITCODE -ne 0) { throw 'legal/provenance audit failed.' }

Write-Host '[DAI-091] Secret / privacy...'
npm.cmd run validate:secret-privacy
if ($LASTEXITCODE -ne 0) { throw 'secret/privacy audit failed.' }

Write-Host '[DAI-091] Judge-facing public docs...'
npm.cmd run validate:public-docs
if ($LASTEXITCODE -ne 0) { throw 'public-doc truthfulness audit failed.' }

Write-Host '[DAI-091] Submission metadata...'
npm.cmd run validate:submission-metadata
if ($LASTEXITCODE -ne 0) { throw 'submission metadata audit failed.' }

Write-Host '[DAI-091] Aggregate final compliance...'
node scripts/run-dai-091-final-compliance.mjs
if ($LASTEXITCODE -ne 0) { throw 'DAI-091 aggregate final compliance failed.' }

Write-Host '[DAI-091] Commit whitespace / conflict-marker check...'
git diff --check 027b0f3f6a5adc648dbff4cd00e28c0abe4778a3..HEAD
if ($LASTEXITCODE -ne 0) { throw 'git diff --check failed.' }

Write-Host ''
Write-Host '[DAI-091] FINAL COMPLIANCE PASSED.'
Write-Host 'Next: merge final docs/compliance only after repository visibility is Public, then revalidate deployed main.'
