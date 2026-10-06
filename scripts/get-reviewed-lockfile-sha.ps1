$ErrorActionPreference = 'Stop'

# Read the shared current audit identity; never normalize or rewrite lockfile bytes.
$ManifestPath = Join-Path $PSScriptRoot '..\docs\legal\evidence\REVIEWED_PACKAGE_LOCK.json'
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$SchemaVersion = $Manifest.schemaVersion
$NumericSchemaVersion = $SchemaVersion -is [int] -or $SchemaVersion -is [long] -or
    $SchemaVersion -is [double] -or $SchemaVersion -is [decimal]
if ($null -eq $Manifest -or -not $NumericSchemaVersion -or $SchemaVersion -ne 1 -or
    $Manifest.lockfile -cne 'package-lock.json' -or
    $Manifest.sha256 -isnot [string] -or $Manifest.sha256 -cnotmatch '^[0-9a-f]{64}$') {
    throw 'Invalid reviewed package-lock identity. Stop and re-review dependencies.'
}

Write-Output $Manifest.sha256
