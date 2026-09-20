$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

if (-not (Test-Path $LockPath)) { throw 'Audited package-lock.json is missing.' }
$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256."
}

npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed.' }

npm run smoke:ui-ux-polish
if ($LASTEXITCODE -ne 0) { throw 'UI/UX polish visible-Chrome smoke failed.' }

npm run smoke:exploration-ux
if ($LASTEXITCODE -ne 0) { throw 'Exploration / Mystery Play visible-Chrome smoke failed.' }

npm run smoke:room-events
if ($LASTEXITCODE -ne 0) { throw 'Room-event Play visible-Chrome smoke failed.' }

Write-Host ''
Write-Host 'UI/UX polish validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/ui-ux-polish/ui-ux-polish.json'
Write-Host 'Screenshots: artifacts/ui-ux-polish/ui-ux-edit.png / ui-ux-play.png / ui-ux-result.png'
Write-Host 'Exploration evidence: artifacts/exploration-ux/dai-086-exploration-ux.json'
Write-Host 'Exploration screenshots: artifacts/exploration-ux/test-play-start.png / test-play-after-one-move.png / mystery-play-start.png'
Write-Host 'Room-event evidence: artifacts/room-events/dai-087-room-events.json'
Write-Host 'Room-event screenshots: artifacts/room-events/room-event-blocked.png / room-event-result.png'
