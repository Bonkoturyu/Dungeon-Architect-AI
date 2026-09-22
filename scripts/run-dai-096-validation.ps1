$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'Renderer Three tests'; Command = @('run', 'test:renderer-three') },
  @{ Label = 'Play Core tests'; Command = @('run', 'test:play') },
  @{ Label = 'Run Core tests'; Command = @('run', 'test:run') },
  @{ Label = 'Renderer Three browser smoke'; Command = @('run', 'smoke:renderer-three') },
  @{ Label = 'DAI-093 player stats'; Command = @('run', 'validate:player-stats') },
  @{ Label = 'DAI-094 progression + loot'; Command = @('run', 'validate:progression-loot') },
  @{ Label = 'DAI-095 multi-floor runtime'; Command = @('run', 'validate:multi-floor-run') },
  @{ Label = 'DAI-096 programmatic character smoke'; Command = @('run', 'smoke:programmatic-characters') },
  @{ Label = 'DAI-095 multi-floor browser smoke'; Command = @('run', 'smoke:multi-floor-run') },
  @{ Label = 'Room-event browser smoke'; Command = @('run', 'smoke:room-events') },
  @{ Label = 'Owner UI regression smoke'; Command = @('run', 'smoke:owner-ui-review') },
  @{ Label = 'Hosting build'; Command = @('run', 'build:hosting') },
  @{ Label = 'Legal/provenance regression'; Command = @('run', 'validate:legal-registers') }
)

Write-Host "[DAI-096] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[DAI-096] Branch: $(git branch --show-current)"
Write-Host "[DAI-096] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1

  Write-Host ""
  Write-Host "[DAI-096][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[DAI-096] npm $($step.Command -join ' ')"

  & npm.cmd @($step.Command)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[DAI-096] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[DAI-096] PASS: $($step.Label)"
}

Write-Host ""
Write-Host "[DAI-096] ALL ACCEPTANCE GATES PASSED."
