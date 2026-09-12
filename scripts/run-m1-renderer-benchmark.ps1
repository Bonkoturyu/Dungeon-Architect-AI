$ErrorActionPreference = 'Stop'

Write-Host '== Dungeon Architect AI / M1 Renderer Benchmark =='
Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"

if (-not $env:CHROME_PATH) {
    $chromeCandidates = @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
    )
    foreach ($candidate in $chromeCandidates) {
        if (Test-Path $candidate) {
            $env:CHROME_PATH = $candidate
            break
        }
    }
}

if (-not $env:CHROME_PATH -or -not (Test-Path $env:CHROME_PATH)) {
    throw 'Chrome was not found. Set CHROME_PATH to chrome.exe.'
}

Write-Host "Chrome: $env:CHROME_PATH"

Write-Host 'Installing exact approved benchmark dependencies (install scripts disabled)...'
npm install --ignore-scripts

Write-Host 'Resolved top-level dependencies:'
npm ls --depth=0

Write-Host 'Running production tests...'
npm test

if (-not $env:DAI_BENCH_RUNS) {
    $env:DAI_BENCH_RUNS = '5'
}

Write-Host "Running renderer benchmark ($env:DAI_BENCH_RUNS runs per candidate)..."
npm run bench:renderers

Write-Host 'Done. Review the newest JSON under artifacts/renderer-benchmark/.'
Write-Host 'Do not commit the raw result or package-lock.json until it has been reviewed.'
