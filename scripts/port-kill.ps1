# scripts/port-kill.ps1
# Kill any process listening on a TCP port (Windows).
param(
  [Parameter(Mandatory=$false)]
  [int]$Port = 4000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "🔎 Checking port $Port ..." -ForegroundColor Cyan

# IMPORTANT: do NOT use $PID (reserved). Use $pidsFound.
[int[]]$pidsFound = @()

try {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($null -ne $conns) {
    $pidsFound = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
  }
} catch {
  # fallback
}

if (-not $pidsFound -or $pidsFound.Count -eq 0) {
  # fallback parse
  $lines = netstat -ano | Select-String -Pattern "LISTENING\s+.*:$Port\s"
  if ($lines) {
    $pidsFound = @(
      $lines | ForEach-Object { ($_ -split "\s+")[-1] } |
      Where-Object { $_ -match "^\d+$" } |
      ForEach-Object { [int]$_ } |
      Select-Object -Unique
    )
  }
}

if (-not $pidsFound -or $pidsFound.Count -eq 0) {
  Write-Host "✅ Port $Port is already free." -ForegroundColor Green
  exit 0
}

Write-Host "⚠ Port $Port in use by PID(s): $($pidsFound -join ', ')" -ForegroundColor Yellow

foreach ($procId in $pidsFound) {
  try {
    Write-Host "🧨 Killing PID $procId (holding port $Port)..." -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction Stop
  } catch {
    Write-Host ("⚠ Could not stop PID {0}: {1}" -f $procId, $_.Exception.Message) -ForegroundColor Yellow
  }
}

Start-Sleep -Milliseconds 400
Write-Host "✅ Port $Port is now free (or attempted)." -ForegroundColor Green