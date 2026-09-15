$ErrorActionPreference = 'Stop'

$ExpectedLockSha256 = 'ce94a9ee4241ee798c0c32c0fda55f00cb4462fb6ba6244acdd3d53589d261cc'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$LockPath = Join-Path $RepoRoot 'package-lock.json'
$CreatedProcessKey = $false

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

if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    Write-Host ''
    Write-Host 'DAI-053 now makes one live billable OpenAI API call for the browser natural-edit smoke.' -ForegroundColor Yellow
    $SecureKey = Read-Host 'OpenAI API key' -AsSecureString
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureKey)
    try {
        $PlainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
        if ([string]::IsNullOrWhiteSpace($PlainKey)) { throw 'OpenAI API key is empty.' }
        $env:OPENAI_API_KEY = $PlainKey
        $CreatedProcessKey = $true
    }
    finally {
        if ($Bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
        $PlainKey = $null
        $SecureKey = $null
    }
}

try {
    Write-Host 'Running DAI-053 visible Chrome natural-language edit smoke...'
    npm run smoke:natural-edit
    if ($LASTEXITCODE -ne 0) { throw 'DAI-053 natural edit smoke failed.' }
}
finally {
    if ($CreatedProcessKey) {
        Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host 'DAI-053 validation completed successfully.' -ForegroundColor Green
Write-Host 'Evidence: artifacts/natural-edit/dai-053-natural-edit.json'
Write-Host 'Screenshot: artifacts/natural-edit/dai-053-natural-edit.png'
