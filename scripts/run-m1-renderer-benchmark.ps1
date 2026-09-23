$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

Write-Host '== Dungeon Architect AI / M1 Renderer Benchmark =='
Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"

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
    throw 'Chrome was not found. Set CHROME_PATH to chrome.exe.'
}

Write-Host "Chrome: $env:CHROME_PATH"

if (-not (Test-Path $LockPath)) {
    throw 'Tracked audited package-lock.json is missing.'
}

$TrackedLock = git ls-files --error-unmatch package-lock.json 2>$null
if ($LASTEXITCODE -ne 0 -or $TrackedLock -ne 'package-lock.json') {
    throw 'package-lock.json must be tracked by Git before benchmark evidence is accepted.'
}

$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256."
}

Write-Host "Audited lockfile: $ActualLockSha256"
Write-Host 'Installing exact approved benchmark dependencies (install scripts disabled)...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Resolved top-level dependencies:'
npm ls --depth=0
if ($LASTEXITCODE -ne 0) { throw 'npm ls failed.' }

Write-Host 'Running production tests...'
npm test

if (-not $env:DAI_BENCH_RUNS) {
    $env:DAI_BENCH_RUNS = '5'
}

Write-Host "Running renderer benchmark ($env:DAI_BENCH_RUNS runs per candidate)..."
npm run bench:renderers

Write-Host 'Done. Review the newest JSON under artifacts/renderer-benchmark/.'
Write-Host 'The audited package-lock.json is tracked; raw benchmark result artifacts remain review-only until explicitly promoted.'
