param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Test-PortAvailable([int]$PortNumber) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $PortNumber)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "Node.js was not found." -ForegroundColor Red
  Write-Host "This project already requires Node.js for its tests and build."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "npm was not found." -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

if (-not (Test-PortAvailable $Port)) {
  Write-Host ""
  Write-Host "Port $Port is already in use." -ForegroundColor Yellow
  Write-Host "Close the previous local UI window, then run run-ui.cmd again."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "Dungeon Architect AI - Local UI" -ForegroundColor Cyan
Write-Host "--------------------------------"
Write-Host "[1/2] Building the current UI..."
npm run build:hosting
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Build failed." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit $LASTEXITCODE
}

$env:DAI_LOCAL_UI_PORT = "$Port"
$Url = "http://127.0.0.1:$Port/"

Write-Host ""
Write-Host "[2/2] Starting local UI..."
Write-Host "Opening: $Url" -ForegroundColor Green
Write-Host "Generate / AI Request use the existing Cloudflare production API through a local proxy."
Write-Host ""

$server = Start-Process -FilePath "node" -ArgumentList @("scripts/run-local-ui.mjs") -PassThru -NoNewWindow
Start-Sleep -Milliseconds 700
Start-Process $Url

try {
  Wait-Process -Id $server.Id
} finally {
  Remove-Item Env:DAI_LOCAL_UI_PORT -ErrorAction SilentlyContinue
}
