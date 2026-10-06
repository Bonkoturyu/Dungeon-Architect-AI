$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = & (Join-Path $PSScriptRoot 'get-reviewed-lockfile-sha.ps1')
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

npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'Hosting build failed.' }

npm run smoke:generation-surface
if ($LASTEXITCODE -ne 0) { throw 'DAI-081 local generation-surface smoke failed.' }

npm run smoke:manual-editor
if ($LASTEXITCODE -ne 0) { throw 'DAI-051 manual-editor smoke failed.' }

npm run smoke:start-gate
if ($LASTEXITCODE -ne 0) { throw 'DAI-054 START-gate smoke failed.' }

npm run smoke:browser-performance
if ($LASTEXITCODE -ne 0) { throw 'DAI-071 browser-performance smoke failed.' }

npm run smoke:mobile-scope
if ($LASTEXITCODE -ne 0) { throw 'DAI-075 mobile-scope smoke failed.' }

npm run smoke:onboarding
if ($LASTEXITCODE -ne 0) { throw 'DAI-070 multilingual onboarding smoke failed.' }

npm run smoke:ui-ux-polish
if ($LASTEXITCODE -ne 0) { throw 'UI/UX polish visible-Chrome smoke failed.' }

npm run smoke:exploration-ux
if ($LASTEXITCODE -ne 0) { throw 'Exploration / Mystery Play visible-Chrome smoke failed.' }

npm run smoke:room-events
if ($LASTEXITCODE -ne 0) { throw 'Room-event Play visible-Chrome smoke failed.' }

npm run smoke:owner-ui-review
if ($LASTEXITCODE -ne 0) { throw 'Owner UI review smoke failed.' }

Write-Host ''
Write-Host 'UI/UX polish + owner interaction validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts\ui-ux-polish/ui-ux-polish.json'
Write-Host 'Screenshots: artifacts\ui-ux-polish/ui-ux-edit.png / ui-ux-play.png / ui-ux-result.png'
Write-Host 'Exploration evidence: artifacts\exploration-ux/dai-086-exploration-ux.json'
Write-Host 'Exploration screenshots: artifacts\exploration-ux/test-play-start.png / test-play-after-one-move.png / mystery-play-start.png'
Write-Host 'Room-event evidence: artifacts\room-events/dai-087-room-events.json'
Write-Host 'Room-event screenshots: artifacts\room-events/room-event-blocked.png / room-event-result.png'
Write-Host 'Owner review evidence: artifacts\\owner-ui-review/owner-ui-review.json'`n