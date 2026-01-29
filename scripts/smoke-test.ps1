Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Always dot-source from *this file's* directory (robust no matter where you run it)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here "ps\_utils.ps1")

Write-Host "=== MicroCourse Backend Smoke Test ===" -ForegroundColor Cyan

# Prefer SMOKE_BASEURL, fall back to localhost
$BaseUrl = $env:SMOKE_BASEURL
if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $BaseUrl = "http://localhost:4000" }
$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host ("BaseUrl: {0}" -f $BaseUrl) -ForegroundColor Cyan

# ---- Health (warmup + check) ----
Write-Section "GET health (warmup + check)"

$healthUris = @(
  "$BaseUrl/health",
  "$BaseUrl/api/health"
)

# Warm Render free instances: longer timeout + retries
$timeout = 60
$tries = 12
$delay = 5

$codes = @{}
foreach ($u in $healthUris) { $codes[$u] = -1 }

for ($i=1; $i -le $tries; $i++) {
  foreach ($u in $healthUris) {
    $code = Invoke-HttpStatus -Uri $u -TimeoutSec $timeout
    $codes[$u] = $code
    Write-Info ("[try {0}] {1} => {2}" -f $i, $u.Replace($BaseUrl,""), $code)

    if ($code -ge 200 -and $code -lt 500) {
      # 2xx/3xx is healthy; 4xx means server is up but route missing/auth/etc.
      # Either way, server responded, so we can proceed.
      break
    }
  }

  if ($codes.Values | Where-Object { $_ -ge 200 -and $_ -lt 500 }) { break }
  Start-Sleep -Seconds $delay
}

if (-not ($codes.Values | Where-Object { $_ -ge 200 -and $_ -lt 500 })) {
  $summary = ($codes.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key.Replace($BaseUrl,""), $_.Value }) -join ", "
  throw ("No healthy endpoint yet. {0}" -f $summary)
}

Write-Ok "Server responds to health checks (2xx/3xx) or at least returns 4xx (server reachable)."

# ---- Courses ping (optional) ----
Write-Section "GET /api/courses (optional)"
$codeCourses = Invoke-HttpStatus -Uri "$BaseUrl/api/courses" -TimeoutSec 60
Write-Info ("/api/courses status => {0}" -f $codeCourses)

Write-Ok "SMOKE PASS ✅"
exit 0
