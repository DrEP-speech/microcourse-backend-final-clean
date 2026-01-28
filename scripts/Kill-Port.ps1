function Kill-Port {
  param([Parameter(Mandatory=$true)][int]$Port)

  $ErrorActionPreference = "SilentlyContinue"
  $lines = netstat -ano | Select-String "LISTENING" | Select-String ":\b$Port\b"
  $pids = @()

  foreach ($line in $lines) {
    $parts = ($line -split "\s+") | Where-Object { $_ -ne "" }
    $procId = $parts[-1]
    if ($procId -match "^\d+$") { $pids += [int]$procId }
  }

  $pids = $pids | Select-Object -Unique
  if (-not $pids -or $pids.Count -eq 0) {
    Write-Host "✅ Port $Port is not listening." -ForegroundColor Green
    return
  }

  foreach ($id in $pids) {
    try {
      $p = Get-Process -Id $id -ErrorAction Stop
      Write-Host "Killing PID $id ($($p.ProcessName)) on port $Port..." -ForegroundColor Yellow
      Stop-Process -Id $id -Force
    } catch {
      Write-Host "⚠️ Could not kill PID $id (maybe already gone)." -ForegroundColor DarkYellow
    }
  }

  Start-Sleep -Milliseconds 200
  Write-Host "✅ Port $Port should now be free." -ForegroundColor Green
}

