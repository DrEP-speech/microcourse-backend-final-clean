Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$BaseUrl = $env:BASE_URL,
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
  Write-Host "✖ $Message" -ForegroundColor Red
  exit $Code
}

function Invoke-WithRetry {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$Attempts = 1,
    [int]$TimeoutSec = 20,
    [int]$SleepSec = 2
  )

  $last = $null
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      return Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -SkipHttpErrorCheck
    } catch {
      $last = $_
      if ($i -lt $Attempts) { Start-Sleep -Seconds $SleepSec }
    }
  }
  throw $last
}

function Probe {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$TimeoutSec = 20,
    [int]$Attempts = 1
  )

  $url = "$BaseUrl$Path"
  try {
    $r = Invoke-WithRetry -Url $url -Attempts $Attempts -TimeoutSec $TimeoutSec -SleepSec 2
    "{0,-30} {1,3} {2}" -f $Path, $r.StatusCode, ($(if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { "OK" } else { "ERR" }))
  } catch {
    "{0,-30} {1,3} ERR" -f $Path, 0
  }
}

# ---- Guards ----
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  Fail "BASE_URL is missing. Set `$env:BASE_URL or pass -BaseUrl."
}

# normalize trailing slash
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Section "Doctor PROD"
Write-Host ("BaseUrl: {0}" -f $BaseUrl)

# 2) Warmup: Render can sleep; first hit needs retries/longer timeout.
# Use /readyz first because it's light + proven stable.
Probe -Path "/readyz" -TimeoutSec $WarmupTimeoutSec -Attempts $WarmupAttempts | Write-Host

# 3) Normal probes (service is awake now)
@(
  "/health",
  "/healthz",
  "/readyz",
  "/api/health",
  "/version",
  "/api/courses/public",
  "/api/courses",
  "/api/quizzes",
  "/api/analytics/student/overview"
) | ForEach-Object {
  Probe -Path $_ -TimeoutSec $TimeoutSec -Attempts $Attempts | Write-Host
}

Write-Host ""
Write-Host "PROD OK" -ForegroundColor Green
exit 0
