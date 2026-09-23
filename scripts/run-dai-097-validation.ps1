$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'Tracked JavaScript syntax gate'; Command = @('run', 'validate:syntax') },
  @{ Label = 'Audio presentation unit tests'; Command = @('run', 'test:audio') },
  @{ Label = 'Play Core tests'; Command = @('run', 'test:play') },
  @{ Label = 'Run Core tests'; Command = @('run', 'test:run') },
  @{ Label = 'DAI-097 audio browser smoke'; Command = @('run', 'smoke:audio-presentation') },
  @{ Label = 'Multi-floor browser smoke'; Command = @('run', 'smoke:multi-floor-run') },
  @{ Label = 'Programmatic characters smoke'; Command = @('run', 'smoke:programmatic-characters') },
  @{ Label = 'Play UI stack layout smoke'; Command = @('run', 'smoke:play-ui-stack-layout') },
  @{ Label = 'Room-event browser smoke'; Command = @('run', 'smoke:room-events') },
  @{ Label = 'Owner UI regression smoke'; Command = @('run', 'smoke:owner-ui-review') },
  @{ Label = 'Production hosting build'; Command = @('run', 'build:hosting') },
  @{ Label = 'Legal / provenance audit'; Command = @('run', 'validate:legal-registers') },
  @{ Label = 'Public-doc truthfulness audit'; Command = @('run', 'validate:public-docs') }
)

Write-Host "[DAI-097] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[DAI-097] Branch: $(git branch --show-current)"
Write-Host "[DAI-097] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1

  Write-Host ""
  Write-Host "[DAI-097][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[DAI-097] npm $($step.Command -join ' ')"

  & npm.cmd @($step.Command)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[DAI-097] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[DAI-097] PASS: $($step.Label)"
}

Write-Host ""
Write-Host "[DAI-097] ALL ACCEPTANCE GATES PASSED."
