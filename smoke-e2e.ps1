$ErrorActionPreference = "Stop"

# ==========================
# MicroCourse Backend E2E Smoke
# ==========================

$base = $env:MC_BASE
if (-not $base) { $base = "http://localhost:4000/api" }

function Write-Step($msg) { Write-Host "`n➡ $msg" -ForegroundColor Cyan }
function OK($msg)        { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg)      { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Fail($msg)      { Write-Host "[XX] $msg" -ForegroundColor Red }

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  $hdr = @{}
  foreach ($k in $Headers.Keys) { $hdr[$k] = $Headers[$k] }

  $params = @{
    Method      = $Method
    Uri         = $Url
    Headers     = $hdr
    ErrorAction = "Stop"
  }

  if ($null -ne $Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 50)
  }

  $status = 0
  $raw = $null

  if ($PSVersionTable.PSVersion.Major -ge 7) {
    $resp = Invoke-WebRequest @params -SkipHttpErrorCheck
    $status = [int]$resp.StatusCode
    $raw = $resp.Content
  } else {
    try {
      $resp = Invoke-WebRequest @params -UseBasicParsing
      $status = [int]$resp.StatusCode
      $raw = $resp.Content
    } catch {
      $raw = $_.Exception.Message
      if ($_.Exception.Response) {
        try {
          $r = $_.Exception.Response
          $status = [int]$r.StatusCode
          $sr = New-Object IO.StreamReader($r.GetResponseStream())
          $raw = $sr.ReadToEnd()
        } catch {}
      }
    }
  }

  $data = $null
  try { if ($raw) { $data = $raw | ConvertFrom-Json -ErrorAction Stop } } catch {}

  [pscustomobject]@{
    ok     = ($status -ge 200 -and $status -lt 300)
    status = $status
    url    = $Url
    raw    = $raw
    data   = $data
  }
}

function AuthHeaders($token) {
  $t = "$token"
  $t = $t.Trim()
  return @{
    Authorization = "Bearer $t"
    Accept        = "application/json"
  }
}

function Get-PathValue($obj, [string[]]$path) {
  $cur = $obj
  foreach ($p in $path) {
    if ($null -eq $cur) { return $null }
    if ($cur.PSObject.Properties.Name -notcontains $p) { return $null }
    $cur = $cur.$p
  }
  return $cur
}

function Get-CourseId($resp) {
  $candidates = @(
    (Get-PathValue $resp @("courseId")),
    (Get-PathValue $resp @("course","_id")),
    (Get-PathValue $resp @("course","id")),
    (Get-PathValue $resp @("data","courseId")),
    (Get-PathValue $resp @("data","course","_id")),
    (Get-PathValue $resp @("data","course","id")),
    (Get-PathValue $resp @("data","_id")),
    (Get-PathValue $resp @("data","id")),
    (Get-PathValue $resp @("_id")),
    (Get-PathValue $resp @("id"))
  )
  foreach ($c in $candidates) { if ($c) { return "$c" } }
  return $null
}

function Get-QuizId($resp) {
  # CRITICAL: Prefer quiz-scoped IDs first so we don't accidentally grab a courseId.
  $candidates = @(
    (Get-PathValue $resp @("quizId")),
    (Get-PathValue $resp @("quiz","_id")),
    (Get-PathValue $resp @("quiz","id")),
    (Get-PathValue $resp @("data","quizId")),
    (Get-PathValue $resp @("data","quiz","_id")),
    (Get-PathValue $resp @("data","quiz","id"))
  )

  foreach ($c in $candidates) { if ($c) { return "$c" } }

  # Only if nothing else worked, fall back to top-level _id/id
  $fallback = @(
    (Get-PathValue $resp @("data","_id")),
    (Get-PathValue $resp @("data","id")),
    (Get-PathValue $resp @("_id")),
    (Get-PathValue $resp @("id"))
  )
  foreach ($c in $fallback) { if ($c) { return "$c" } }

  return $null
}

function LoginOrRegister {
  param([string]$Role, [string]$Email, [string]$Password)

  $loginUrl = "$base/auth/login"
  $regUrl   = "$base/auth/register"

  $loginBody = @{ email = $Email; password = $Password }
  $login = Invoke-ApiJson -Method POST -Url $loginUrl -Body $loginBody

  if (-not $login.ok) {
    Warn "$Role login failed; trying register..."
    $regBody = @{ email = $Email; password = $Password; role = $Role }
    $reg = Invoke-ApiJson -Method POST -Url $regUrl -Body $regBody
    if (-not $reg.ok) {
      Fail "$Role register failed. status=$($reg.status) url=$($reg.url)"
      throw $reg.raw
    }
    OK "$Role register OK"
    $login = Invoke-ApiJson -Method POST -Url $loginUrl -Body $loginBody
  }

  if (-not $login.ok) {
    Fail "$Role login failed. status=$($login.status) url=$($login.url)"
    throw $login.raw
  }

  $tok = $null
  if ($login.data -and ($login.data.PSObject.Properties.Name -contains "token")) { $tok = $login.data.token }
  elseif ($login.data -and $login.data.data -and ($login.data.data.PSObject.Properties.Name -contains "token")) { $tok = $login.data.data.token }

  if (-not $tok) {
    Fail "$Role login response missing token."
    throw ($login.raw)
  }

  return "$tok"
}

Write-Step "Health check"
$health = Invoke-ApiJson -Method GET -Url "$base/health"
if (-not $health.ok) {
  Fail "Health failed. status=$($health.status) url=$($health.url)"
  throw $health.raw
}
OK "Health: $($health.data.service) @ $($health.data.ts)"

# Unique accounts each run
$stamp = (Get-Date).ToString("yyyyMMddHHmmss")
$instructorEmail = "instructor+$stamp@microcourse.test"
$studentEmail    = "student+$stamp@microcourse.test"
$pass            = "Pass123!"

Write-Host "BASE: $base"
Write-Host "Instructor: $instructorEmail"
Write-Host "Student:    $studentEmail"

Write-Step "Auth: instructor + student"
$instructorToken = LoginOrRegister -Role "instructor" -Email $instructorEmail -Password $pass
$studentToken    = LoginOrRegister -Role "student"    -Email $studentEmail    -Password $pass
OK "Tokens acquired. InstructorLen=$($instructorToken.Length) StudentLen=$($studentToken.Length)"

$Hinst = AuthHeaders $instructorToken
$Hstud = AuthHeaders $studentToken

Write-Step "Create course (instructor)"
$courseBody = @{
  title       = "How to Use the App (Built-in Test Course)"
  description = "A quick course that teaches users how to navigate the MicroCourse app."
  price       = 0
}
$courseResp = Invoke-ApiJson -Method POST -Url "$base/courses" -Headers $Hinst -Body $courseBody
if (-not $courseResp.ok) {
  Fail "Create course failed. status=$($courseResp.status) url=$($courseResp.url)"
  throw $courseResp.raw
}
$courseId = Get-CourseId $courseResp.data
if (-not $courseId) {
  Fail "Create course response missing courseId/_id."
  throw $courseResp.raw
}
OK "Course created: $courseId"

Write-Step "Create quiz (instructor) under course"
$quizBody = @{
  courseId = $courseId
  title    = "App Basics Quiz"
  questions = @(
    @{
      prompt = "Where do you go to see your enrolled courses?"
      options = @("Settings","Dashboard","Profile","Help")
      correctIndex = 1
    },
    @{
      prompt = "What does the 'Results' page show?"
      options = @("Only certificates","Your quiz attempts and scores","Only instructor notes","Billing history")
      correctIndex = 1
    },
    @{
      prompt = "If a page fails to load, what is the first best step?"
      options = @("Refresh and check internet","Delete your account","Turn off the server","Ignore it")
      correctIndex = 0
    }
  )
}
$quizResp = Invoke-ApiJson -Method POST -Url "$base/quizzes" -Headers $Hinst -Body $quizBody
if (-not $quizResp.ok) {
  Fail "Create quiz failed. status=$($quizResp.status) url=$($quizResp.url)"
  throw $quizResp.raw
}
$quizId = Get-QuizId $quizResp.data
if (-not $quizId) {
  Fail "Create quiz response missing quizId/_id (quiz-scoped)."
  throw $quizResp.raw
}
OK "Quiz created: $quizId"

Write-Step "Student fetch quiz (try /quizzes then /quiz alias)"
$quizGet1 = Invoke-ApiJson -Method GET -Url "$base/quizzes/$quizId" -Headers $Hstud
if (-not $quizGet1.ok) {
  Warn "GET /quizzes/:id failed (status=$($quizGet1.status)). Trying /quiz/:id..."
  $quizGet2 = Invoke-ApiJson -Method GET -Url "$base/quiz/$quizId" -Headers $Hstud
  if (-not $quizGet2.ok) {
    Fail "Student get quiz failed on both endpoints."
    Write-Host "---- /quizzes raw ----"
    Write-Host $quizGet1.raw
    Write-Host "---- /quiz raw ----"
    Write-Host $quizGet2.raw
    throw "Student get quiz failed."
  }
  OK "Student got quiz via /api/quiz/:id"
  $quizObj = $quizGet2.data
} else {
  OK "Student got quiz via /api/quizzes/:id"
  $quizObj = $quizGet1.data
}

# Extract questions to build answers array length
$questions = $null
if ($quizObj -and ($quizObj.PSObject.Properties.Name -contains "questions")) { $questions = $quizObj.questions }
elseif ($quizObj -and $quizObj.quiz -and ($quizObj.quiz.PSObject.Properties.Name -contains "questions")) { $questions = $quizObj.quiz.questions }
elseif ($quizObj -and $quizObj.data -and $quizObj.data.quiz -and ($quizObj.data.quiz.PSObject.Properties.Name -contains "questions")) { $questions = $quizObj.data.quiz.questions }

if (-not $questions) {
  Warn "Could not find questions array in quiz payload; will submit 3 zeros as fallback."
  $answers = @(0,0,0)
} else {
  $answers = @()
  for ($i=0; $i -lt $questions.Count; $i++) { $answers += 0 }
  OK "Quiz questions=$($questions.Count) -> answersCount=$($answers.Count)"
}

Write-Step "Submit results (student)"
$submitBody = @{ quizId = $quizId; answers = $answers }
$submitResp = Invoke-ApiJson -Method POST -Url "$base/results/submit" -Headers $Hstud -Body $submitBody
if (-not $submitResp.ok) {
  Fail "Submit failed. status=$($submitResp.status) url=$($submitResp.url)"
  throw $submitResp.raw
}
OK "Submit OK"

Write-Step "Verify results/mine (student)"
$mineResp = Invoke-ApiJson -Method GET -Url "$base/results/mine" -Headers $Hstud
if (-not $mineResp.ok) {
  Fail "Mine failed. status=$($mineResp.status) url=$($mineResp.url)"
  throw $mineResp.raw
}
OK "Mine OK (received response)"

Write-Host "`n✅ E2E smoke complete." -ForegroundColor Green


# ---------------------------
# Export smoke artifacts (tokens + ids) for re-use
# ---------------------------
function Get-VarValue {
  param([string[]]$Names)
  foreach ($n in $Names) {
    $v = Get-Variable -Name $n -Scope Script  -ErrorAction SilentlyContinue
    if ($null -ne $v) { return $v.Value }
    $v = Get-Variable -Name $n -Scope Global -ErrorAction SilentlyContinue
    if ($null -ne $v) { return $v.Value }
  }
  return $null
}

try {
  $baseVal = Get-VarValue @("base","BASE","apiBase")
  if (-not $baseVal) { $baseVal = ("http://localhost:4000/api") }

  $instructorEmailVal = Get-VarValue @("instructorEmail","InstructorEmail")
  $studentEmailVal    = Get-VarValue @("studentEmail","StudentEmail")

  $instructorTokVal = Get-VarValue @("instructorTok","instructorToken","InstructorTok","InstructorToken")
  $studentTokVal    = Get-VarValue @("studentTok","studentToken","StudentTok","StudentToken")

  $courseIdVal = Get-VarValue @("courseId","CourseId")
  $quizIdVal   = Get-VarValue @("quizId","QuizId")

  $artifactPath = Join-Path $PSScriptRoot "smoke-artifacts.json"
  $art = [ordered]@{
    base      = "$baseVal"
    at        = (Get-Date).ToString("s")
    instructor= @{ email = "$instructorEmailVal"; token = "$instructorTokVal" }
    student   = @{ email = "$studentEmailVal";    token = "$studentTokVal" }
    courseId  = "$courseIdVal"
    quizId    = "$quizIdVal"
  }

  ($art | ConvertTo-Json -Depth 20) | Set-Content -Encoding UTF8 $artifactPath
  Write-Host "[OK] Wrote smoke-artifacts.json" -ForegroundColor Green
}
catch {
  Write-Host "[!!] Could not write smoke-artifacts.json: $($_.Exception.Message)" -ForegroundColor Yellow
}


