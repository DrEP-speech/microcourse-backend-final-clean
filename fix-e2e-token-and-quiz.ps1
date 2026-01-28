Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }

function New-Headers([string]$token){
  if ([string]::IsNullOrWhiteSpace($token)) { throw "Token is empty." }
  return @{
    "Authorization" = "Bearer $token"
    "x-access-token" = "$token"
    "x-auth-token" = "$token"
  }
}

function Unwrap-List($resp){
  if ($null -eq $resp) { return @() }
  if ($resp -is [System.Array]) { return @($resp) }

  foreach ($p in @("items","data","courses","quizzes","results")) {
    $prop = $resp.PSObject.Properties[$p]
    if ($prop) {
      $v = $prop.Value
      if ($v -is [System.Array]) { return @($v) }
      if ($null -ne $v) { return @($v) }
    }
  }
  return @($resp)
}

$api = $env:API_BASE
if ([string]::IsNullOrWhiteSpace($api)) { $api = "http://localhost:4000/api" }
Write-Info "API Base: $api"

$email = $env:MC_EMAIL
$pass  = $env:MC_PASS
if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($pass)) {
  throw "Set env vars MC_EMAIL and MC_PASS first."
}

Write-Info "Logging in via POST $api/auth/login ..."
$loginBody = @{ identifier=$email; password=$pass } | ConvertTo-Json
try {
  $login = Invoke-RestMethod -Method POST -Uri "$api/auth/login" -ContentType "application/json" -Body $loginBody
} catch {
  throw "Login failed. Ensure backend is running and /api/auth/login exists. Error: $($_.Exception.Message)"
}

$token = $null
if ($login -and $login.PSObject.Properties["token"]) { $token = [string]$login.token }
if ([string]::IsNullOrWhiteSpace($token)) { throw "Login response did not include token." }
Write-Ok ("Token acquired (chars={0})" -f $token.Length)

$headers = New-Headers $token

Write-Info "Fetching courses..."
$coursesResp = Invoke-RestMethod -Method GET -Uri "$api/courses" -Headers $headers
$courses = Unwrap-List $coursesResp
Write-Ok ("Courses returned: {0}" -f $courses.Count)

if ($courses.Count -lt 1) { throw "No courses found. Seed your DB or create a course first." }

# Pick the first course or one containing 'quick'/'onboard'
$course = $null
foreach ($c in $courses) {
  $t = ""
  if ($c.PSObject.Properties["title"]) { $t = [string]$c.title }
  elseif ($c.PSObject.Properties["name"]) { $t = [string]$c.name }
  if ($t.ToLower().Contains("quick") -or $t.ToLower().Contains("onboard")) { $course = $c; break }
}
if ($null -eq $course) { $course = $courses[0] }

$cid = $null
foreach ($idProp in @("_id","id","courseId")) {
  if ($course.PSObject.Properties[$idProp]) { $cid = [string]$course.$idProp; break }
}
if ([string]::IsNullOrWhiteSpace($cid)) { throw "Could not determine course id field." }

$title = ""
if ($course.PSObject.Properties["title"]) { $title = [string]$course.title }
elseif ($course.PSObject.Properties["name"]) { $title = [string]$course.name }

Write-Ok ("Using course: {0} ({1})" -f $title, $cid)

Write-Info "Fetching quizzes for course..."
$qResp = $null
try { $qResp = Invoke-RestMethod -Method GET -Uri "$api/quizzes?courseId=$cid" -Headers $headers } catch {}
if ($null -eq $qResp) {
  try { $qResp = Invoke-RestMethod -Method GET -Uri "$api/quizzes?course=$cid" -Headers $headers } catch {}
}
$quizzes = Unwrap-List $qResp
Write-Ok ("Quizzes returned: {0}" -f $quizzes.Count)

Write-Ok "E2E prerequisites look good (token, courses, quiz list call)."
Write-Info "If quizzes=0, create one using your backend’s POST /api/quizzes payload format."