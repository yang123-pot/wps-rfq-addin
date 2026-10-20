<#
启动本机服务（隐藏窗口、单实例、失败可见原因）。不依赖任何会话，可手动或计划任务调用。
DataRoot 的 imports/library/projects/headers/splits 五个子目录会明确传给服务。
#>
param(
  [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin\app'),
  [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin'),
  [string]$PublishPath = (Join-Path $env:APPDATA 'kingsoft\wps\jsaddons\publish.xml'),
  [int]$Port = 38891
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'service-identity.ps1')

$nodeExe = (Get-Command node -ErrorAction Stop).Source
$dataSubdirs = @('imports','library','projects','headers','splits')

function Get-RfqFullPath([string]$value, [string]$label) {
  if ([string]::IsNullOrWhiteSpace($value)) { throw "$label 不能为空。" }
  if (-not [IO.Path]::IsPathRooted($value)) { throw "$label 必须是绝对路径：$value" }
  $full = [IO.Path]::GetFullPath($value)
  if ($full.Length -gt 3) { $full = $full.TrimEnd('\') }
  return $full
}

function Quote-RfqArgument([string]$value) {
  if ($value -match '\s' -or $value.Contains('"')) { return '"' + $value.Replace('"','\"') + '"' }
  return $value
}

$appDir = Get-RfqFullPath $AppDir 'AppDir'
$dataRoot = Get-RfqFullPath $DataRoot 'DataRoot'
$publishPath = Get-RfqFullPath $PublishPath 'PublishPath'
$server = Join-Path $appDir 'dev\server.cjs'
if (-not (Test-Path -LiteralPath $server -PathType Leaf)) { throw "插件目录缺少dev\server.cjs：$server（请先安装）" }

$health = Get-RfqHealth -Port $Port
if ($health) {
  $expected = Get-RfqCodeVersion -NodeExe $nodeExe -ServerScript $server -Root $appDir
  $check = Test-RfqServiceIdentity -Health $health -AppDir $appDir -ExpectedCodeVersion $expected -NodeExe $nodeExe
  if (-not $check.Ok) {
    throw "端口$Port上的本插件服务身份无法确认：$($check.Reason)。未停止任何进程。"
  }
  Write-Host "服务已在运行（端口$Port，进程$($health.pid)，代码版本$expected）。"
  return
}
if (Test-RfqPortListening -Port $Port) {
  throw "端口$Port已被其他程序占用（不是本插件），未启动。"
}

if (-not (Test-Path -LiteralPath $dataRoot)) { New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null }
foreach ($name in $dataSubdirs) {
  $directory = Join-Path $dataRoot $name
  if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
}

$arguments = @(
  (Quote-RfqArgument $server), '--port', "$Port",
  '--import-directory', (Quote-RfqArgument (Join-Path $dataRoot 'imports')),
  '--library-directory', (Quote-RfqArgument (Join-Path $dataRoot 'library')),
  '--project-directory', (Quote-RfqArgument (Join-Path $dataRoot 'projects')),
  '--header-directory', (Quote-RfqArgument (Join-Path $dataRoot 'headers')),
  '--split-directory', (Quote-RfqArgument (Join-Path $dataRoot 'splits'))
)
$process = Start-Process -FilePath $nodeExe -ArgumentList $arguments -WindowStyle Hidden -PassThru
$newHealth = Wait-RfqHealth -Port $Port -TimeoutSeconds 20
if (-not $newHealth) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "服务未在20秒内就绪，已停止本次启动的进程。请手动运行：node `"$server`" --port $Port"
}
$expected = Get-RfqCodeVersion -NodeExe $nodeExe -ServerScript $server -Root $appDir
$check = Test-RfqServiceIdentity -Health $newHealth -AppDir $appDir -ExpectedCodeVersion $expected -NodeExe $nodeExe
if (-not $check.Ok -or [int]$newHealth.pid -ne [int]$process.Id) {
  $reason = if ($check.Ok) { "健康响应进程号$($newHealth.pid)与启动进程$($process.Id)不一致" } else { $check.Reason }
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "服务启动后身份核对失败：$reason。已停止本次启动的进程。"
}
$pidFile = Join-Path $dataRoot 'server.pid'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($pidFile, [string]$process.Id, $utf8)
Write-Host "服务已启动（端口$Port，进程号$($process.Id)，代码版本$expected）。"
