param(
  [int]$Port = 4000
)

$ErrorActionPreference = "Stop"

function Get-PidsByPort {
  param([int]$p)

  $pids = @()

  # Try modern cmdlet first
  try {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop
    $pids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($pids.Count -gt 0) { return $pids }
  } catch { }

  # Fallback to netstat parsing
  $lines = netstat -ano | Select-String -Pattern "LISTENING" | ForEach-Object { $_.Line }
  foreach ($line in $lines) {
    # Example: TCP    0.0.0.0:4000   0.0.0.0:0   LISTENING   12345
    if ($line -match ":\s*$p\s+.*LISTENING\s+(\d+)\s*$") {
      $pids += [int]$Matches[1]
    }
  }
  return @($pids | Select-Object -Unique)
}

$pids = @(Get-PidsByPort -p $Port)

if ($pids.Count -eq 0) {
  Write-Host "No LISTENING process found on port $Port" -ForegroundColor Yellow
  exit 0
}

Write-Host ("Killing process(es) on port {0}: {1}" -f $Port, ($pids -join ", ")) -ForegroundColor Cyan

foreach ($procId in $pids) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host ("Killed PID {0}" -f $procId) -ForegroundColor Green
  } catch {
    Write-Host ("Failed to kill PID {0}: {1}" -f $procId, $_.Exception.Message) -ForegroundColor Red
  }
}

exit 0
