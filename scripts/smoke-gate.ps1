param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [int]$HealthTries = 20,
  [int]$SleepSec = 3,
  [int]$TimeoutSec = 20,
  [switch]$StrictReady
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Get-StatusCode([string]$Url, [int]$TimeoutSec = 20) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    return [int]$r.StatusCode
  } catch {
    # Some exceptions don't have .Response; treat as -1
    try {
      if ($_.Exception -and $_.Exception.Response -and $_.Exception.Response.StatusCode) {
        return [int]$_.Exception.Response.StatusCode
      }
    } catch {}
    return -1
  }
}

Write-Host "=== Smoke Gate ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor Cyan

# 1) Liveness: /healthz must become 200
$ok = $false
for ($i=1; $i -le $HealthTries; $i++) {
  $code = Get-StatusCode "$BaseUrl/healthz" $TimeoutSec
  Write-Host ("[try {0}] /healthz => {1}" -f $i, $code)
  if ($code -eq 200) { $ok = $true; break }
  Start-Sleep -Seconds $SleepSec
}
if (-not $ok) { throw "FAILED: /healthz never returned 200" }

# 2) Readiness: /readyz must be 200 if StrictReady is set, otherwise warn only
$ready = Get-StatusCode "$BaseUrl/readyz" $TimeoutSec
Write-Host ("/readyz => {0}" -f $ready)

if ($StrictReady) {
  if ($ready -ne 200) { throw "FAILED: /readyz not ready (expected 200)" }
  Write-Host "SMOKE GATE PASS ✅ (ready)" -ForegroundColor Green
} else {
  if ($ready -ne 200) {
    Write-Host "WARN: /readyz not ready (DB may be down). Liveness passed." -ForegroundColor Yellow
  } else {
    Write-Host "SMOKE PASS ✅ (ready)" -ForegroundColor Green
  }
}
