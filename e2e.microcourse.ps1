#requires -Version 7.0
$ErrorActionPreference = "Stop"

# Use same base as your frontend env if present
$Base = $env:NEXT_PUBLIC_API_BASE
if (-not $Base) { $Base = "http://localhost:4000/api" }
$Base = $Base.TrimEnd("/")

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","DELETE")][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  try {
    $params = @{
      Method     = $Method
      Uri        = $Url
      Headers    = $Headers
      TimeoutSec = 20
    }

    if ($null -ne $Body) {
      $params.ContentType = "application/json"
      $params.Body = ($Body | ConvertTo-Json -Depth 30)
    }

    $data = Invoke-RestMethod @params
    [pscustomobject]@{ ok=$true; url=$Url; data=$data; status=200 }
  }
  catch {
    $status = $null
    $raw = $null
    $resp = $_.Exception.Response
    if ($resp) {
      try { $status = [int]$resp.StatusCode } catch {}
      try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $raw = $reader.ReadToEnd()
      } catch {}
    }
    [pscustomobject]@{ ok=$false; url=$Url; status=$status; error=$_.Exception.Message; raw=$raw }
  }
}

function Try-Any {
  param(
    [Parameter(Mandatory=$true)][string[]]$Urls,
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST")][string]$Method,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  foreach ($u in $Urls) {
    $r = Invoke-Api -Method $Method -Url $u -Headers $Headers -Body $Body
    if ($r.ok) { return $r }
    Write-Host "FAIL $Method $u => $($r.status) $($r.error)" -ForegroundColor DarkGray
    if ($r.raw) { Write-Host $r.raw -ForegroundColor DarkGray }
  }
  return $r
}

function Assert-Ok {
  param([Parameter(Mandatory=$true)]$Result, [string]$Name="request")
  if (-not $Result.ok) {
    throw "FAILED: $Name (`$($Result.status)) => $($Result.error) :: $($Result.raw)"
  }
}

Write-Host "== Health check ==" -ForegroundColor Cyan
$health = Invoke-Api -Method GET -Url "$Base/health"
Assert-Ok $health "health"
$health.data | Format-List

# Customer-like user identity (unique email every run)
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "demo.user+$stamp@microcourse.test"
$pw    = "Passw0rd!123"
$name  = "Demo User $stamp"

Write-Host "`n== Register ==" -ForegroundColor Cyan
$regBody = @{
  name     = $name
  email    = $email
  password = $pw
}
$regUrls = @("$Base/auth/register", "$Base/auth/signup", "$Base/register")
$reg = Try-Any -Urls $regUrls -Method POST -Body $regBody
Assert-Ok $reg "register"
$reg.data | Format-List

Write-Host "`n== Login ==" -ForegroundColor Cyan
$loginBody = @{
  email    = $email
  password = $pw
}
$loginUrls = @("$Base/auth/login", "$Base/login")
$login = Try-Any -Urls $loginUrls -Method POST -Body $loginBody
Assert-Ok $login "login"

# Normalize token key
$token = $null
if ($login.data.token) {
  $token = $login.data.token
} elseif ($login.data.accessToken) {
  $token = $login.data.accessToken
} else {
  throw "Login OK but token missing. Keys: $($login.data.PSObject.Properties.Name -join ', ')"
}

$authHeaders = @{ Authorization = "Bearer $token" }
Write-Host "Token acquired (len=$($token.Length))" -ForegroundColor Green

Write-Host "`n== Me ==" -ForegroundColor Cyan
$me = Invoke-Api -Method GET -Url "$Base/auth/me" -Headers $authHeaders
Assert-Ok $me "auth/me"
$me.data | Format-List

Write-Host "`n== List courses ==" -ForegroundColor Cyan
$courses = Try-Any -Urls @("$Base/courses", "$Base/course") -Method GET -Headers $authHeaders
Assert-Ok $courses "list courses"

# Normalize course array
$courseArray = $null
if ($courses.data.courses) { $courseArray = $courses.data.courses }
elseif ($courses.data -is [System.Collections.IEnumerable]) { $courseArray = $courses.data }
else { $courseArray = @($courses.data) }

Write-Host "Courses found: $($courseArray.Count)" -ForegroundColor Green

Write-Host "`n== Create a built-in onboarding course (Use the App Like a Pro) ==" -ForegroundColor Cyan
$slug = "microcourse-forge-use-the-app-like-a-pro-$stamp"
$courseBody = @{
  title       = "MicroCourse Forge: Use the App Like a Pro"
  slug        = $slug
  description = "Built-in onboarding: learn navigation, quizzes, dashboards, and exporting results."
  level       = "beginner"
  tags        = @("onboarding","how-to","microcourse-forge")
}

$coursePost = Try-Any -Urls @("$Base/courses", "$Base/courses/create", "$Base/course") -Method POST -Headers $authHeaders -Body $courseBody
Assert-Ok $coursePost "create course"
$coursePost.data | ConvertTo-Json -Depth 20 | Write-Host

# Normalize courseId
$courseId = $null
if ($coursePost.data.course -and $coursePost.data.course._id) { $courseId = $coursePost.data.course._id }
elseif ($coursePost.data._id) { $courseId = $coursePost.data._id }
elseif ($coursePost.data.courseId) { $courseId = $coursePost.data.courseId }

if (-not $courseId) {
  # fallback: refetch and find by slug
  $ref = Invoke-Api -Method GET -Url "$Base/courses" -Headers $authHeaders
  Assert-Ok $ref "refetch courses"
  $arr = $ref.data.courses; if (-not $arr) { $arr = $ref.data }
  $match = $arr | Where-Object { $_.slug -eq $slug } | Select-Object -First 1
  if ($match -and $match._id) { $courseId = $match._id }
}
if (-not $courseId) { throw "Could not determine courseId." }

Write-Host "courseId=$courseId" -ForegroundColor Green

Write-Host "`n== Create a follow-up quiz (customer-style questions) ==" -ForegroundColor Cyan
$quizBody = @{
  courseId = $courseId
  title    = "Follow-Up Check: Can You Use the App?"
  questions = @(
    @{
      prompt = "Where do you go to view your quiz history and progress trends?"
      options = @("Profile", "Dashboard", "Settings", "Inbox")
      correctIndex = 1
      explanation = "The Dashboard aggregates your activity and progress."
      points = 1
    },
    @{
      prompt = "What should you do first if a page shows 'Failed to fetch'?"
      options = @("Refresh 20 times", "Check API base URL and backend health", "Delete the browser", "Turn off MongoDB")
      correctIndex = 1
      explanation = "Start with the backend health endpoint and correct API base URL."
      points = 1
    },
    @{
      prompt = "Which export is best for sending results to a parent or manager?"
      options = @("TXT", "PDF", "BMP", "RAW JSON only")
      correctIndex = 1
      explanation = "PDF is portable and presentation-ready."
      points = 1
    }
  )
}

$quizPost = Try-Any -Urls @("$Base/quizzes", "$Base/quizzes/create", "$Base/quiz") -Method POST -Headers $authHeaders -Body $quizBody
Assert-Ok $quizPost "create quiz"
$quizPost.data | ConvertTo-Json -Depth 30 | Write-Host

$quizId = $null
if ($quizPost.data.quiz -and $quizPost.data.quiz._id) { $quizId = $quizPost.data.quiz._id }
elseif ($quizPost.data._id) { $quizId = $quizPost.data._id }
elseif ($quizPost.data.quizId) { $quizId = $quizPost.data.quizId }
if (-not $quizId) { throw "Could not determine quizId." }

Write-Host "quizId=$quizId" -ForegroundColor Green

Write-Host "`n== Submit a realistic attempt (customer answers) ==" -ForegroundColor Cyan
$resultBody = @{
  courseId = $courseId
  quizId   = $quizId
  answers  = @(1, 1, 1)  # all correct
  meta     = @{
    userAgent = "PowerShell E2E"
    submittedAt = (Get-Date).ToString("o")
  }
}

$resultPost = Try-Any -Urls @("$Base/results/submit", "$Base/results") -Method POST -Headers $authHeaders -Body $resultBody
Assert-Ok $resultPost "submit result"
$resultPost.data | ConvertTo-Json -Depth 30 | Write-Host

Write-Host "`n✅ E2E PASS: health → register → login → me → courses → create course → create quiz → submit result" -ForegroundColor Green
