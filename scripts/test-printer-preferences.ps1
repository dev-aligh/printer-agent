$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sources = @(Get-ChildItem -LiteralPath (Join-Path $workspace 'resources\RawPrint') -Filter *.cs | ForEach-Object FullName)
$sources += Join-Path $workspace 'test\PrinterPreferences.integration.cs'
$outputDirectory = Join-Path $workspace 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$output = Join-Path $outputDirectory 'PreferenceTests.exe'
& "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe" /nologo /target:exe /platform:anycpu /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /main:PreferenceTestEntry /out:$output $sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $output
exit $LASTEXITCODE
