param(
  [Parameter(Mandatory = $true)]
  [string]$NpmScript,

  [string]$Label = "",

  [switch]$IncludeTextEvidence
)

$ErrorActionPreference = "Stop"

$repoRootPath = (Resolve-Path ".").Path.TrimEnd('\', '/')

function Get-RepoRelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FullPath
  )

  $resolved = [System.IO.Path]::GetFullPath($FullPath)
  $rootWithSeparator = $repoRootPath + [System.IO.Path]::DirectorySeparatorChar

  if (
    $resolved.StartsWith(
      $rootWithSeparator,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    return $resolved.Substring($rootWithSeparator.Length)
  }

  throw "Path is outside repository root: $resolved"
}

if ([string]::IsNullOrWhiteSpace($Label)) {
  $Label = $NpmScript
}

$safeLabel = ($Label -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeLabel)) {
  $safeLabel = "run"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path "artifacts/logs" "$safeLabel-$timestamp"
$evidenceRoot = Join-Path $runRoot "evidence"
$consoleLog = Join-Path $runRoot "console.log"
$metadataPath = Join-Path $runRoot "run-metadata.json"
$gitStatusPath = Join-Path $runRoot "git-status.txt"
$gitHeadPath = Join-Path $runRoot "git-head.txt"
$zipPath = Join-Path "artifacts/logs" "$safeLabel-$timestamp.zip"

New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null

$startedAt = Get-Date
$startedAtUtc = $startedAt.ToUniversalTime()

$branchName = (& git rev-parse --abbrev-ref HEAD 2>$null)
$headSha = (& git rev-parse HEAD 2>$null)
$headShort = (& git rev-parse --short HEAD 2>$null)
$nodeVersion = (& node --version 2>$null)
$npmVersion = (& npm.cmd --version 2>$null)

@(
  "branch=$branchName"
  "head=$headSha"
  "shortHead=$headShort"
) | Set-Content -Path $gitHeadPath -Encoding UTF8

Write-Host ""
Write-Host "============================================================"
Write-Host " Logged run"
Write-Host " Script : $NpmScript"
Write-Host " Label  : $safeLabel"
Write-Host " Log    : $consoleLog"
Write-Host " ZIP    : $zipPath"
Write-Host "============================================================"
Write-Host ""

$exitCode = 1
try {
  & npm.cmd run $NpmScript 2>&1 | Tee-Object -FilePath $consoleLog
  $exitCode = $LASTEXITCODE
}
catch {
  $_ | Out-String | Add-Content -Path $consoleLog -Encoding UTF8
  $exitCode = 1
}

$finishedAt = Get-Date

& git status --short 2>&1 | Set-Content -Path $gitStatusPath -Encoding UTF8

$extensions = @(".json", ".log", ".txt")
if ($IncludeTextEvidence) {
  $extensions += @(".md", ".html")
}

$evidenceFiles = @()
if (Test-Path "artifacts") {
  $evidenceFiles = Get-ChildItem -Path "artifacts" -Recurse -File |
    Where-Object {
      $_.FullName -notlike "*\artifacts\logs\*" -and
      $_.LastWriteTimeUtc -ge $startedAtUtc -and
      $extensions -contains $_.Extension.ToLowerInvariant()
    }
}

foreach ($file in $evidenceFiles) {
  $relative = Get-RepoRelativePath -FullPath $file.FullName
  $destination = Join-Path $evidenceRoot $relative
  $destinationDir = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}

$metadata = [ordered]@{
  schemaVersion = "1.0"
  label = $safeLabel
  npmScript = $NpmScript
  startedAt = $startedAt.ToString("o")
  finishedAt = $finishedAt.ToString("o")
  durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
  exitCode = $exitCode
  passed = ($exitCode -eq 0)
  branch = $branchName
  head = $headSha
  shortHead = $headShort
  node = $nodeVersion
  npm = $npmVersion
  consoleLog = "console.log"
  evidenceFileCount = @($evidenceFiles).Count
  evidenceExtensions = $extensions
}

$metadata | ConvertTo-Json -Depth 8 | Set-Content -Path $metadataPath -Encoding UTF8

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $runRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host ""
Write-Host "============================================================"
Write-Host " Logged run finished"
Write-Host " Exit code : $exitCode"
Write-Host " Full log  : $consoleLog"
Write-Host " ZIP bundle: $zipPath"
Write-Host "============================================================"
Write-Host ""

exit $exitCode
