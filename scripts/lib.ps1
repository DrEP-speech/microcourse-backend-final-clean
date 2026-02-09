Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ThisScriptDir {
  # Works inside scripts. In interactive paste, $PSScriptRoot is empty.
  if ($PSScriptRoot) { return $PSScriptRoot }
  if ($PSCommandPath) { return (Split-Path -Parent $PSCommandPath) }
  if ($MyInvocation.MyCommand.Path) { return (Split-Path -Parent $MyInvocation.MyCommand.Path) }
  return (Get-Location).Path
}

function Write-Section([Parameter(Mandatory=$true)][string]$Title) {
  Write-Host ""
  Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
}

function Stop-Port {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][int]$Port
  )

  # Always return an array.
  $killed = @()

  # Find listeners on port (TCP)
  $conns = @()
  try {
    $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
  } catch {
    # Older environments might not have Get-NetTCPConnection
    $conns = @()
  }

  foreach ($c in $conns) {
    if ($null -ne $c.OwningProcess -and $c.OwningProcess -gt 0) {
      $pidToKill = $c.OwningProcess
      try {
        Stop-Process -Id $pidToKill -Force -ErrorAction Stop
        $killed += $pidToKill
      } catch {}
    }
  }

  # Also catch node that bound IPv6 :: or other weirdness (best effort)
  # netstat fallback
  try {
    $netstat = netstat -ano | Select-String -Pattern (":$Port\s+.*LISTENING\s+(\d+)$")
    foreach ($m in $netstat.Matches) {
      $pidToKill = [int]$m.Groups[1].Value
      if ($pidToKill -gt 0 -and ($killed -notcontains $pidToKill)) {
        try {
          Stop-Process -Id $pidToKill -Force -ErrorAction Stop
          $killed += $pidToKill
        } catch {}
      }
    }
  } catch {}

  return ,$killed
}

function Wait-HttpOk {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$TimeoutSec = 30,
    [int]$IntervalMs = 500
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $r = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { return $true }
    } catch {}
    Start-Sleep -Milliseconds $IntervalMs
  }
  return $false
}

function Save-Dump {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)]$Object,
    [string]$OutDir
  )

  $here = Get-ThisScriptDir
  if (-not $OutDir) { $OutDir = (Join-Path $here "artifacts") }
  if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $path = Join-Path $OutDir ("{0}_{1}.json" -f $Name, $ts)

  $json = $Object | ConvertTo-Json -Depth 50
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $json, $utf8NoBom)

  return $path
}