$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$logOut = Join-Path $PWD "server.out.log"
$logErr = Join-Path $PWD "server.err.log"
Remove-Item $logOut,$logErr -ErrorAction SilentlyContinue

# Prefer current PORT, then 5001, then 5000
$candidate = @($env:PORT, 5001, 5000) | Where-Object { $_ } | Select-Object -Unique
$usePort = $null
foreach ($p in $candidate) {
  try {
    $listening = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    if (-not $listening) { $usePort = [int]$p; break }
  } catch { $usePort = [int]$p; break }
}
if (-not $usePort) { $usePort = 5001 }
$env:PORT = $usePort

# Show Mongo hint if missing
if (-not $env:MONGO_URL -and -not $env:MONGODB_URI) {
  Write-Host "??  MONGO_URL/MONGODB_URI not set. Example:" -ForegroundColor Yellow
  Write-Host '   setx MONGO_URL "mongodb+srv://<user>:<pass>@<cluster>/microcourse?retryWrites=true&w=majority&appName=<AppName>"' -ForegroundColor Yellow
}

Write-Host "Starting server on :$usePort ..."
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -NoNewWindow `
  -RedirectStandardOutput $logOut -RedirectStandardError $logErr -PassThru

Write-Host "Node PID: $($proc.Id)"

$base   = "http://localhost:$usePort"
$upto   = [DateTime]::UtcNow.AddSeconds(45)  # give it more time
$healthy = $false

while([DateTime]::UtcNow -lt $upto) {
  try {
    $r = Invoke-RestMethod "$base/healthz" -TimeoutSec 2 -ErrorAction Stop
    if ($r.ok -eq $true) { $healthy = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 600
}

if ($healthy) {
  Write-Host "? Server healthy at $base" -ForegroundColor Green
} else {
  Write-Host "? Server did not become healthy within timeout." -ForegroundColor Red
  if ($proc.HasExited) {
    Write-Host "Process exited with code $($proc.ExitCode)." -ForegroundColor Red
  } else {
    Write-Host "Process still running (PID $($proc.Id)) but /healthz not OK." -ForegroundColor Yellow
  }
  Write-Host "`n--- server.err.log (last 120) ---"
  Get-Content -Tail 120 $logErr
  Write-Host "`n--- server.out.log (last 200) ---"
  Get-Content -Tail 200 $logOut
}
