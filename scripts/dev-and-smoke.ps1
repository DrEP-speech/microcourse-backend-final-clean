Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Starting server in background..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden

try {
  $base = $env:SMOKE_BASEURL
  if ([string]::IsNullOrWhiteSpace($base)) { $base = "http://localhost:4000" }
  $base = $base.Trim().TrimEnd("/")

  Write-Host ("Waiting for health at {0}/api/health ..." -f $base) -ForegroundColor Cyan

  $ok = $false
  for ($i=0; $i -lt 40; $i++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri "$base/api/health"
      if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  if (-not $ok) {
    throw "Server did not become healthy in time."
  }

  Write-Host "Server healthy. Running smoke..." -ForegroundColor Green
  pwsh -NoProfile -ExecutionPolicy Bypass -File ".\scripts\smoke-test.ps1"
}
finally {
  if ($proc -and -not $proc.HasExited) {
    Write-Host "Stopping server..." -ForegroundColor Yellow
    Stop-Process -Id $proc.Id -Force
  }
}
