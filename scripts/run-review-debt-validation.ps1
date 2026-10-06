$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = & (Join-Path $PSScriptRoot 'get-reviewed-lockfile-sha.ps1')
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
Set-Location $RepoRoot

Write-Host '[REVIEW-DEBT] Starting review-debt / DAI-005 acceptance.'
Write-Host "[REVIEW-DEBT] Branch: $(git branch --show-current)"
Write-Host "[REVIEW-DEBT] HEAD: $(git rev-parse --short HEAD)"

if (-not (Test-Path $LockPath)) {
    throw 'Tracked audited package-lock.json is missing.'
}

$TrackedLock = git ls-files --error-unmatch package-lock.json 2>$null
if ($LASTEXITCODE -ne 0 -or $TrackedLock -ne 'package-lock.json') {
    throw 'package-lock.json must be tracked by Git for clean-checkout reproducibility.'
}

$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256."
}

$steps = @(
    @{ Label = 'Exact audited dependency install'; Script = { npm.cmd ci --ignore-scripts --no-audit --no-fund } },
    @{ Label = 'Tracked JavaScript syntax gate'; Script = { npm.cmd run validate:syntax } },
    @{ Label = 'Complete production Node suite'; Script = { npm.cmd test } },
    @{ Label = 'Production hosting build'; Script = { npm.cmd run build:hosting } },
    @{ Label = 'Built hosting browser smoke'; Script = { npm.cmd run smoke:hosting } },
    @{ Label = 'Legal / provenance register audit'; Script = { npm.cmd run validate:legal-registers } },
    @{ Label = 'Public-doc truthfulness audit'; Script = { npm.cmd run validate:public-docs } },
    @{ Label = 'Git whitespace/error-marker check'; Script = { git diff --check origin/main...HEAD } }
)

Write-Host "[REVIEW-DEBT] Audited lockfile: $ActualLockSha256"
Write-Host "[REVIEW-DEBT] Acceptance steps: $($steps.Count)"

for ($index = 0; $index -lt $steps.Count; $index++) {
    $step = $steps[$index]
    $number = $index + 1
    Write-Host ''
    Write-Host "[REVIEW-DEBT][$number/$($steps.Count)] $($step.Label)"
    & $step.Script
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[REVIEW-DEBT] FAILED at step $number/$($steps.Count): $($step.Label) (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
    Write-Host "[REVIEW-DEBT] PASS: $($step.Label)"
}

Write-Host ''
Write-Host '[REVIEW-DEBT] ALL ACCEPTANCE GATES PASSED.'
