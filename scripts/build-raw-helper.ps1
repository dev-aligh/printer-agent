$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\resources\RawPrint\RawPrint.cs'
$target = Join-Path $PSScriptRoot '..\resources\RawPrint.exe'
$csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
& $csc /nologo /target:exe /out:$target $source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Created $target"
