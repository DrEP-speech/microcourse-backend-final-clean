# scripts/doctor.prod.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$BaseUrl,
  [int]$WarmupTimeoutSec = 75,
  [int]$WarmupAttempts = 4,
  [int]$TimeoutSec = 25,
  [int]$Attempts = 1
)

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Fail([string]$Message, [int]$Code = 2) {
  Write-Host ""
  Write-Host "✘ $Message" -ForegroundColor Red
  exit $Code
}

function Normalize-BaseUrl([string]$u) {
  if ([string]::IsNullOrWhiteSpace($u)) { return $u }
  $u = $u.Trim()
  if ($u.EndsWith("/")) { $u = $u.TrimEnd("/") }
  return $u
}

function Resolve-BaseUrl([string]$arg) {
  $u = $arg
  if ([string]::IsNullOrWhiteSpace($u)) { $u = $env:BASE_URL }
  $u = Normalize-BaseUrl $u
  if ([string]::IsNullOrWhiteSpace($u)) {
    Fail "BASE_URL is missing. Set `$env:BASE_URL or pass -BaseUrl."
  }
  return $u
}

function Invoke-WithRetry {
  param(
    [Parameter(Mandatory)][string]$Url,
    [int]$TimeoutSec = 20,
    [int]$Attempts = 1,
    [int]$SleepSec = 2
  )

  $last = $null
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      return Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -SkipHttpErrorCheck
    } catch {
      $last = $_
      Start-Sleep -Seconds $SleepSec
    }
  }
  throw $last
}

function Probe {
  param(
    [Parameter(Mandatory)][string]$BaseUrl,
    [Parameter(Mandatory)][string]$Path,
    [int]$TimeoutSec = 20,
    [int]$Attempts = 1
  )

  $url = "$BaseUrl$Path"
  try {
    $r = Invoke-WithRetry -Url $url -TimeoutSec $TimeoutSec -Attempts $Attempts -SleepSec 2
    "{0,-28} {1,3} {2}" -f $Path, $r.StatusCode, ($(if ($r.StatusCode -eq 401) { "PROTECTED (good)" } else { "OK" }))
  } catch {
    "{0,-28} {1,3} ERR" -f $Path, 0
  }
}

# ---- main ----
$BaseUrl = Resolve-BaseUrl $BaseUrl

Write-Section "Doctor PROD"
Write-Host "BaseUrl: $BaseUrl"

# Warm-up first (Render can sleep). /readyz is cheap + JSON + known stable.
Write-Host (Probe -BaseUrl $BaseUrl -Path "/readyz" -TimeoutSec $WarmupTimeoutSec -Attempts $WarmupAttempts)

# Now normal probes
$paths = @(
  "/health",
  "/healthz",
  "/readyz",
  "/api/health",
  "/version",
  "/api/courses/public",
  "/api/courses",
  "/api/quizzes",
  "/api/analytics/student/overview"
)

foreach ($p in $paths) {
  Write-Host (Probe -BaseUrl $BaseUrl -Path $p -TimeoutSec $TimeoutSec -Attempts $Attempts)
}

Write-Host ""
Write-Host "PROD OK" -ForegroundColor Green
