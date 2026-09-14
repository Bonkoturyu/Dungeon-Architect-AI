$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'

Set-Location $RepoRoot

if (-not (Test-Path $LockPath)) {
    throw 'Audited package-lock.json is missing from the working tree.'
}

$ActualLockSha256 = (Get-FileHash -Algorithm SHA256 -Path $LockPath).Hash.ToLowerInvariant()
if ($ActualLockSha256 -ne $ExpectedLockSha256) {
    throw "package-lock.json hash mismatch. Expected $ExpectedLockSha256, got $ActualLockSha256. Stop and re-review dependencies."
}

Write-Host "Audited lockfile: $ActualLockSha256"
Write-Host 'Installing the exact reviewed Node dependency graph...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Running the complete production Node test suite...'
npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed.' }

$HadApiKey = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)
$Bstr = [IntPtr]::Zero
try {
    if (-not $HadApiKey) {
        Write-Host ''
        Write-Host 'DAI-045 makes live, billable OpenAI API calls for the frozen 10-prompt regression corpus.' -ForegroundColor Yellow
        Write-Host 'The key is requested with hidden input and is kept only in this process environment.'
        $SecureKey = Read-Host 'OpenAI API key' -AsSecureString
        $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureKey)
        $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
        if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
            throw 'OpenAI API key was empty.'
        }
    }

    Write-Host 'Running DAI-045 live prompt regression...'
    npm run validate:prompt-regression
    if ($LASTEXITCODE -ne 0) { throw 'DAI-045 prompt regression did not meet the frozen candidate gates. Review the generated evidence.' }
}
finally {
    if (-not $HadApiKey) {
        Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    }
    if ($Bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    }
}

Write-Host ''
Write-Host 'DAI-045 live prompt regression completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/prompt-regression/dai-045-live-prompt-regression.json'
