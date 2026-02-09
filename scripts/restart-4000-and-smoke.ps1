Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Kill-Port([int]$Port) {
  Write-Section "Killing processes on port $Port"

  $pids = @()

  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop | Where-Object { $_.State -in @("Listen","Established") }
    $pids += $conns | Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    $lines = netstat -ano | Select-String -Pattern "[:]\b$Port\b"
    foreach ($m in $lines) {
      $line = ($m.Line -replace "\s+", " ").Trim()
      $parts = $line.Split(" ")
      if ($parts.Count -ge 5) {
        $pid = $parts[-1]
        if ($pid -match "^\d+$") { $pids += [int]$pid }
      }
    }
    $pids = $pids | Select-Object -Unique
  }

  if (-not $pids -or $pids.Count -eq 0) {
    Write-Host "No processes found using port $Port." -ForegroundColor DarkGray
    return
  }

  foreach ($pid in $pids) {
    try {
      Write-Host "Stopping PID ${pid} ..." -ForegroundColor Yellow
      Stop-Process -Id $pid -Force -ErrorAction Stop
    } catch {
      Write-Host "Could not kill PID ${pid}: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

function Wait-HttpOk([string]$Url, [int]$Retries = 40, [int]$DelayMs = 500) {
  Write-Section "Waiting for HTTP 200: $Url"
  for ($i = 1; $i -le $Retries; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
        Write-Host "OK ($($r.StatusCode)) on attempt $i" -ForegroundColor Green
        return $true
      }
    } catch { }
    Start-Sleep -Milliseconds $DelayMs
  }
  return $false
}

Write-Section "Restart backend on :4000"
Kill-Port 4000

Write-Section "Start server (npm run dev)"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" -WorkingDirectory (Get-Location)

if (-not (Wait-HttpOk "http://localhost:4000/healthz")) {
  throw "Backend did not become healthy at http://localhost:4000/healthz"
}

Write-Section "Run smoke"
npm run smoke