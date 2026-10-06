$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = & (Join-Path $PSScriptRoot 'get-reviewed-lockfile-sha.ps1')
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

Write-Host '[DAI-099 PREDEPLOY] Refreshing refs...'
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

if (-not (Test-Path $LockPath)) {
    throw 'Tracked audited package-lock.json is missing.'
}

$TrackedLock = git ls-files --error-unmatch package-lock.json 2>$null
if ($LASTEXITCODE -ne 0 -or $TrackedLock -ne 'package-lock.json') {
    throw 'package-lock.json must be tracked.'
}

$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256."
}

Write-Host "[DAI-099 PREDEPLOY] Audited lockfile: $ActualLockSha256"
Write-Host '[DAI-099 PREDEPLOY] Installing exact reviewed dependencies...'
npm.cmd ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

$steps = @(
  @{ Label = 'Tracked JavaScript syntax gate'; Tool = 'npm'; Args = @('run', 'validate:syntax') },
  @{ Label = 'Complete production Node suite'; Tool = 'npm'; Args = @('test') },
  @{ Label = 'DAI-098 run simulation / balance evidence'; Tool = 'npm'; Args = @('run', 'validate:run-simulation') },
  @{ Label = 'START-gate browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:start-gate') },
  @{ Label = 'Exploration UX browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:exploration-ux') },
  @{ Label = 'Room-event browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:room-events') },
  @{ Label = 'Multi-floor browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:multi-floor-run') },
  @{ Label = 'Programmatic character browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:programmatic-characters') },
  @{ Label = 'Audio presentation browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:audio-presentation') },
  @{ Label = 'Play UI stack browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:play-ui-stack-layout') },
  @{ Label = 'Owner UI regression smoke'; Tool = 'npm'; Args = @('run', 'smoke:owner-ui-review') },
  @{ Label = 'Production hosting build'; Tool = 'npm'; Args = @('run', 'build:hosting') },
  @{ Label = 'Build fingerprint audit'; Tool = 'npm'; Args = @('run', 'validate:refreshed-build-fingerprint') },
  @{ Label = 'Built hosting browser smoke'; Tool = 'npm'; Args = @('run', 'smoke:hosting') },
  @{ Label = 'Visible-Chrome performance/browser gate'; Tool = 'npm'; Args = @('run', 'smoke:browser-performance') },
  @{ Label = 'Legal / provenance audit'; Tool = 'npm'; Args = @('run', 'validate:legal-registers') },
  @{ Label = 'Secret / privacy audit'; Tool = 'npm'; Args = @('run', 'validate:secret-privacy') },
  @{ Label = 'Desktop/mobile-scope regression'; Tool = 'npm'; Args = @('run', 'smoke:mobile-scope') },
  @{ Label = 'Public-doc truthfulness audit'; Tool = 'npm'; Args = @('run', 'validate:public-docs') },
  @{ Label = 'Submission metadata audit'; Tool = 'npm'; Args = @('run', 'validate:submission-metadata') },
  @{ Label = 'Refreshed video-plan audit'; Tool = 'npm'; Args = @('run', 'validate:refreshed-video-plan') },
  @{ Label = 'Git whitespace / error-marker check'; Tool = 'git'; Args = @('diff', '--check', 'origin/main...HEAD') }
)

Write-Host "[DAI-099 PREDEPLOY] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[DAI-099 PREDEPLOY] Branch: $(git branch --show-current)"
Write-Host "[DAI-099 PREDEPLOY] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1

  Write-Host ''
  Write-Host "[DAI-099 PREDEPLOY][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[DAI-099 PREDEPLOY] $($step.Tool) $($step.Args -join ' ')"

  if ($step.Tool -eq 'git') {
    & git @($step.Args)
  }
  else {
    & npm.cmd @($step.Args)
  }

  if ($LASTEXITCODE -ne 0) {
    Write-Error "[DAI-099 PREDEPLOY] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[DAI-099 PREDEPLOY] PASS: $($step.Label)"
}

Write-Host ''
Write-Host '[DAI-099 PREDEPLOY] ALL ACCEPTANCE GATES PASSED.'
Write-Host 'Next phase: merge/deploy main, then run DAI-099 public validation.'
