param(
    [ValidateSet('Round1', 'Final')]
    [string]$Phase = 'Round1'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $RepoRoot

$HadApiKey = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)
$Bstr = [IntPtr]::Zero

try {
    Write-Host 'Running DAI-090 cloud-intent contract regressions...'
    npm run test:cloud-intent
    if ($LASTEXITCODE -ne 0) { throw 'Cloud-intent tests failed.' }

    npm run validate:intent-routing
    if ($LASTEXITCODE -ne 0) { throw 'Intent-routing validation failed.' }

    if (-not $HadApiKey) {
        Write-Host ''
        Write-Host 'DAI-090 makes 20 live, billable OpenAI API calls (plus bounded retries if needed).' -ForegroundColor Yellow
        Write-Host 'The API key is requested with hidden input and is kept only in this process environment.'
        $SecureKey = Read-Host 'OpenAI API key' -AsSecureString
        $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureKey)
        $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
        if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
            throw 'OpenAI API key was empty.'
        }
    }

    $ScriptName = if ($Phase -eq 'Final') {
        'validate:dai-090-final'
    } else {
        'validate:dai-090-round1'
    }

    Write-Host ''
    Write-Host "Running DAI-090 $Phase live unexpected-prompt gate..."
    npm run $ScriptName
    if ($LASTEXITCODE -ne 0) {
        throw "DAI-090 $Phase did not meet the frozen gates. Review artifacts/dai-090/."
    }
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
Write-Host "DAI-090 $Phase completed successfully." -ForegroundColor Green
$Suffix = if ($Phase -eq 'Final') { 'final' } else { 'round1' }
Write-Host "Evidence: artifacts/dai-090/dai-090-unexpected-prompts-$Suffix.json"
