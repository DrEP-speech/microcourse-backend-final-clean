# seed-onboarding.ps1 (repo root)
# Creates/ensures a student, logs in, finds/creates an onboarding course, and writes seed-artifacts.json
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  if ($null -ne $Body) {
    $json = ($Body | ConvertTo-Json -Depth 50)
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $json
  }
  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
}

function Try-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  try {
    return Invoke-Api -Method $Method -Url $Url -Headers $Headers -Body $Body
  } catch {
    return $null
  }
}

function Get-FirstId($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj.PSObject.Properties.Name -contains "_id") { return [string]$obj._id }
  if ($obj.PSObject.Properties.Name -contains "id")  { return [string]$obj.id }
  return $null
}

function Extract-Token($resp) {
  if ($null -eq $resp) { return $null }

  foreach ($k in @("token","accessToken","access_token","jwt","studentToken")) {
    if ($resp.PSObject.Properties.Name -contains $k -and -not [string]::IsNullOrWhiteSpace([string]$resp.$k)) {
      return [string]$resp.$k
    }
  }

  # sometimes nested: { data: { token } } or { user: { token } }
  foreach ($outer in @("data","user","auth")) {
    if ($resp.PSObject.Properties.Name -contains $outer) {
      $o = $resp.$outer
      foreach ($k in @("token","accessToken","jwt")) {
        if ($o -and $o.PSObject.Properties.Name -contains $k -and -not [string]::IsNullOrWhiteSpace([string]$o.$k)) {
          return [string]$o.$k
        }
      }
    }
  }

  return $null
}

function Find-Or-Create-StudentToken {
  param([string]$Base)

  # Deterministic creds (override with env if you want)
  $email = $env:STUDENT_EMAIL
  $pass  = $env:STUDENT_PASSWORD
  if ([string]::IsNullOrWhiteSpace($email)) { $email = "student.seed@microcourse.local" }
  if ([string]::IsNullOrWhiteSpace($pass))  { $pass  = "StudentSeed!12345" }

  # 1) Try login routes
  $loginBodies = @(
    @{ email=$email; password=$pass },
    @{ username=$email; password=$pass }
  )
  $loginRoutes = @(
    "$Base/auth/login",
    "$Base/auth/signin",
    "$Base/login",
    "$Base/auth/student/login"
  )

  foreach ($r in $loginRoutes) {
    foreach ($b in $loginBodies) {
      $resp = Try-Api -Method "POST" -Url $r -Body $b
      $tok = Extract-Token $resp
      if ($tok) { return @{ token=$tok; email=$email; password=$pass; route=$r } }
    }
  }

  # 2) If login fails, try register then login again
  $registerRoutes = @(
    "$Base/auth/register",
    "$Base/auth/signup",
    "$Base/register",
    "$Base/auth/student/register"
  )

  $regBody = @{
    name     = "Seed Student"
    email    = $email
    password = $pass
    role     = "student"
  }

  foreach ($r in $registerRoutes) {
    $resp = Try-Api -Method "POST" -Url $r -Body $regBody
    # Some APIs return token immediately on register
    $tok = Extract-Token $resp
    if ($tok) { return @{ token=$tok; email=$email; password=$pass; route=$r } }
  }

  # Try login again after registration attempt
  foreach ($r in $loginRoutes) {
    foreach ($b in $loginBodies) {
      $resp = Try-Api -Method "POST" -Url $r -Body $b
      $tok = Extract-Token $resp
      if ($tok) { return @{ token=$tok; email=$email; password=$pass; route=$r } }
    }
  }

  throw "Could not obtain student token. Your backend may use different auth routes/payloads."
}

function Get-Or-Create-OnboardingCourse {
  param([string]$Base, [hashtable]$Headers)

  # Try to find courses list, then pick something published/seeded
  $listRoutes = @(
    "$Base/courses",
    "$Base/course",
    "$Base/courses/published",
    "$Base/courses/all"
  )

  foreach ($r in $listRoutes) {
    $resp = Try-Api -Method "GET" -Url $r -Headers $Headers
    if ($resp) {
      # normalize to an array
      $arr = $null
      if ($resp -is [System.Collections.IEnumerable] -and -not ($resp -is [string])) { $arr = $resp }
      foreach ($k in @("courses","data","items","results")) {
        if (-not $arr -and ($resp.PSObject.Properties.Name -contains $k)) { $arr = $resp.$k }
      }
      if ($arr) {
        foreach ($c in $arr) {
          $cid = Get-FirstId $c
          if ($cid) { return @{ course=$c; courseId=$cid; via=$r } }
        }
      }
    }
  }

  # If cannot list, try create (instructor-only backends may reject; still worth probing)
  $createRoutes = @(
    "$Base/courses",
    "$Base/course"
  )

  $body = @{
    title       = "MicroCourse Forge - How to Use This App (Start Here)"
    description = "A quick onboarding course seeded for E2E testing."
    status      = "published"
    slug        = "microcourse-forge-how-to-use-this-app-start-here"
  }

  foreach ($r in $createRoutes) {
    $resp = Try-Api -Method "POST" -Url $r -Headers $Headers -Body $body
    $cid = Get-FirstId $resp
    if ($cid) { return @{ course=$resp; courseId=$cid; via=$r } }
  }

  throw "Could not find or create a course via common course routes."
}

function Try-Discover-QuizIdFromCourseOrRoutes {
  param([string]$Base, [string]$CourseId, [hashtable]$Headers, $CourseObj)

  # 1) look inside the course object first (this is the most “real backend” possibility)
  if ($CourseObj) {
    foreach ($k in @("quizId","quiz","quizzes","quizIds")) {
      if ($CourseObj.PSObject.Properties.Name -contains $k) {
        $v = $CourseObj.$k
        if ($v -is [string]) { return $v }
        $id = Get-FirstId $v
        if ($id) { return $id }
        if ($v -is [System.Collections.IEnumerable] -and $v.Count -gt 0) {
          $id = Get-FirstId $v[0]
          if ($id) { return $id }
        }
      }
    }
  }

  # 2) probe endpoints
  $candidates = @(
    "$Base/courses/$CourseId/quizzes",
    "$Base/courses/$CourseId/quiz",
    "$Base/quizzes?courseId=$CourseId",
    "$Base/quizzes/course/$CourseId",
    "$Base/quizzes/by-course/$CourseId"
  )

  foreach ($u in $candidates) {
    $resp = Try-Api -Method "GET" -Url $u -Headers $Headers
    if ($resp) {
      # try common shapes
      if ($resp -is [System.Collections.IEnumerable] -and -not ($resp -is [string])) {
        foreach ($q in $resp) { $id = Get-FirstId $q; if ($id) { return $id } }
      }
      foreach ($k in @("quizzes","data","items","results","quiz")) {
        if ($resp.PSObject.Properties.Name -contains $k) {
          $v = $resp.$k
          if ($v -is [string]) { return $v }
          $id = Get-FirstId $v
          if ($id) { return $id }
          if ($v -is [System.Collections.IEnumerable] -and $v.Count -gt 0) {
            $id = Get-FirstId $v[0]
            if ($id) { return $id }
          }
        }
      }
      $id = Get-FirstId $resp
      if ($id) { return $id }
    }
  }

  return $null
}

# ---------------- MAIN ----------------
$base = $env:API_BASE
if ([string]::IsNullOrWhiteSpace($base)) { $base = "http://localhost:4000/api" }

Write-Host "=== Seed onboarding ===" -ForegroundColor Cyan
Write-Host "API Base: $base"
Write-Host ""

# 0) Health
$h = Try-Api -Method "GET" -Url "$base/health"
if (-not $h) { throw "Backend not reachable at $base (health failed)." }
Write-Host "[OK] Health" -ForegroundColor Green

# 1) Auth - get student token
$auth = Find-Or-Create-StudentToken -Base $base
$studentToken = $auth.token
Write-Host "[OK] Student token acquired via $($auth.route)" -ForegroundColor Green

$headers = @{ Authorization = "Bearer $studentToken" }

# 2) Course
$courseWrap = Get-Or-Create-OnboardingCourse -Base $base -Headers $headers
$courseId = $courseWrap.courseId
$course   = $courseWrap.course
Write-Host "[OK] Course acquired via $($courseWrap.via): $courseId" -ForegroundColor Green

# 3) Optional quiz discovery
$quizId = Try-Discover-QuizIdFromCourseOrRoutes -Base $base -CourseId $courseId -Headers $headers -CourseObj $course
if ($quizId) {
  Write-Host "[OK] Quiz discovered: $quizId" -ForegroundColor Green
} else {
  Write-Host "[WARN] QuizId not discovered (yet). E2E will still probe." -ForegroundColor Yellow
}

# 4) Write artifacts
$artifacts = [ordered]@{
  studentToken = $studentToken
  studentEmail = $auth.email
  studentPassword = $auth.password
  courseId = $courseId
  quizId = $quizId
  apiBase = $base
  createdAt = (Get-Date).ToString("o")
}

$artifacts | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 ".\seed-artifacts.json"
Write-Host "[OK] Wrote seed artifacts -> seed-artifacts.json" -ForegroundColor Green
