param(
  [string]$BaseUrl = $(if ($env:SMOKE_BASEURL) { $env:SMOKE_BASEURL } else { "http://localhost:4000" })
)

function Fail($msg) {
  Write-Host "`nSMOKE FAIL: $msg" -ForegroundColor Red
  exit 1
}

function Ok($msg) {
  Write-Host $msg -ForegroundColor Green
}

function Info($msg) {
  Write-Host $msg -ForegroundColor Cyan
}

function CallJson($method, $url, $body=$null, $headers=$null) {
  try {
    if ($null -ne $body) {
      return Invoke-RestMethod -Method $method -Uri $url -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 20) -Headers $headers
    } else {
      return Invoke-RestMethod -Method $method -Uri $url -Headers $headers
    }
  } catch {
    Fail("$method $url => $($_.Exception.Message)")
  }
}

Write-Host "=== MicroCourse Backend Smoke Test ===" -ForegroundColor Cyan
Write-Host ("BaseUrl: {0}" -f $BaseUrl) -ForegroundColor Cyan

# 1) Health
Info "`nGET /api/health"
$health = CallJson "GET" "$BaseUrl/api/health"
if (-not $health.ok) { Fail("health.ok not true") }
Ok "ok health"

# 2) Courses ping
Info "`nGET /api/courses/ping"
$cp = CallJson "GET" "$BaseUrl/api/courses/ping"
if (-not $cp.ok) { Fail("courses ping failed") }
Ok "ok courses/ping"

# 3) Courses list
Info "`nGET /api/courses"
$courses = CallJson "GET" "$BaseUrl/api/courses"
if (-not $courses.ok) { Fail("courses list failed") }
Ok ("ok courses (count: {0})" -f ($courses.courses | Measure-Object | Select-Object -ExpandProperty Count))

# 4) Auth (optional but strongly recommended)
if ($env:SMOKE_EMAIL -and $env:SMOKE_PASSWORD) {
  Info "`nPOST /api/auth/login"
  $loginBody = @{ email = $env:SMOKE_EMAIL; password = $env:SMOKE_PASSWORD }
  $login = CallJson "POST" "$BaseUrl/api/auth/login" $loginBody

  if (-not $login.token) { Fail("login token missing") }
  Ok "ok auth/login"

  $headers = @{ Authorization = "Bearer $($login.token)" }

  Info "`nGET /api/auth/me"
  $me = CallJson "GET" "$BaseUrl/api/auth/me" $null $headers
  if (-not $me.ok) { Fail("auth/me failed") }
  Ok ("ok auth/me (user: {0})" -f ($me.user.email))

  Info "`nPOST /api/auth/logout"
  $lo = CallJson "POST" "$BaseUrl/api/auth/logout" $null $headers
  if (-not $lo.ok) { Fail("auth/logout failed") }
  Ok "ok auth/logout"
}
else {
  Write-Host "`n(Auth checks skipped: set SMOKE_EMAIL and SMOKE_PASSWORD)" -ForegroundColor Yellow
}

Write-Host "`nSMOKE PASS ✅" -ForegroundColor Green
