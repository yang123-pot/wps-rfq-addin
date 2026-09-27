<#
WPS询价插件本机安装（用户级）：
  1. 备份WPS的publish.xml，只增改本插件的节点，其他插件节点原样保留；
  2. 把发布文件复制到本机插件目录（不含探针、诊断和故障注入脚本）；
  3. 以隐藏窗口启动本机服务，只监听127.0.0.1，端口被自己占用时不重复启动。
默认参数是本机常用位置；测试与回退时可全部用参数覆盖。
#>
param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..'),
  [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin\app'),
  [string]$PublishPath = (Join-Path $env:APPDATA 'kingsoft\wps\jsaddons\publish.xml'),
  [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin'),
  [int]$Port = 38891,
  [switch]$SkipService,
  [switch]$SkipHealthCheck
)
$ErrorActionPreference = 'Stop'
$pluginGuid = 'WpsRfqAddin'
$pluginUrl = "http://127.0.0.1:$Port/"
$excluded = @('host-probe.js','pane-diagnostics.js','acceptance-probe.js')

function Write-Step([string]$text){ Write-Host "[安装] $text" }

if (-not (Test-Path -LiteralPath (Join-Path $SourceDir 'main.js'))) {
  throw "源目录不是有效的插件目录：$SourceDir"
}
Write-Step "源目录：$SourceDir"
if (-not (Test-Path -LiteralPath $PublishPath)) {
  Write-Step "未找到publish.xml，将新建：$PublishPath"
  $parent = Split-Path -Parent $PublishPath
  if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
}

$backup = $null
if (Test-Path -LiteralPath $PublishPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = "$PublishPath.bak-$stamp"
  Copy-Item -LiteralPath $PublishPath -Destination $backup -Force
  Write-Step "已备份publish.xml：$backup"
}

[xml]$xml = if (Test-Path -LiteralPath $PublishPath) { Get-Content -LiteralPath $PublishPath -Raw } else { '<?xml version="1.0" encoding="UTF-8"?><jsplugins></jsplugins>' }
if (-not $xml.DocumentElement) { throw 'publish.xml没有根节点，已停止安装。' }

# 只删除本插件自己的节点；其他插件节点必须原样保留。
$ours = @($xml.DocumentElement.ChildNodes | Where-Object {
  $_ -is [System.Xml.XmlElement] -and (
    ($_.GetAttribute('name') -eq $pluginGuid) -or
    ($_.GetAttribute('guid') -eq $pluginGuid)
  )
})
foreach ($node in $ours) { [void]$xml.DocumentElement.RemoveChild($node) }
if ($ours.Count -gt 0) { Write-Step "已移除本插件旧节点 $($ours.Count) 个" }

# WPS表格实际读取的元素名与属性（与dev/register.ps1一致，已在本机29161上核对）。
$node = $xml.CreateElement('jspluginonline')
$node.SetAttribute('name', $pluginGuid)
$node.SetAttribute('type', 'et')
$node.SetAttribute('url', $pluginUrl)
$node.SetAttribute('debug', '')
$node.SetAttribute('enable', 'enable_dev')
$node.SetAttribute('install', 'null')
$node.SetAttribute('customDomain', '')
[void]$xml.DocumentElement.AppendChild($node)
$xml.Save($PublishPath)
Write-Step "已写入本插件节点：$pluginUrl"

$release = @('main.js','ribbon.xml','taskpane.html','styles.css','package.json','rules','src','dev','assets')
if (-not (Test-Path -LiteralPath $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }
$codeBackup = $null
if (Test-Path -LiteralPath (Join-Path $AppDir 'main.js')) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $codeBackup = "$AppDir.bak-$stamp"
  Copy-Item -LiteralPath $AppDir -Destination $codeBackup -Recurse -Force
  Write-Step "已备份旧程序目录：$codeBackup"
}
try {
  foreach ($item in $release) {
    $from = Join-Path $SourceDir $item
    if (-not (Test-Path -LiteralPath $from)) { continue }
    $to = Join-Path $AppDir $item
    if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Recurse -Force }
    Copy-Item -LiteralPath $from -Destination $to -Recurse -Force
  }
} catch {
  if ($codeBackup -and (Test-Path -LiteralPath $codeBackup)) {
    if (Test-Path -LiteralPath $AppDir) { Remove-Item -LiteralPath $AppDir -Recurse -Force }
    Copy-Item -LiteralPath $codeBackup -Destination $AppDir -Recurse -Force
    Write-Step "发布复制失败，已回退旧程序目录：$codeBackup"
  }
  throw
}
Get-ChildItem -LiteralPath $AppDir -Recurse -File | Where-Object { $excluded -contains $_.Name } | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Force
  Write-Step "已从发布文件移除诊断脚本：$($_.Name)"
}
Write-Step "发布文件已复制到：$AppDir"

if (-not (Test-Path -LiteralPath $DataRoot)) { New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null }
Write-Step "用户数据目录（安装与卸载都不删除）：$DataRoot"

if ($SkipService) { Write-Step '按参数跳过服务启动。'; return }
$pidFile = Join-Path $DataRoot 'server.pid'
$running = $false
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
  $running = ($health.service -eq 'wps-rfq-addin')
} catch { $running = $false }
if ($running) { Write-Step "本插件服务已在运行（端口$Port），不重复启动。" }
else {
  $server = Join-Path $AppDir 'dev\server.cjs'
  if (-not (Test-Path -LiteralPath $server)) { throw "插件目录缺少dev\server.cjs，未启动服务。" }
  $process = Start-Process -FilePath 'node' -ArgumentList @($server,'--port',"$Port") -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding UTF8
  Write-Step "已以隐藏窗口启动服务，进程号$($process.Id)。"
}
if (-not $SkipHealthCheck) {
  $ready = $false
  for ($i = 0; $i -lt 20 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
      $ready = ($health.service -eq 'wps-rfq-addin')
    } catch { $ready = $false }
  }
  if (-not $ready) { throw "服务未在20秒内就绪，请手动运行：node `"$AppDir\dev\server.cjs`" --port $Port" }
  Write-Step '服务健康检查通过。'
}
Write-Step '安装完成。若WPS表格已打开，请重启WPS后从“项目询价”功能区打开侧栏。'
