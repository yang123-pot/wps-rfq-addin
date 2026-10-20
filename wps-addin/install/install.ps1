<#
材料整理助手本机安装（用户级）：
  1. 备份WPS的publish.xml，只增改本插件的节点，其他插件节点原样保留；
  2. 把发布文件复制到本机插件目录（不含探针、诊断和故障注入脚本）；
  3. 以隐藏窗口启动本机服务，只监听127.0.0.1，端口被其他程序占用时不启动；
  4. 升级前核对旧服务绝对脚本路径、创建时间和实际运行代码版本，身份不明时拒绝停止。
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
. (Join-Path $PSScriptRoot 'service-identity.ps1')

$pluginGuid = 'WpsRfqAddin'
$pluginUrl = "http://127.0.0.1:$Port/"
$excluded = @('host-probe.js','pane-diagnostics.js','acceptance-probe.js')
$release = @('main.js','ribbon.xml','taskpane.html','styles.css','library.html','library.css',
  'package.json','rules','src','dev','assets')
$dataSubdirs = @('imports','library','projects','headers','splits')
$nodeExe = (Get-Command node -ErrorAction Stop).Source

function Write-Step([string]$text){ Write-Host "[安装] $text" }

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

function New-RfqUniquePath([string]$base) {
  $candidate = $base
  $index = 1
  while (Test-Path -LiteralPath $candidate) {
    $candidate = "$base-$index"
    $index++
  }
  return $candidate
}

function Assert-RfqSafePaths {
  $driveRoot = [IO.Path]::GetPathRoot($script:appDir)
  $parent = Split-Path -Parent $script:appDir
  if ([string]::Compare($script:appDir, $driveRoot, $true) -eq 0 -or
      [string]::Compare($parent, $driveRoot, $true) -eq 0) {
    throw "AppDir 不能是磁盘根目录或根目录的直接子目录，拒绝操作：$script:appDir"
  }
  foreach ($reserved in @($env:USERPROFILE, $env:LOCALAPPDATA, $env:APPDATA, $env:TEMP)) {
    if ($reserved -and [string]::Compare($script:appDir, (Get-RfqFullPath $reserved '系统目录'), $true) -eq 0) {
      throw "AppDir 不能是系统/用户目录本身，拒绝操作：$script:appDir"
    }
  }
  if (Test-RfqInside $script:dataRoot $script:appDir) {
    throw "AppDir 不能包含 DataRoot，拒绝操作：$script:appDir / $script:dataRoot"
  }
  if (Test-RfqInside $script:publishPath $script:appDir) {
    throw "AppDir 不能包含 publish.xml，拒绝操作：$script:appDir"
  }
  if ([string]::Compare($script:appDir, $script:sourceDir, $true) -eq 0 -or
      (Test-RfqInside $script:appDir $script:sourceDir) -or
      (Test-RfqInside $script:sourceDir $script:appDir)) {
    throw "AppDir 与 SourceDir 不能重叠，拒绝操作：$script:appDir / $script:sourceDir"
  }
}

function Quote-RfqArgument([string]$value) {
  if ($value -match '\s' -or $value.Contains('"')) { return '"' + $value.Replace('"','\"') + '"' }
  return $value
}

function Start-RfqService([string]$reason) {
  $server = Join-Path $script:appDir 'dev\server.cjs'
  if (-not (Test-Path -LiteralPath $server -PathType Leaf)) { throw "插件目录缺少dev\server.cjs，未启动服务：$server" }
  $arguments = @(
    (Quote-RfqArgument $server), '--port', "$Port",
    '--import-directory', (Quote-RfqArgument (Join-Path $script:dataRoot 'imports')),
    '--library-directory', (Quote-RfqArgument (Join-Path $script:dataRoot 'library')),
    '--project-directory', (Quote-RfqArgument (Join-Path $script:dataRoot 'projects')),
    '--header-directory', (Quote-RfqArgument (Join-Path $script:dataRoot 'headers')),
    '--split-directory', (Quote-RfqArgument (Join-Path $script:dataRoot 'splits'))
  )
  $process = Start-Process -FilePath $nodeExe -ArgumentList $arguments -WindowStyle Hidden -PassThru
  Write-Step "$reason，已以隐藏窗口启动服务，进程号$($process.Id)。"
  return $process
}

function Write-RfqPid([int]$ProcessId) {
  $pidFile = Join-Path $script:dataRoot 'server.pid'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($pidFile, [string]$ProcessId, $utf8)
}

$sourceDir = Get-RfqFullPath $SourceDir 'SourceDir'
$appDir = Get-RfqFullPath $AppDir 'AppDir'
$dataRoot = Get-RfqFullPath $DataRoot 'DataRoot'
$publishPath = Get-RfqFullPath $PublishPath 'PublishPath'
if (-not (Test-Path -LiteralPath (Join-Path $sourceDir 'main.js') -PathType Leaf)) {
  throw "源目录不是有效的插件目录：$sourceDir"
}
Assert-RfqSafePaths

$publishExisted = Test-Path -LiteralPath $publishPath -PathType Leaf
$publishBackup = $null
$publishParent = Split-Path -Parent $publishPath
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'

function Restore-RfqRegistration {
  if ($script:publishExisted) {
    if ($script:publishBackup -and (Test-Path -LiteralPath $script:publishBackup -PathType Leaf)) {
      Copy-Item -LiteralPath $script:publishBackup -Destination $script:publishPath -Force
    }
  } elseif (Test-Path -LiteralPath $script:publishPath) {
    Remove-Item -LiteralPath $script:publishPath -Force
  }
}

function Write-RfqRegistration {
  [xml]$xml = if ($script:publishExisted) { Get-Content -LiteralPath $script:publishPath -Raw } else { '<?xml version="1.0" encoding="UTF-8"?><jsplugins></jsplugins>' }
  if (-not $xml.DocumentElement) { throw 'publish.xml没有根节点，已停止安装。' }
  $ours = @($xml.DocumentElement.ChildNodes | Where-Object {
    $_ -is [System.Xml.XmlElement] -and (
      ($_.GetAttribute('name') -eq $pluginGuid) -or
      ($_.GetAttribute('guid') -eq $pluginGuid)
    )
  })
  foreach ($node in $ours) { [void]$xml.DocumentElement.RemoveChild($node) }
  if ($ours.Count -gt 0) { Write-Step "已移除本插件旧节点 $($ours.Count) 个" }
  $node = $xml.CreateElement('jspluginonline')
  $node.SetAttribute('name', $pluginGuid)
  $node.SetAttribute('type', 'et')
  $node.SetAttribute('url', $pluginUrl)
  $node.SetAttribute('debug', '')
  $node.SetAttribute('enable', 'enable_dev')
  $node.SetAttribute('install', 'null')
  $node.SetAttribute('customDomain', '')
  [void]$xml.DocumentElement.AppendChild($node)
  $temp = Join-Path $publishParent ('.publish.xml.rfq-' + [guid]::NewGuid().ToString('N') + '.tmp')
  try {
    $xml.Save($temp)
    Move-Item -LiteralPath $temp -Destination $publishPath -Force
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
  }
}

function Copy-RfqRelease([string]$from, [string]$to) {
  $toFull = Get-RfqFullPath $to '发布暂存目录'
  foreach ($item in $release) {
    $sourceItem = Join-Path $from $item
    if (-not (Test-Path -LiteralPath $sourceItem)) { continue }
    $targetItem = Join-Path $toFull $item
    $targetFull = Get-RfqFullPath $targetItem '发布目标'
    if (-not (Test-RfqInside $targetFull $toFull)) {
      throw "发布目标越出暂存目录，拒绝复制：$targetFull"
    }
    Copy-Item -LiteralPath $sourceItem -Destination $targetFull -Recurse -Force
  }
  Get-ChildItem -LiteralPath $toFull -Recurse -File | Where-Object { $excluded -contains $_.Name } | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Step "已从发布文件移除诊断脚本：$($_.Name)"
  }
}

function Remove-RfqPath([string]$path) {
  if (Test-Path -LiteralPath $path) {
    try { Remove-Item -LiteralPath $path -Recurse -Force }
    catch { Write-Step "无法清理暂存/失败目录：$path（$($_.Exception.Message)）" }
  }
}

Write-Step "源目录：$sourceDir"
if (-not $publishExisted) { Write-Step "未找到publish.xml，将新建：$publishPath" }
if ($publishParent -and -not (Test-Path -LiteralPath $publishParent)) { New-Item -ItemType Directory -Path $publishParent -Force | Out-Null }

$previousService = $null
if (-not $SkipService) {
  $health = Get-RfqHealth -Port $Port
  if ($health) {
    $previousServer = Join-Path $appDir 'dev\server.cjs'
    $previousVersion = Get-RfqCodeVersion -NodeExe $nodeExe -ServerScript $previousServer -Root $appDir
    $check = Test-RfqServiceIdentity -Health $health -AppDir $appDir -ExpectedCodeVersion $previousVersion -NodeExe $nodeExe
    if (-not $check.Ok) {
      throw "端口$Port上的本插件服务身份无法确认：$($check.Reason)。未停止任何进程，安装未开始。"
    }
    $previousService = [pscustomobject]@{ Health = $health; CodeVersion = $previousVersion; Process = $check.Process }
    Write-Step "发现身份已核实的旧服务（进程$($check.Process.ProcessId)，代码版本$previousVersion）。"
  } elseif (Test-RfqPortListening -Port $Port) {
    throw "端口$Port已被其他程序占用（不是本插件），未停止该程序，安装未开始。"
  }
}

if ($publishExisted) {
  $publishBackup = New-RfqUniquePath "$publishPath.bak-$stamp"
  Copy-Item -LiteralPath $publishPath -Destination $publishBackup -Force
  Write-Step "已备份publish.xml：$publishBackup"
}
try {
  Write-RfqRegistration
} catch {
  Restore-RfqRegistration
  throw "写入publish.xml失败，已还原本插件注册且保留其他插件：$($_.Exception.Message)"
}
Write-Step "已写入本插件节点：$pluginUrl"

$stage = New-RfqUniquePath "$appDir.stage-$stamp"
$stageParent = Split-Path -Parent $stage
if ([string]::Compare($stageParent, (Split-Path -Parent $appDir), $true) -ne 0) {
  throw "发布暂存目录不在AppDir同一父目录，拒绝操作：$stage"
}
try {
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  Copy-RfqRelease $sourceDir $stage
} catch {
  Remove-RfqPath $stage
  Restore-RfqRegistration
  throw "复制发布文件失败，已还原本插件注册且保留其他插件：$($_.Exception.Message)"
}

$versionServer = Join-Path $appDir 'dev\server.cjs'
$newCodeVersion = Get-RfqCodeVersion -NodeExe $nodeExe -ServerScript $versionServer -Root $stage
if (-not $newCodeVersion) {
  $newCodeVersion = Get-RfqCodeVersion -NodeExe $nodeExe -ServerScript (Join-Path $stage 'dev\server.cjs') -Root $stage
}
if (-not $newCodeVersion) {
  Remove-RfqPath $stage
  Restore-RfqRegistration
  throw '无法计算新代码版本（服务不支持--code-version或文件不可读），已回退注册。'
}

if (-not (Test-Path -LiteralPath $dataRoot)) { New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null }
foreach ($name in $dataSubdirs) {
  $directory = Join-Path $dataRoot $name
  if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
}
Write-Step "用户数据目录（安装、升级与卸载都不删除）：$dataRoot"

$codeBackup = $null
$hadApp = Test-Path -LiteralPath $appDir
$oldStopped = $false
$newMoved = $false
$newProcess = $null
try {
  if (-not $SkipService -and $previousService) {
    $recheck = Test-RfqServiceIdentity -Health $previousService.Health -AppDir $appDir -ExpectedCodeVersion $previousService.CodeVersion -NodeExe $nodeExe
    if (-not $recheck.Ok) { throw "停止前旧服务身份发生变化：$($recheck.Reason)" }
    Stop-Process -Id ([int]$previousService.Process.ProcessId) -Force
    if (-not (Wait-RfqProcessGone -ProcessId ([int]$previousService.Process.ProcessId))) {
      throw "旧服务进程$($previousService.Process.ProcessId)未在5秒内退出。"
    }
    $oldStopped = $true
    Write-Step "已停止身份核实的旧服务进程$($previousService.Process.ProcessId)。"
  }

  if ($hadApp) {
    $codeBackup = New-RfqUniquePath "$appDir.bak-$stamp"
    Move-Item -LiteralPath $appDir -Destination $codeBackup
    Write-Step "已备份旧程序目录：$codeBackup"
  }
  Move-Item -LiteralPath $stage -Destination $appDir
  $newMoved = $true
  Write-Step "发布文件已复制到：$appDir"

  if (-not $SkipService) {
    $newProcess = Start-RfqService '安装/升级'
    if (-not $SkipHealthCheck) {
      $newHealth = Wait-RfqHealth -Port $Port -TimeoutSeconds 20
      $newCheck = Test-RfqServiceIdentity -Health $newHealth -AppDir $appDir -ExpectedCodeVersion $newCodeVersion -NodeExe $nodeExe
      if (-not $newCheck.Ok -or [int]$newHealth.pid -ne [int]$newProcess.Id) {
        $reason = if ($newCheck.Ok) { "健康响应进程号$($newHealth.pid)与启动进程$($newProcess.Id)不一致" } else { $newCheck.Reason }
        throw "新服务未通过身份核对：$reason"
      }
      Write-RfqPid ([int]$newProcess.Id)
      Write-Step "服务健康检查通过，运行代码版本$newCodeVersion。"
    } else {
      Write-RfqPid ([int]$newProcess.Id)
    }
  }
} catch {
  $failure = $_
  $restored = -not $hadApp
  if ($newProcess) {
    Stop-Process -Id ([int]$newProcess.Id) -Force -ErrorAction SilentlyContinue
    [void](Wait-RfqProcessGone -ProcessId ([int]$newProcess.Id) -TimeoutMilliseconds 3000)
  }
  Remove-RfqPath $stage
  if ($newMoved -or (-not $hadApp -and (Test-Path -LiteralPath $appDir))) {
    try {
      Remove-Item -LiteralPath $appDir -Recurse -Force
      $restored = -not (Test-Path -LiteralPath $appDir)
    }
    catch {
      $failedDir = New-RfqUniquePath "$appDir.failed-$stamp"
      try {
        Move-Item -LiteralPath $appDir -Destination $failedDir -Force
        Write-Step "新程序目录无法删除，已移到：$failedDir"
      } catch {
        Write-Step "新程序目录既不能删除也不能移走：$appDir（$($_.Exception.Message)）"
      }
    }
  }
  if ($codeBackup -and (Test-Path -LiteralPath $codeBackup)) {
    try {
      Move-Item -LiteralPath $codeBackup -Destination $appDir -Force
      $restored = $true
      Write-Step "已回退旧程序目录：$codeBackup"
    } catch {
      $restored = $false
      Write-Step "旧程序目录回退失败，请手动恢复：$codeBackup → $appDir（$($_.Exception.Message)）"
    }
  }
  if ($hadApp -and (-not $codeBackup -or -not (Test-Path -LiteralPath $codeBackup))) {
    $restored = Test-Path -LiteralPath $appDir
  }
  try {
    Restore-RfqRegistration
    Write-Step '已还原本插件注册；其他插件节点保持备份前内容。'
  } catch {
    Write-Step "本插件注册还原失败，请用备份手动恢复：$publishBackup（$($_.Exception.Message)）"
  }

  if ($oldStopped -and $previousService -and $restored) {
    try {
      $oldProcess = Start-RfqService '回退后恢复旧服务'
      $oldHealth = Wait-RfqHealth -Port $Port -TimeoutSeconds 20
      $oldCheck = Test-RfqServiceIdentity -Health $oldHealth -AppDir $appDir -ExpectedCodeVersion $previousService.CodeVersion -NodeExe $nodeExe
      if (-not $oldCheck.Ok) { throw $oldCheck.Reason }
      Write-RfqPid ([int]$oldProcess.Id)
      Write-Step "旧服务已恢复（进程$($oldProcess.Id)，代码版本$($previousService.CodeVersion)）。"
    } catch {
      Write-Step "旧服务自动恢复失败，请手动运行：node `"$appDir\dev\server.cjs`" --port $Port"
      Write-Step "恢复失败原因：$($_.Exception.Message)"
    }
  } elseif ($oldStopped -and $previousService) {
    Write-Step "旧服务未自动重启：程序目录未确认恢复到旧代码，请先手动恢复 $codeBackup 后再启动。"
  }
  throw "安装失败，已回退注册和代码：$($failure.Exception.Message)"
}

if ($SkipService) { Write-Step '按参数跳过服务启动。' }
Write-Step '安装完成。若WPS表格已打开，请重启WPS后从“材料整理”功能区打开材料整理助手。'
