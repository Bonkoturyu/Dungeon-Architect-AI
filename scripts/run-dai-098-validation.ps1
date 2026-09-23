$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'Tracked JavaScript syntax gate'; Tool = 'npm'; Args = @('run', 'validate:syntax') },
  @{ Label = 'Complete production Node suite'; Tool = 'npm'; Args = @('test') },
  @{ Label = 'DAI-060 single-floor simulator'; Tool = 'npm'; Args = @('run', 'validate:simulator') },
  @{ Label = 'DAI-061 built-in agents'; Tool = 'npm'; Args = @('run', 'validate:agents') },
  @{ Label = 'DAI-062 simulation metrics'; Tool = 'npm'; Args = @('run', 'validate:simulation-metrics') },
  @{ Label = 'DAI-063 intent fit'; Tool = 'npm'; Args = @('run', 'validate:intent-fit') },
  @{ Label = 'DAI-064 explainable summary'; Tool = 'npm'; Args = @('run', 'validate:explainable-summary') },
  @{ Label = 'DAI-094 progression / loot'; Tool = 'npm'; Args = @('run', 'validate:progression-loot') },
  @{ Label = 'DAI-095 multi-floor Run Core'; Tool = 'npm'; Args = @('run', 'validate:multi-floor-run') },
  @{ Label = 'DAI-098 multi-floor simulation / balance'; Tool = 'npm'; Args = @('run', 'validate:run-simulation') },
  @{ Label = 'Multi-floor browser regression'; Tool = 'npm'; Args = @('run', 'smoke:multi-floor-run') },
  @{ Label = 'Public-doc truthfulness audit'; Tool = 'npm'; Args = @('run', 'validate:public-docs') },
  @{ Label = 'Git whitespace / error-marker check'; Tool = 'git'; Args = @('diff', '--check', 'origin/main...HEAD') }
)

Write-Host "[DAI-098] Starting acceptance validation ($($steps.Count) steps)."
Write-Host "[DAI-098] Branch: $(git branch --show-current)"
Write-Host "[DAI-098] HEAD: $(git rev-parse --short HEAD)"

for ($index = 0; $index -lt $steps.Count; $index++) {
  $step = $steps[$index]
  $number = $index + 1

  Write-Host ""
  Write-Host "[DAI-098][$number/$($steps.Count)] $($step.Label)"
  Write-Host "[DAI-098] $($step.Tool) $($step.Args -join ' ')"

  if ($step.Tool -eq 'git') {
    & git @($step.Args)
  }
  else {
    & npm.cmd @($step.Args)
  }

  if ($LASTEXITCODE -ne 0) {
    Write-Error "[DAI-098] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }

  Write-Host "[DAI-098] PASS: $($step.Label)"
}

Write-Host ""
Write-Host "[DAI-098] ALL ACCEPTANCE GATES PASSED."
