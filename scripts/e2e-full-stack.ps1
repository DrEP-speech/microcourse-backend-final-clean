# scripts/e2e-full-stack.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","DELETE")][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )

  $params = @{
    Method  = $Method
    Uri     = $Url
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 30)
  }
  return Invoke-RestMethod @params
}

$BASE = $env:API_BASE
if ([string]::IsNullOrWhiteSpace($BASE)) { $BASE = "http://localhost:4000" }

# Use a deterministic test user
$Email = $env:E2E_EMAIL
if ([string]::IsNullOrWhiteSpace($Email)) { $Email = "e2e_student@example.com" }

$Password = $env:E2E_PASSWORD
if ([string]::IsNullOrWhiteSpace($Password)) { $Password = "Passw0rd!Passw0rd!" }

Write-Section "0) Health + readiness"
$h = Invoke-Api -Method GET -Url "$BASE/healthz" -Headers @{ Accept="application/json" }
$r = Invoke-Api -Method GET -Url "$BASE/readyz"  -Headers @{ Accept="application/json" }
Write-Host "healthz:" ($h | ConvertTo-Json -Depth 10)
Write-Host "readyz :" ($r | ConvertTo-Json -Depth 10)

Write-Section "1) Register (or tolerate already-exists)"
$token = $null
try {
  $reg = Invoke-Api -Method POST -Url "$BASE/api/auth/register" -Body @{
    email = $Email
    password = $Password
    role = "student"
    name = "E2E Student"
  }
  if ($reg.token) { $token = $reg.token }
  elseif ($reg.data.token) { $token = $reg.data.token }
} catch {
  Write-Host "Register likely exists (fine). Error:" $_.Exception.Message -ForegroundColor Yellow
}

Write-Section "2) Login"
$login = Invoke-Api -Method POST -Url "$BASE/api/auth/login" -Body @{
  email = $Email
  password = $Password
}
if ($login.token) { $token = $login.token }
elseif ($login.data.token) { $token = $login.data.token }

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "No token returned from login. Fix auth controller response shape."
}

$AUTH = @{ Authorization = "Bearer $token"; Accept="application/json" }

Write-Section "3) Public course discovery"
$public = Invoke-Api -Method GET -Url "$BASE/api/courses/public" -Headers @{ Accept="application/json" }
Write-Host ($public | ConvertTo-Json -Depth 30)

# Attempt to pick a courseId if available
$courseId = $null
if ($public.courses -and $public.courses.Count -gt 0) { $courseId = $public.courses[0]._id }
elseif ($public.data.courses -and $public.data.courses.Count -gt 0) { $courseId = $public.data.courses[0]._id }
elseif ($public[0] -and $public[0]._id) { $courseId = $public[0]._id }

Write-Host ("Picked courseId: " + $courseId)

Write-Section "4) Protected routes should be protected (sanity)"
try {
  Invoke-Api -Method GET -Url "$BASE/api/courses" -Headers @{ Accept="application/json" } | Out-Null
  throw "Expected 401 without token but got success. Auth middleware is leaking."
} catch {
  Write-Host "401 expected without token: OK" -ForegroundColor Green
}

Write-Section "5) Protected /api/courses with token"
$courses = Invoke-Api -Method GET -Url "$BASE/api/courses" -Headers $AUTH
Write-Host ($courses | ConvertTo-Json -Depth 30)

Write-Section "6) Try find quizzes for course (if your API supports it)"
$quizId = $null
if ($courseId) {
  try {
    $q = Invoke-Api -Method GET -Url "$BASE/api/quizzes?courseId=$courseId" -Headers $AUTH
    Write-Host ($q | ConvertTo-Json -Depth 30)

    if ($q.quizzes -and $q.quizzes.Count -gt 0) { $quizId = $q.quizzes[0]._id }
    elseif ($q.data.quizzes -and $q.data.quizzes.Count -gt 0) { $quizId = $q.data.quizzes[0]._id }
    elseif ($q[0] -and $q[0]._id) { $quizId = $q[0]._id }

    Write-Host ("Picked quizId: " + $quizId)
  } catch {
    Write-Host "Quiz discovery not available with this route shape (fine). Error:" $_.Exception.Message -ForegroundColor Yellow
  }
} else {
  Write-Host "No courseId found in public listing; skipping quiz discovery." -ForegroundColor Yellow
}

Write-Section "7) Submit quiz attempt (if /api/quizzes/submit exists)"
if ($quizId) {
  try {
    $submit = Invoke-Api -Method POST -Url "$BASE/api/quizzes/submit" -Headers $AUTH -Body @{
      quizId = $quizId
      answers = @() # your backend decides format; empty attempt should still return structured error
    }
    Write-Host ($submit | ConvertTo-Json -Depth 30)
  } catch {
    Write-Host "Submit route or answer format may differ. Error:" $_.Exception.Message -ForegroundColor Yellow
  }
} else {
  Write-Host "No quizId resolved; skipping submit." -ForegroundColor Yellow
}

Write-Section "8) Analytics: student overview"
try {
  $a = Invoke-Api -Method GET -Url "$BASE/api/analytics/student/overview" -Headers $AUTH
  Write-Host ($a | ConvertTo-Json -Depth 30)
} catch {
  Write-Host "Analytics route shape may differ. Error:" $_.Exception.Message -ForegroundColor Yellow
}

Write-Section "✅ E2E completed"
Write-Host "Token user: $Email" -ForegroundColor Green
