<# Developer build only. End users double-click the generated EXE. #>
param(
 [Parameter(Mandatory=$true)][string]$CacheDir,
 [Parameter(Mandatory=$true)][string]$OutputDir,
 [string]$Build = '20261020-setup1'
)
$ErrorActionPreference='Stop'
$sourceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$repoRoot=Split-Path -Parent $sourceRoot
$cache=[IO.Path]::GetFullPath($CacheDir)
$output=[IO.Path]::GetFullPath($OutputDir)
if(-not [IO.Path]::IsPathRooted($CacheDir) -or -not [IO.Path]::IsPathRooted($OutputDir)){throw 'CacheDir/OutputDir must be absolute'}
if($Build -notmatch '^[a-zA-Z0-9-]+$'){throw 'Invalid build id'}
New-Item -ItemType Directory -Path $cache,$output -Force|Out-Null
$lock=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-lock.json') -Raw|ConvertFrom-Json
foreach($item in @($lock.node,$lock.powershell)){
 $archive=Join-Path $cache $item.file
 if(-not (Test-Path -LiteralPath $archive)){Invoke-WebRequest -Uri $item.url -OutFile $archive}
 if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "Runtime SHA mismatch: $($item.file)"}
}
$stage=Join-Path $output ('stage-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage|Out-Null
$app=Join-Path $stage 'app'
$runtime=Join-Path $stage 'runtime'
New-Item -ItemType Directory -Path $app,(Join-Path $runtime 'node'),(Join-Path $runtime 'powershell') -Force|Out-Null
$release=Get-Content -LiteralPath (Join-Path $repoRoot 'docs\wps-phase1-release-manifest-20261020.json') -Raw|ConvertFrom-Json
foreach($entry in $release.candidate.files){
 if($entry.path -match '(^|/)(outputs|test|node_modules)(/|$)' -or $entry.path -match '\.\.') {throw 'Unsafe release path'}
 $relative=$entry.path.Replace('/',[IO.Path]::DirectorySeparatorChar)
 $from=if($relative.StartsWith('docs\')){Join-Path $repoRoot $relative}else{Join-Path $sourceRoot $relative}
 $to=Join-Path $app $relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $to) -Force|Out-Null
 Copy-Item -LiteralPath $from -Destination $to
}
$desktop=Join-Path $app 'install\desktop'
New-Item -ItemType Directory -Path $desktop -Force|Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'engine.cjs') -Destination $desktop
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime-lock.json') -Destination $stage
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\wps-oneclick-installer-20261020.md') -Destination (Join-Path $app 'docs')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$nodeZip=[IO.Compression.ZipFile]::OpenRead((Join-Path $cache $lock.node.file))
try{
 foreach($name in @('node.exe','LICENSE')){
  $entry=$nodeZip.GetEntry("node-v$($lock.node.version)-win-x64/$name")
  if(-not $entry){throw "Missing Node $name"}
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $runtime "node\$name"),$false)
 }
}finally{$nodeZip.Dispose()}
[IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $cache $lock.powershell.file),(Join-Path $runtime 'powershell'))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not (Test-Path -LiteralPath $compiler)){throw '.NET Framework compiler unavailable'}
& $compiler '/nologo' '/target:winexe' '/platform:x64' "/out:$stage\Launcher.exe" '/r:System.Windows.Forms.dll' '/r:System.Web.Extensions.dll' (Join-Path $PSScriptRoot 'Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Launcher compilation failed'}
$bundle=@{build=$Build;runtimeId="node-$($lock.node.version)-ps-$($lock.powershell.version)";node=$lock.node;powershell=$lock.powershell;sourceCommit=(& git -C $repoRoot rev-parse HEAD).Trim()}
$bundle.files=@(Get-ChildItem -LiteralPath $app -File -Recurse | Sort-Object FullName | ForEach-Object { @{path=$_.FullName.Substring($app.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$utf8=[Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $stage 'bundle.json'),($bundle|ConvertTo-Json -Depth 5),$utf8)
$zip=Join-Path $output "payload-$Build.zip"
if(Test-Path -LiteralPath $zip){throw "Output exists: $zip"}
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip,[IO.Compression.CompressionLevel]::Optimal,$false)
$sha=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
$shaFile=Join-Path $output "payload-$Build.sha256"
[IO.File]::WriteAllText($shaFile,$sha,$utf8)
$exe=Join-Path $output "WpsRfqAddin-Setup-$Build.exe"
& $compiler '/nologo' '/target:winexe' '/platform:anycpu' '/optimize+' "/out:$exe" '/r:System.Windows.Forms.dll' '/r:System.Drawing.dll' '/r:System.Web.Extensions.dll' '/r:System.IO.Compression.dll' '/r:System.IO.Compression.FileSystem.dll' "/win32manifest:$PSScriptRoot\setup.manifest" "/resource:$zip,Payload.zip" "/resource:$shaFile,Payload.sha256" (Join-Path $PSScriptRoot 'Setup.cs')
if($LASTEXITCODE -ne 0){throw 'Setup compilation failed'}
$receipt=@{file=[IO.Path]::GetFileName($exe);bytes=(Get-Item -LiteralPath $exe).Length;sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant();payloadSha256=$sha;runtime=$bundle}
[IO.File]::WriteAllText((Join-Path $output "installer-$Build.json"),($receipt|ConvertTo-Json -Depth 7),$utf8)
$receipt|ConvertTo-Json -Depth 7
