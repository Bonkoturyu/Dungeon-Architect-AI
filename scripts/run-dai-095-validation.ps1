$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'Generator tests'; Command = @('run', 'test:generator') },
  @{ Label = 'Play Core tests'; Command = @('run', 'test:play') },
  @{ Label = 'Run Core tests'; Command = @('run', 'test:run') },
  @{ Label = 'Simulation Core tests'; Command = @('run', 'test:simulation') },
  @{ Label = 'DAI-030 session state'; Command = @('run', 'validate:session-state') },
  @{ Label = 'DAI-031 enemy runtime'; Command = @('run', 'validate:enemy-minimum') },
  @{ Label = 'DAI-032 interaction runtime'; Command = @('run', 'validate:interaction-runtime') },
  @{ Label = 'DAI-033 event logic'; Command = @('run', 'validate:event-logic') },
  @{ Label = 'DAI-034 clear/failure/result'; Command = @('run', 'validate:clear-failure-result') },
  @{ Label = 'DAI-060 simulator'; Command = @('run', 'validate:simulator') },
  @{ Label = 'DAI-062 simulation metrics'; Command = @('run', 'validate:simulation-metrics') },
  @{ Label = 'DAI-093 player stats'; Command = @('run', 'validate:player-stats') },
  @{ Label = 'DAI-094 progression + loot'; Command = @('run', 'validate:progression-loot') },
  @{ Label = 'DAI-095 multi-floor runtime'; Command = @('run', 'validate:multi-floor-run') },
  @{ Label = 'START-gate browser smoke'; Command = @('run', 'smoke:start-gate') },
  @{ Label = 'Exploration UX browser smoke'; Command = @('run', 'smoke:exploration-ux') },
  @{ Label = 'DAI-095 multi-floor browser smoke'; Command = @('run', 'smoke:multi-floor-run') },
  @{ Label = 'Room-event browser smoke'; Command = @('run', 'smoke:room-events') },
  @{ Label = 'Owner UI regression smoke'; Command = @('run', 'smoke:owner-ui-review') }
)

Write-Host "[DAI-095] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[DAI-095] Branch: $(git branch --show-current)"
Write-Host "[DAI-095] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1
  Write-Host ""
  Write-Host "[DAI-095][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[DAI-095] npm $($step.Command -join ' ')"

  & npm.cmd @($step.Command)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[DAI-095] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[DAI-095] PASS: $($step.Label)"
}

Write-Host ""
Write-Host "[DAI-095] ALL ACCEPTANCE GATES PASSED."
