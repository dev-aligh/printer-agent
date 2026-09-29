$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sources = @(Get-ChildItem -LiteralPath (Join-Path $workspace 'resources\RawPrint') -Filter *.cs | ForEach-Object FullName)
$sources += Join-Path $workspace 'test\PaperModes.test.cs'
$outputDirectory = Join-Path $workspace 'dist\tests'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$output = Join-Path $outputDirectory 'PaperModeTests.exe'
& "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe" /nologo /target:exe /platform:x86 /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /main:PaperModeTestEntry /out:$output $sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $output
exit $LASTEXITCODE
