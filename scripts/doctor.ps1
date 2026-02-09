Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
}

function Kill-Port([int]$Port) {
  Write-Host ("🔎 Checking port {0} ..." -f $Port) -ForegroundColor Cyan

  $lines = @(netstat -ano | Select-String -Pattern (":$Port\s") -ErrorAction SilentlyContinue)
  $pids = @()

  foreach ($l in $lines) {
    $parts = @(($l.Line -split "\s+") | Where-Object { $_ -ne "" })
    if ($parts.Count -ge 5) {
      $last = $parts[-1]
      if ($last -match '^\d+$') {
        $pids += [int]$last
      }
    }
  }

  $pids = @($pids | Sort-Object -Unique)

  if ($pids.Count -eq 0) {
    Write-Host ("✅ Port {0} is free." -f $Port) -ForegroundColor Green
    return
  }

  Write-Host ("⚠️ Port {0} in use by PID(s): {1}" -f $Port, ($pids -join ",")) -ForegroundColor Yellow

  foreach ($procId in $pids) {
    try {
      Write-Host ("🧨 Killing PID {0} (holding port {1})..." -f $procId, $Port) -ForegroundColor Yellow
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      Write-Host ("❌ Failed to kill PID {0}. {1}" -f $procId, $_.Exception.Message) -ForegroundColor Red
    }
  }

  Start-Sleep -Milliseconds 300
  Write-Host "✅ Port kill attempted." -ForegroundColor Green
}

function Invoke-Api([string]$Url) {
  try {
    # PowerShell 7+: do NOT throw on 404/401; give us StatusCode directly
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4 -SkipHttpErrorCheck
    return [int]$r.StatusCode
  } catch {
    # For true transport failures (no server, DNS, timeout), don't assume .Response exists
    return 0
  }
}

$port = 4000

Write-Section ("1) Free port {0}" -f $port)
Kill-Port $port

Write-Section ("2) Start backend clean (PORT={0})" -f $port)
$env:PORT = "$port"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c npm start"
$psi.WorkingDirectory = (Get-Location).Path
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
[void]$p.Start()

Start-Sleep -Seconds 2

Write-Section "3) Probe endpoints"
$base = "http://localhost:$port"
$paths = @(
  "/health",
  "/healthz",
  "/readyz",
  "/api",
  "/api/courses/public",
  "/api/courses",
  "/api/quizzes",
  "/api/analytics/student/overview"
)

Write-Host ("🔎 Probing {0} ..." -f $base) -ForegroundColor Cyan
foreach ($path in $paths) {
  $code = Invoke-Api ($base + $path)

  $tag =
    if ($code -eq 200) { "200 OK" }
    elseif ($code -eq 401) { "401 PROTECTED (good)" }
    elseif ($code -eq 404) { "404 NOT FOUND" }
    elseif ($code -eq 0) { "NO RESPONSE" }
    else { "$code" }

  "{0,-28} {1}" -f $path, $tag
}

Write-Host ""
Write-Host ("✅ Doctor completed. Server PID: {0}" -f $p.Id) -ForegroundColor Green
Write-Host ("Tip: Stop server with: Stop-Process -Id {0} -Force" -f $p.Id) -ForegroundColor DarkGray

