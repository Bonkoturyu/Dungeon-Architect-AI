param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

$Url = "http://127.0.0.1:$Port/apps/editor-slice/index.html"

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

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "Python was not found." -ForegroundColor Red
  Write-Host "Install Python or make sure 'python' is available in PATH."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

if (-not (Test-PortAvailable $Port)) {
  Write-Host ""
  Write-Host "Port $Port is already in use." -ForegroundColor Yellow
  Write-Host "If an older local server window is still open, close it and run this again."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "Dungeon Architect AI - Local UI" -ForegroundColor Cyan
Write-Host "--------------------------------"
Write-Host "Opening:"
Write-Host "  $Url" -ForegroundColor Green
Write-Host ""
Write-Host "Keep this window open while checking the UI."
Write-Host "Close this window when you are finished."
Write-Host ""

Start-Process $Url
python -m http.server $Port --bind 127.0.0.1
