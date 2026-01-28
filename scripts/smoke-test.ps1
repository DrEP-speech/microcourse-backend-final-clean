param(
  [string]$BaseUrl = "http://localhost:4000",
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"

function Fail($msg) {
  Write-Host "SMOKE FAIL: $msg" -ForegroundColor Red
  exit 1
}

function Wait-ForHealth {
  param([string]$Url, [int]$TimeoutSec)

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $h = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 5
      if ($h.ok -eq $true) { return $h }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  Fail "Health endpoint not ready within $TimeoutSec sec: $Url"
}

function Assert($cond, $msg) {
  if (-not $cond) { Fail $msg }
}

Write-Host "`n=== MicroCourse Backend Smoke Test ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor DarkCyan

# 1) Health
$healthUrl = "$BaseUrl/api/health"
Write-Host "`nGET /api/health" -ForegroundColor Yellow
$health = Wait-ForHealth -Url $healthUrl -TimeoutSec $TimeoutSec
Assert ($health.status -eq "up") "Expected health.status == 'up' but got: $($health.status)"

# 2) Courses ping
Write-Host "`nGET /api/courses/ping" -ForegroundColor Yellow
$ping = Invoke-RestMethod -Uri "$BaseUrl/api/courses/ping" -Method GET -TimeoutSec 10
Assert ($ping.ok -eq $true) "Expected ping.ok == true"
Assert ($ping.route -eq "courses") "Expected ping.route == 'courses' but got: $($ping.route)"

# 3) Courses list
Write-Host "`nGET /api/courses" -ForegroundColor Yellow
$coursesResp = Invoke-RestMethod -Uri "$BaseUrl/api/courses" -Method GET -TimeoutSec 10
Assert ($coursesResp.ok -eq $true) "Expected coursesResp.ok == true"
Assert ($null -ne $coursesResp.courses) "Expected coursesResp.courses array"
Assert ($coursesResp.courses.Count -ge 1) "Expected at least 1 course, got: $($coursesResp.courses.Count)"

# 4) Schema sanity (lightweight but meaningful)
$first = $coursesResp.courses[0]
Assert ($null -ne $first._id) "First course missing _id"
Assert ([string]::IsNullOrWhiteSpace($first.title) -eq $false) "First course missing title"
Assert ([string]::IsNullOrWhiteSpace($first.description) -eq $false) "First course missing description"

Write-Host "`nSMOKE PASS ✅" -ForegroundColor Green
exit 0