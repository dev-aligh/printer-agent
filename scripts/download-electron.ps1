$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$archive = Join-Path $projectRoot 'electron-dev.zip'
$package = Get-Content 'node_modules/electron/package.json' -Raw | ConvertFrom-Json
$version = $package.version
$filename = "electron-v$version-win32-x64.zip"
$url = "https://github.com/electron/electron/releases/download/v$version/$filename"
$statusFile = Join-Path $projectRoot 'electron-download-status.log'
try {
  'Downloading Electron...' | Set-Content $statusFile
  & curl.exe --fail --location --silent --show-error --continue-at - --connect-timeout 30 --max-time 7200 --retry 3 --output $archive $url
  if ($LASTEXITCODE -ne 0) { throw "Download failed: curl exit $LASTEXITCODE. Run this script again to resume." }
  $checksums = Get-Content 'node_modules/electron/checksums.json' -Raw | ConvertFrom-Json
  $expected = $checksums.$filename
  $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
  if (!$expected -or $actual -ne $expected) { throw 'Electron archive SHA-256 mismatch.' }
  Expand-Archive -LiteralPath $archive -DestinationPath 'node_modules/electron/dist' -Force
  [System.IO.File]::WriteAllText((Join-Path $projectRoot 'node_modules/electron/path.txt'), 'electron.exe')
  'Ready. Run npm run dev.' | Set-Content $statusFile
} catch {
  "ERROR: $_" | Set-Content $statusFile
  throw
}
