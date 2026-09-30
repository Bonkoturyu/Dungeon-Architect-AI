param(
  [Parameter(Mandatory = $true)]
  [string]$RunRoot,

  [string[]]$EvidencePath = @()
)

$ErrorActionPreference = "Stop"

$repoRootPath = (Resolve-Path ".").Path.TrimEnd('\', '/')
$resolvedRunRoot = (Resolve-Path $RunRoot).Path

if (-not (Test-Path $resolvedRunRoot -PathType Container)) {
  throw "RunRoot is not a directory: $RunRoot"
}

$runName = Split-Path -Leaf $resolvedRunRoot
$zipPath = Join-Path (Split-Path -Parent $resolvedRunRoot) ($runName + ".zip")
$evidenceRoot = Join-Path $resolvedRunRoot "evidence"
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null

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

foreach ($item in $EvidencePath) {
  if (-not (Test-Path $item -PathType Leaf)) {
    throw "Evidence file not found: $item"
  }

  $source = (Resolve-Path $item).Path
  $relative = Get-RepoRelativePath -FullPath $source
  $destination = Join-Path $evidenceRoot $relative
  $destinationDir = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

$metadataPath = Join-Path $resolvedRunRoot "bundle-metadata.json"
$metadata = [ordered]@{
  schemaVersion = "1.0"
  packagedAt = (Get-Date).ToString("o")
  runRoot = $RunRoot
  evidencePaths = $EvidencePath
  branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
  head = (& git rev-parse HEAD 2>$null)
  shortHead = (& git rev-parse --short HEAD 2>$null)
}

$metadata | ConvertTo-Json -Depth 8 | Set-Content -Path $metadataPath -Encoding UTF8

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $resolvedRunRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host ""
Write-Host "ZIP bundle: $zipPath"
Write-Host ""
