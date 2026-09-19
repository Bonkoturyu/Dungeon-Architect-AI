$ErrorActionPreference = 'Stop'

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $RepoRoot

Write-Host 'Running DAI-083 submission metadata audit...'
npm run validate:submission-metadata
if ($LASTEXITCODE -ne 0) { throw 'DAI-083 submission metadata audit failed.' }

Write-Host 'Running public documentation audit after DAI-083 metadata finalization...'
npm run validate:public-docs
if ($LASTEXITCODE -ne 0) { throw 'DAI-080 public-doc audit failed after DAI-083.' }

Write-Host ''
Write-Host 'DAI-083 validation completed successfully.' -ForegroundColor Green
Write-Host 'Metadata evidence: artifacts/submission-metadata/dai-083-submission-metadata.json'
Write-Host 'Public-doc evidence: artifacts/public-docs/dai-080-public-docs.json'
