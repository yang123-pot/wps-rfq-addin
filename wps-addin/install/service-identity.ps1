# 本插件本机服务的身份核对。PID 文件只是候选，不能单独授权停止进程。

function Get-RfqHealth {
  param([int]$Port)
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
    if ($health -and $health.service -eq 'wps-rfq-addin') { return $health }
  } catch { }
  return $null
}

function Test-RfqPortListening {
  param([int]$Port)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $pending.AsyncWaitHandle.WaitOne(500)) { return $false }
    $client.EndConnect($pending)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-RfqProcessInfo {
  param([int]$ProcessId)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  $creation = $null
  try {
    if ($process.CreationDate) {
      if ($process.CreationDate -is [DateTime]) {
        $creation = $process.CreationDate.ToUniversalTime()
      } else {
        $creation = [Management.ManagementDateTimeConverter]::ToDateTime([string]$process.CreationDate).ToUniversalTime()
      }
    }
  } catch { $creation = $null }
  return [pscustomobject]@{
    ProcessId = [int]$process.ProcessId
    CommandLine = $process.CommandLine
    CreationTime = $creation
  }
}

function Get-RfqCommandScript {
  param([string]$CommandLine)
  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $null }
  $match = [regex]::Match($CommandLine, '(?i)(?:"([^"]*?server\.cjs)"|([^\s"]+server\.cjs))')
  if (-not $match.Success) { return $null }
  $raw = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
  if (-not [IO.Path]::IsPathRooted($raw)) { return $null }
  try { return [IO.Path]::GetFullPath($raw) } catch { return $null }
}

function Get-RfqCodeVersion {
  param(
    [string]$NodeExe,
    [string]$ServerScript,
    [string]$Root
  )
  if (-not (Test-Path -LiteralPath $ServerScript -PathType Leaf)) { return $null }
  try {
    $output = & $NodeExe $ServerScript --code-version $Root 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $value = ($output | Out-String).Trim()
    if ($value -match '^[a-f0-9]{64}$') { return $value }
  } catch { }
  return $null
}

function Test-RfqServiceIdentity {
  param(
    $Health,
    [string]$AppDir,
    [string]$ExpectedCodeVersion,
    [string]$NodeExe
  )
  $fail = { param($reason) return [pscustomobject]@{ Ok = $false; Reason = $reason; Process = $null } }
  if (-not $Health) { return (& $fail '没有健康响应') }
  if (-not $Health.scriptPath) { return (& $fail '健康响应没有报告绝对脚本路径') }
  if (-not $Health.pid -or [int]$Health.pid -le 0) { return (& $fail '健康响应没有报告服务进程号') }
  $server = [IO.Path]::GetFullPath((Join-Path $AppDir 'dev\server.cjs'))
  if ([string]::Compare([string]$Health.scriptPath, $server, $true) -ne 0) {
    return (& $fail "运行脚本路径不是本插件目录：$($Health.scriptPath)")
  }
  if ($Health.appDir -and [string]::Compare([string]$Health.appDir, [IO.Path]::GetFullPath($AppDir), $true) -ne 0) {
    return (& $fail "运行目录不是本插件目录：$($Health.appDir)")
  }
  $process = Get-RfqProcessInfo -ProcessId ([int]$Health.pid)
  if (-not $process) { return (& $fail "进程$($Health.pid)不存在") }
  if ([string]::IsNullOrWhiteSpace($process.CommandLine)) {
    return (& $fail "进程$($process.ProcessId)命令行不可读，身份未知")
  }
  $commandScript = Get-RfqCommandScript -CommandLine $process.CommandLine
  if (-not $commandScript -or [string]::Compare($commandScript, $server, $true) -ne 0) {
    return (& $fail "进程$($process.ProcessId)命令行不是本插件绝对脚本路径")
  }
  if (-not $process.CreationTime) {
    return (& $fail "进程$($process.ProcessId)创建时间不可读")
  }
  $started = $null
  try {
    if ($Health.startedAt -is [DateTimeOffset]) {
      $started = $Health.startedAt.UtcDateTime
    } elseif ($Health.startedAt -is [DateTime]) {
      $started = $Health.startedAt.ToUniversalTime()
    } else {
      $started = [DateTimeOffset]::Parse([string]$Health.startedAt).UtcDateTime
    }
  } catch { $started = $null }
  if (-not $started) { return (& $fail '健康响应没有可比较的启动时间') }
  if ([math]::Abs(($process.CreationTime - $started).TotalSeconds) -gt 5) {
    return (& $fail "进程创建时间与服务报告不一致（$($process.CreationTime.ToString('o')) / $($Health.startedAt)）")
  }
  if (-not $ExpectedCodeVersion) {
    return (& $fail '无法计算本插件当前运行代码版本')
  }
  if (-not $Health.codeVersion -or [string]::Compare([string]$Health.codeVersion, $ExpectedCodeVersion, $true) -ne 0) {
    return (& $fail "运行代码版本与安装目录不一致（运行=$($Health.codeVersion) 目录=$ExpectedCodeVersion）")
  }
  return [pscustomobject]@{ Ok = $true; Reason = ''; Process = $process }
}

function Wait-RfqProcessGone {
  param([int]$ProcessId, [int]$TimeoutMilliseconds = 5000)
  $until = (Get-Date).AddMilliseconds($TimeoutMilliseconds)
  while ((Get-Date) -lt $until) {
    if (-not (Get-RfqProcessInfo -ProcessId $ProcessId)) { return $true }
    Start-Sleep -Milliseconds 100
  }
  return -not [bool](Get-RfqProcessInfo -ProcessId $ProcessId)
}

function Wait-RfqHealth {
  param([int]$Port, [int]$TimeoutSeconds = 20)
  $until = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $until) {
    $health = Get-RfqHealth -Port $Port
    if ($health) { return $health }
    Start-Sleep -Milliseconds 250
  }
  return $null
}
