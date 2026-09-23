$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'Tracked JavaScript syntax gate'; Command = @('run', 'validate:syntax') },
  @{ Label = 'Complete production Node suite'; Command = @('test') },
  @{ Label = 'DAI-060 single-floor simulator'; Command = @('run', 'validate:simulator') },
  @{ Label = 'DAI-061 built-in agents'; Command = @('run', 'validate:agents') },
  @{ Label = 'DAI-062 simulation metrics'; Command = @('run', 'validate:simulation-metrics') },
  @{ Label = 'DAI-063 intent fit'; Command = @('run', 'validate:intent-fit') },
  @{ Label = 'DAI-064 explainable summary'; Command = @('run', 'validate:explainable-summary') },
  @{ Label = 'DAI-094 progression / loot'; Command = @('run', 'validate:progression-loot') },
  @{ Label = 'DAI-095 multi-floor Run Core'; Command = @('run', 'validate:multi-floor-run') },
  @{ Label = 'DAI-098 multi-floor simulation / balance'; Command = @('run', 'validate:run-simulation') },
  @{ Label = 'Multi-floor browser regression'; Command = @('run', 'smoke:multi-floor-run') }
)

Write-Host "[DAI-098] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[DAI-098] Branch: $(git branch --show-current)"
Write-Host "[DAI-098] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1

  Write-Host ""
  Write-Host "[DAI-098][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[DAI-098] npm $($step.Command -join ' ')"

  & npm.cmd @($step.Command)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[DAI-098] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[DAI-098] PASS: $($step.Label)"
}

Write-Host ""
Write-Host "[DAI-098] ALL ACCEPTANCE GATES PASSED."
