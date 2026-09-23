$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'Play UI stack layout smoke'; Command = @('run', 'smoke:play-ui-stack-layout') },
  @{ Label = 'Room-event browser smoke'; Command = @('run', 'smoke:room-events') },
  @{ Label = 'Multi-floor browser smoke'; Command = @('run', 'smoke:multi-floor-run') },
  @{ Label = 'Programmatic characters smoke'; Command = @('run', 'smoke:programmatic-characters') },
  @{ Label = 'Owner UI regression smoke'; Command = @('run', 'smoke:owner-ui-review') },
  @{ Label = 'Hosting build'; Command = @('run', 'build:hosting') }
)

Write-Host "[PLAY-UI] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[PLAY-UI] Branch: $(git branch --show-current)"
Write-Host "[PLAY-UI] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1

  Write-Host ""
  Write-Host "[PLAY-UI][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[PLAY-UI] npm $($step.Command -join ' ')"

  & npm.cmd @($step.Command)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[PLAY-UI] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[PLAY-UI] PASS: $($step.Label)"
}

Write-Host ""
Write-Host "[PLAY-UI] ALL ACCEPTANCE GATES PASSED."
