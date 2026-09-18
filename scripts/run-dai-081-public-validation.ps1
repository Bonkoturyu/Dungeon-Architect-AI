$ErrorActionPreference = 'Stop'

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $RepoRoot

if ([string]::IsNullOrWhiteSpace($env:DAI_PUBLIC_URL)) {
    throw 'DAI_PUBLIC_URL is required, for example https://your-project.pages.dev'
}

Write-Host "Validating public candidate: $env:DAI_PUBLIC_URL"
Write-Host 'Running DAI-081 live public HTTPS smoke...'
npm run smoke:hosted-demo-public
if ($LASTEXITCODE -ne 0) { throw 'DAI-081 public hosted-demo validation failed.' }

Write-Host ''
Write-Host 'DAI-081 public hosted-demo validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/hosting-public/dai-081-public.json'
Write-Host 'Screenshot: artifacts/hosting-public/dai-081-public.png'
