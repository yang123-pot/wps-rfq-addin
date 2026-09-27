<#
卸载本机WPS询价插件：
  1. 只停止本插件的服务进程（按pid文件与命令行双重确认，不杀陌生进程）；
  2. 只移除publish.xml里本插件的节点，其他插件节点原样保留；
  3. 默认保留项目、分类库、抬头模板等用户数据，并说明位置。
#>
param(
  [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin\app'),
  [string]$PublishPath = (Join-Path $env:APPDATA 'kingsoft\wps\jsaddons\publish.xml'),
  [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin'),
  [int]$Port = 38891,
  [switch]$RemoveAppDir,
  [switch]$SkipStopService
)
$ErrorActionPreference = 'Stop'
$pluginGuid = 'WpsRfqAddin'
function Write-Step([string]$text){ Write-Host "[卸载] $text" }

if (-not $SkipStopService) {
  $pidFile = Join-Path $DataRoot 'server.pid'
  $targets = @()
  if (Test-Path -LiteralPath $pidFile) {
    $value = (Get-Content -LiteralPath $pidFile -Raw).Trim()
    if ($value -match '^\d+$') {
      $candidate = Get-Process -Id ([int]$value) -ErrorAction SilentlyContinue
      if ($candidate) { $targets += $candidate }
    }
  }
  foreach ($process in $targets) {
    $commandLine = ''
    try { $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)").CommandLine } catch { $commandLine = '' }
    if ($commandLine -and $commandLine -notmatch 'server\.cjs') {
      Write-Step "进程$($process.Id)命令行与本插件不符，未终止：$commandLine"
      continue
    }
    Stop-Process -Id $process.Id -Force
    Write-Step "已停止本插件服务进程$($process.Id)。"
  }
  if ($targets.Count -eq 0) { Write-Step '没有找到本插件服务进程，跳过。' }
  if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
}

if (Test-Path -LiteralPath $PublishPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item -LiteralPath $PublishPath -Destination "$PublishPath.bak-$stamp" -Force
  [xml]$xml = Get-Content -LiteralPath $PublishPath -Raw
  $ours = @($xml.DocumentElement.ChildNodes | Where-Object {
    $_ -is [System.Xml.XmlElement] -and (
      ($_.GetAttribute('name') -eq $pluginGuid) -or
      ($_.GetAttribute('guid') -eq $pluginGuid)
    )
  })
  foreach ($node in $ours) { [void]$xml.DocumentElement.RemoveChild($node) }
  $xml.Save($PublishPath)
  Write-Step "已从publish.xml移除本插件节点 $($ours.Count) 个，其他插件节点未改动。"
} else {
  Write-Step "未找到publish.xml，跳过注册清理：$PublishPath"
}

if ($RemoveAppDir) {
  if (Test-Path -LiteralPath $AppDir) {
    $resolved = (Resolve-Path -LiteralPath $AppDir).Path
    if ($resolved -eq (Join-Path $env:LOCALAPPDATA 'WpsRfqAddin\app')) {
      Remove-Item -LiteralPath $resolved -Recurse -Force
      Write-Step "已删除插件程序目录：$resolved"
    } else {
      throw "程序目录路径不是预期位置，未删除：$resolved"
    }
  }
} else { Write-Step "按要求保留插件程序目录：$AppDir" }

Write-Step "用户数据未删除，仍在：$DataRoot（项目、分类库与抬头模板都在这里）"
Write-Step '如WPS表格仍打开，请重启WPS使功能区变更生效。'
