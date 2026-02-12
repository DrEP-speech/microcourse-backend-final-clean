param(
  [Parameter(Position=0)]
  [ValidateRange(1,65535)]
  [int]$Port = 4000,

  [Parameter(Position=1)]
  [ValidateRange(1,300)]
  [int]$WarmupSec = 8,

  [Parameter(Position=2)]
  [ValidateRange(1,600)]
  [int]$TimeoutSec = 12,

  [Parameter()]
  [string]$BaseUrl = "",

  [Parameter()]
  [switch]$NoKill
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Probe([string]$Url, [int]$TimeoutSec = 5) {
  try {
    $r = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
    return [pscustomobject]@{ ok=$true; code=[int]$r.StatusCode; note="OK" }
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $code = [int]$_.Exception.Response.StatusCode
      return [pscustomobject]@{ ok=($code -eq 401); code=$code; note=($code -eq 401 ? "PROTECTED (good)" : "FAIL") }
    }
    return [pscustomobject]@{ ok=$false; code=0; note="ERR" }
  }
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = "http://127.0.0.1:$Port"
}

Write-Section "Doctor preflight"
Write-Host ("BaseUrl: {0}" -f $BaseUrl)
Write-Host ("Port:    {0}" -f $Port)

Write-Section "Start server"
# Adjust this to your actual start command if needed:
# - If you use nodemon/dev: npm run dev
# - If you use node server.js: node server.js
$server = Start-Process -FilePath "npm" -ArgumentList @("run","dev") -PassThru -WindowStyle Hidden

Write-Host ("Server PID: {0}" -f $server.Id) -ForegroundColor Green
Write-Host ("Warmup: {0}s" -f $WarmupSec)
Start-Sleep -Seconds $WarmupSec

Write-Section "Health probes"
$paths = @(
  "/health",
  "/healthz",
  "/readyz",
  "/api/health",
  "/version",
  "/api",
  "/api/courses/public",
  "/api/courses",
  "/api/quizzes",
  "/api/analytics/student/overview"
)

foreach ($p in $paths) {
  $u = $BaseUrl.TrimEnd("/") + $p
  $res = Probe -Url $u -TimeoutSec $TimeoutSec
  "{0,-30} {1,3} {2}" -f $p, $res.code, $res.note | Write-Host
}

Write-Section "Done"
Write-Host ("Doctor completed. Server PID: {0}" -f $server.Id) -ForegroundColor Green
Write-Host ("Tip: Stop server with: Stop-Process -Id {0} -Force" -f $server.Id) -ForegroundColor DarkGray

if (-not $NoKill) {
  Write-Host "Stopping server (NoKill not set)..." -ForegroundColor Yellow
  try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch {}
}