<#
卸载本机WPS询价插件：
  1. 只停止身份已核实的本插件服务（绝对脚本路径、创建时间、运行代码版本；PID文件只是候选）；
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
. (Join-Path $PSScriptRoot 'service-identity.ps1')

$pluginGuid = 'WpsRfqAddin'
$nodeExe = (Get-Command node -ErrorAction Stop).Source
function Write-Step([string]$text){ Write-Host "[卸载] $text" }

function Get-RfqFullPath([string]$value, [string]$label) {
  if ([string]::IsNullOrWhiteSpace($value)) { throw "$label 不能为空。" }
  if (-not [IO.Path]::IsPathRooted($value)) { throw "$label 必须是绝对路径：$value" }
  $full = [IO.Path]::GetFullPath($value)
  if ($full.Length -gt 3) { $full = $full.TrimEnd('\') }
  return $full
}

function Test-RfqInside([string]$child, [string]$parent) {
  $childFull = Get-RfqFullPath $child '子路径'
  $parentFull = Get-RfqFullPath $parent '父路径'
  if ([string]::Compare($childFull, $parentFull, $true) -eq 0) { return $false }
  $prefix = if ($parentFull.EndsWith('\')) { $parentFull } else { $parentFull + '\' }
  return $childFull.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

$appDir = Get-RfqFullPath $AppDir 'AppDir'
$dataRoot = Get-RfqFullPath $DataRoot 'DataRoot'
$publishPath = Get-RfqFullPath $PublishPath 'PublishPath'
$driveRoot = [IO.Path]::GetPathRoot($appDir)
$appParent = Split-Path -Parent $appDir
if ([string]::Compare($appDir, $driveRoot, $true) -eq 0 -or [string]::Compare($appParent, $driveRoot, $true) -eq 0) {
  throw "AppDir 不能是磁盘根目录或根目录的直接子目录，拒绝操作：$appDir"
}
foreach ($reserved in @($env:USERPROFILE, $env:LOCALAPPDATA, $env:APPDATA, $env:TEMP)) {
  if ($reserved -and [string]::Compare($appDir, (Get-RfqFullPath $reserved '系统目录'), $true) -eq 0) {
    throw "AppDir 不能是系统/用户目录本身，拒绝操作：$appDir"
  }
}
if (Test-RfqInside $dataRoot $appDir) {
  throw "AppDir 不能包含 DataRoot，拒绝删除/操作：$appDir / $dataRoot"
}
if (Test-RfqInside $publishPath $appDir) {
  throw "AppDir 不能包含 publish.xml，拒绝操作：$appDir"
}

if ($RemoveAppDir -and (Test-Path -LiteralPath $appDir)) {
  $main = Join-Path $appDir 'main.js'
  $package = Join-Path $appDir 'package.json'
  if (-not (Test-Path -LiteralPath $main -PathType Leaf) -or -not (Test-Path -LiteralPath $package -PathType Leaf)) {
    throw "AppDir 不是完整的本插件程序目录（缺少main.js或package.json），拒绝删除：$appDir"
  }
  try {
    $packageName = (Get-Content -LiteralPath $package -Raw | ConvertFrom-Json).name
  } catch {
    throw "AppDir 的package.json不可读，拒绝删除：$appDir"
  }
  if ($packageName -ne 'wps-rfq-addin') {
    throw "AppDir 的package.json不是wps-rfq-addin，拒绝删除：$appDir"
  }
}

if (-not $SkipStopService) {
  $health = Get-RfqHealth -Port $Port
  if ($health) {
    $server = Join-Path $appDir 'dev\server.cjs'
    $expected = Get-RfqCodeVersion -NodeExe $nodeExe -ServerScript $server -Root $appDir
    $check = Test-RfqServiceIdentity -Health $health -AppDir $appDir -ExpectedCodeVersion $expected -NodeExe $nodeExe
    if (-not $check.Ok) {
      throw "拒绝停止端口$Port上的服务：$($check.Reason)。未移除本插件注册，未删除任何数据。"
    }
    Stop-Process -Id ([int]$check.Process.ProcessId) -Force
    if (-not (Wait-RfqProcessGone -ProcessId ([int]$check.Process.ProcessId))) {
      throw "本插件服务进程$($check.Process.ProcessId)未在5秒内退出。"
    }
    $pidFile = Join-Path $dataRoot 'server.pid'
    if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
    Write-Step "已停止本插件服务进程$($check.Process.ProcessId)。"
  } else {
    $pidFile = Join-Path $dataRoot 'server.pid'
    if (Test-Path -LiteralPath $pidFile) {
      $value = ([IO.File]::ReadAllText($pidFile)).Trim().TrimStart([char]0xFEFF)
      if ($value -notmatch '^\d+$') {
        Write-Step "server.pid内容无效，未停止任何进程：$value"
      } else {
        $candidate = Get-RfqProcessInfo -ProcessId ([int]$value)
        if (-not $candidate) {
          Write-Step "server.pid指向的进程$value已不存在，未停止任何进程。"
        } elseif ([string]::IsNullOrWhiteSpace($candidate.CommandLine)) {
          Write-Step "进程$value命令行不可读，身份未知，未停止。"
        } else {
          $commandScript = Get-RfqCommandScript -CommandLine $candidate.CommandLine
          $expectedServer = [IO.Path]::GetFullPath((Join-Path $appDir 'dev\server.cjs'))
          if (-not $commandScript -or [string]::Compare($commandScript, $expectedServer, $true) -ne 0) {
            Write-Step "进程$value命令行不是本插件绝对脚本路径，未停止：$($candidate.CommandLine)"
          } else {
            Write-Step "端口$Port没有健康响应，无法核对创建时间与实际运行代码版本，未停止进程$value。"
          }
        }
      }
    } else {
      Write-Step '没有找到本插件服务进程，跳过。'
    }
  }
} else {
  Write-Step '按参数跳过服务停止。'
}

if (Test-Path -LiteralPath $publishPath -PathType Leaf) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $backup = "$publishPath.bak-$stamp"
  Copy-Item -LiteralPath $publishPath -Destination $backup -Force
  [xml]$xml = Get-Content -LiteralPath $publishPath -Raw
  $ours = @($xml.DocumentElement.ChildNodes | Where-Object {
    $_ -is [System.Xml.XmlElement] -and (
      ($_.GetAttribute('name') -eq $pluginGuid) -or
      ($_.GetAttribute('guid') -eq $pluginGuid)
    )
  })
  foreach ($node in $ours) { [void]$xml.DocumentElement.RemoveChild($node) }
  $temp = Join-Path (Split-Path -Parent $publishPath) ('.publish.xml.rfq-' + [guid]::NewGuid().ToString('N') + '.tmp')
  try {
    $xml.Save($temp)
    Move-Item -LiteralPath $temp -Destination $publishPath -Force
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
  }
  Write-Step "已从publish.xml移除本插件节点 $($ours.Count) 个，其他插件节点未改动。"
} else {
  Write-Step "未找到publish.xml，跳过注册清理：$publishPath"
}

if ($RemoveAppDir) {
  if (Test-Path -LiteralPath $appDir) {
    $resolved = (Resolve-Path -LiteralPath $appDir).Path
    if (Test-RfqInside $dataRoot $resolved) {
      throw "程序目录包含用户数据，未删除：$resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
    Write-Step "已删除插件程序目录：$resolved"
  }
} else {
  Write-Step "按要求保留插件程序目录：$appDir"
}

Write-Step "用户数据未删除，仍在：$dataRoot（项目、分类库与抬头模板都在这里）"
Write-Step '如WPS表格仍打开，请重启WPS使功能区变更生效。'
