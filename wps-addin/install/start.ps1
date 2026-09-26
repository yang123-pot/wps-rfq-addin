<#
启动本机服务（隐藏窗口、单实例、失败可见原因）。不依赖任何会话，可手动或计划任务调用。
#>
param(
  [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin\app'),
  [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin'),
  [string]$PublishPath = (Join-Path $env:APPDATA 'kingsoft\wps\jsaddons\publish.xml'),
  [int]$Port = 38891
)
$ErrorActionPreference = 'Stop'
$server = Join-Path $AppDir 'dev\server.cjs'
if (-not (Test-Path -LiteralPath $server)) { throw "插件目录缺少dev\server.cjs：$server（请先安装）" }
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
  if ($health.service -eq 'wps-rfq-addin') { Write-Host "服务已在运行（端口$Port，模式$($health.mode)）。"; return }
  Write-Host "端口$Port已被其他程序占用（非本插件），未启动。"
  return
} catch { }
if (-not (Test-Path -LiteralPath $DataRoot)) { New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null }
$process = Start-Process -FilePath 'node' -ArgumentList @($server,'--port',"$Port") -WindowStyle Hidden -PassThru
Set-Content -LiteralPath (Join-Path $DataRoot 'server.pid') -Value $process.Id -Encoding UTF8
$ready = $false
for ($i = 0; $i -lt 20 -and -not $ready; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
    $ready = ($health.service -eq 'wps-rfq-addin')
  } catch { $ready = $false }
}
if ($ready) { Write-Host "服务已启动（端口$Port，进程号$($process.Id)）。" }
else { Write-Host "服务未就绪，请查看日志或手动运行：node `"$server`" --port $Port" }
