$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\resources\RawPrint\*.cs'
$target = Join-Path $PSScriptRoot '..\resources\RawPrint.exe'
$csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
# AnyCPU runs as 32-bit on 32-bit Windows and uses the native spooler on 64-bit Windows.
& $csc /nologo /target:exe /platform:anycpu /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /out:$target $source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Created $target"
