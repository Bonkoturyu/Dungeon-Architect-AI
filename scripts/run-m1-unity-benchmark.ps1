$ErrorActionPreference = 'Stop'

$ExpectedVersion = '6000.3.23f1'
$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$ProjectPath = Join-Path $PSScriptRoot '..\benchmarks\unity-webgl'
$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$BuildDir = Join-Path $PSScriptRoot '..\.tmp\unity-webgl-build'
$BuildDir = [System.IO.Path]::GetFullPath($BuildDir)
$LogPath = Join-Path $PSScriptRoot '..\.tmp\unity-webgl-build.log'
$LogPath = [System.IO.Path]::GetFullPath($LogPath)
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'

if (-not (Test-Path $LockPath)) {
    throw 'Audited package-lock.json is missing. Keep the previously reviewed lockfile in the repository working tree.'
}

$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256. Stop and re-review dependencies before continuing."
}

if (-not $env:UNITY_EDITOR) {
    $candidate = "C:\Program Files\Unity\Hub\Editor\$ExpectedVersion\Editor\Unity.exe"
    if (Test-Path $candidate) {
        $env:UNITY_EDITOR = $candidate
    }
}

if (-not $env:UNITY_EDITOR -or -not (Test-Path $env:UNITY_EDITOR)) {
    throw "Unity $ExpectedVersion not found. Set UNITY_EDITOR to the exact Unity.exe path."
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
    throw 'Chrome not found. Set CHROME_PATH.'
}

Write-Host "Audited lockfile: $ActualLockSha256"
Write-Host "Unity: $env:UNITY_EDITOR"
Write-Host "Chrome: $env:CHROME_PATH"
Write-Host "Project: $ProjectPath"

Write-Host 'Installing exactly the audited Node dependency graph...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw 'npm ci failed.'
}

$env:DAI_UNITY_BUILD_DIR = $BuildDir
$env:DAI_BENCH_RUNS = '5'

New-Item -ItemType Directory -Force -Path (Split-Path $BuildDir) | Out-Null
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}

& $env:UNITY_EDITOR `
    -batchmode `
    -nographics `
    -quit `
    -projectPath $ProjectPath `
    -executeMethod DungeonArchitectAI.Benchmark.Editor.DaiUnityBenchmarkBuild.Build `
    -logFile $LogPath

if ($LASTEXITCODE -ne 0) {
    throw "Unity build failed. See $LogPath"
}

node scripts/run-unity-renderer-benchmark.mjs
if ($LASTEXITCODE -ne 0) {
    throw 'Unity browser benchmark failed.'
}

Write-Host 'Done. Review the newest JSON under artifacts/renderer-benchmark/.'
