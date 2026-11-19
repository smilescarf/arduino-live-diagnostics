$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageInfo = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$releaseVersion = $packageInfo.version
$releaseRoot = Join-Path $projectRoot 'releases'
$stageRoot = Join-Path $projectRoot ('.tmp/bundle-' + [guid]::NewGuid().ToString('N'))
$archiveName = 'arduino-live-diagnostics-' + $releaseVersion + '.vsix'
$pluginPath = Join-Path $releaseRoot $archiveName
if (!(Test-Path -LiteralPath $pluginPath)) { throw 'Run node scripts/package.js first.' }
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
$sourceArchive = Join-Path $stageRoot 'source.zip'
& git -c "safe.directory=$($projectRoot.Replace('\','/'))" -C $projectRoot archive --format=zip --prefix=source/ --output=$sourceArchive HEAD
if ($LASTEXITCODE -ne 0) { throw 'git archive failed; commit the release sources first.' }
Expand-Archive -LiteralPath $sourceArchive -DestinationPath $stageRoot
Remove-Item -LiteralPath $sourceArchive
Copy-Item -LiteralPath $pluginPath -Destination (Join-Path $stageRoot $archiveName)
Copy-Item -LiteralPath (Join-Path $projectRoot 'INSTALL.md') -Destination (Join-Path $stageRoot '安装说明.md')
$pluginHash = (Get-FileHash -LiteralPath $pluginPath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $stageRoot 'SHA256SUMS.txt') -Value "$pluginHash  $archiveName" -Encoding utf8
$bundlePath = Join-Path $releaseRoot ('ArduinoLive-v' + $releaseVersion + '.zip')
Compress-Archive -Path (Join-Path $stageRoot '*') -DestinationPath $bundlePath -Force
$bundleHash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $releaseRoot 'SHA256SUMS.txt') -Value @("$pluginHash  $archiveName", "$bundleHash  $(Split-Path -Leaf $bundlePath)") -Encoding utf8
Get-Item -LiteralPath $bundlePath | Select-Object FullName, Length
