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
$BuildIndex = Join-Path $BuildDir 'index.html'
$ProjectLock = Join-Path $ProjectPath 'Temp\UnityLockfile'
$DefaultEditorLog = Join-Path $env:LOCALAPPDATA 'Unity\Editor\Editor.log'

function Show-UnityLogTail {
    if (Test-Path $LogPath) {
        Write-Host ''
        Write-Host '----- Unity build log (last 160 lines) -----' -ForegroundColor Yellow
        Get-Content -Path $LogPath -Tail 160
        Write-Host '----- End Unity build log -----' -ForegroundColor Yellow
        return
    }

    if (Test-Path $DefaultEditorLog) {
        Write-Host ''
        Write-Host 'Custom Unity log was not created. Showing default Editor.log tail instead.' -ForegroundColor Yellow
        Write-Host '----- Unity Editor.log (last 160 lines) -----' -ForegroundColor Yellow
        Get-Content -Path $DefaultEditorLog -Tail 160
        Write-Host '----- End Unity Editor.log -----' -ForegroundColor Yellow
        return
    }

    Write-Host "Neither Unity log exists: $LogPath / $DefaultEditorLog" -ForegroundColor Yellow
}

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

$UnityEditorDir = Split-Path -Parent $env:UNITY_EDITOR
$WebGLSupportDir = Join-Path $UnityEditorDir 'Data\PlaybackEngines\WebGLSupport'
if (-not (Test-Path $WebGLSupportDir)) {
    throw "Unity WebGL Build Support is not installed for $ExpectedVersion. In Unity Hub, open Installs -> $ExpectedVersion -> Add modules, install Web Build Support/WebGL Build Support, then run this same command again. Expected path: $WebGLSupportDir"
}

if (Test-Path $ProjectLock) {
    throw "The Unity benchmark project is already locked/open. A previous Unity process may still be running. Close that Unity instance (or wait for it to finish), then run this same command again. Lock: $ProjectLock"
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
Write-Host "WebGL support: $WebGLSupportDir"
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
if (Test-Path $LogPath) {
    Remove-Item -Force $LogPath
}

Write-Host 'Building Unity WebGL benchmark...'
Write-Host 'Waiting for the Unity Editor process to finish (this can take several minutes on first import/build)...'

$UnityArgumentList = @(
    '-batchmode',
    '-quit',
    '-accept-apiupdate',
    '-buildTarget', 'WebGL',
    '-projectPath', ('"' + $ProjectPath + '"'),
    '-executeMethod', 'DungeonArchitectAI.Benchmark.Editor.DaiUnityBenchmarkBuild.Build',
    '-logFile', ('"' + $LogPath + '"')
)

try {
    $UnityProcess = Start-Process -FilePath $env:UNITY_EDITOR -ArgumentList $UnityArgumentList -PassThru -Wait
    $UnityExitCode = $UnityProcess.ExitCode
}
catch {
    Show-UnityLogTail
    throw "Failed to launch/wait for Unity: $($_.Exception.Message)"
}

if ($UnityExitCode -ne 0) {
    Show-UnityLogTail
    throw "Unity process failed with exit code $UnityExitCode. See $LogPath"
}

if (-not (Test-Path $BuildIndex)) {
    Show-UnityLogTail
    throw "Unity finished without creating the expected WebGL build. Missing: $BuildIndex. The log above contains the actual Unity-side cause."
}

Write-Host "Unity build created: $BuildIndex"
Write-Host 'Running browser benchmark (5 runs)...'
node scripts/run-unity-renderer-benchmark.mjs
if ($LASTEXITCODE -ne 0) {
    throw 'Unity browser benchmark failed.'
}

Write-Host 'Done. Review the newest JSON under artifacts/renderer-benchmark/.'
