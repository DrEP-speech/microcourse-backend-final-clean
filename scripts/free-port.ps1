param([int]$Port = 10003)

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1 LocalPort, OwningProcess, State

if (-not $listener) { Write-Host "No listener on $Port"; exit 0 }

$targetPid = $listener.OwningProcess
if ($targetPid -eq $PID) {
  Write-Host "Refusing to kill current shell (PID $PID) on port $Port." -ForegroundColor Red
  exit 1
}

$proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
Write-Host ("Killing PID {0} ({1}) on port {2}..." -f $targetPid, ($proc.ProcessName), $Port)
Stop-Process -Id $targetPid -Force
Write-Host "Done."
