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

if (-not $env:CHROME_PATH) {
    $chromeCandidates = @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
    )
    foreach ($candidate in $chromeCandidates) {
        if (Test-Path $candidate) {
            $env:CHROME_PATH = $candidate
            break
        }
    }
}

if (-not $env:CHROME_PATH -or -not (Test-Path $env:CHROME_PATH)) {
    throw 'Chrome not found. Set CHROME_PATH to chrome.exe.'
}

Write-Host "Audited lockfile: $ActualLockSha256"
Write-Host "Chrome: $env:CHROME_PATH"

Write-Host 'Installing the exact reviewed Node dependency graph...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Running production test suite...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed.' }

Write-Host 'Running DAI-016 visible Chrome START-to-Result smoke test...'
npm run smoke:play-slice
if ($LASTEXITCODE -ne 0) { throw 'play smoke test failed.' }

Write-Host ''
Write-Host 'DAI-016 validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/play-smoke/dai-016-play-smoke.json'
Write-Host 'Screenshot: artifacts/play-smoke/dai-016-play-smoke.png'
