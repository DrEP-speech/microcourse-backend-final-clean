# ===============================
# Safe defaults (STRICT-SAFE)
# ===============================
$courseId    = $null
$courseTitle = $null
$courseLabel = $null
# scripts/e2e-student-take-quiz.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  try {
    if ($null -ne $Body) {
      $json = ($Body | ConvertTo-Json -Depth 50)
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $json
    }
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
  } catch {
    throw "API $Method $Url failed: $($_.Exception.Message)"
  }
}

function Try-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  try { return Invoke-Api -Method $Method -Url $Url -Headers $Headers -Body $Body } catch { return $null }
}

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  $raw = Get-Content $Path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  return ($raw | ConvertFrom-Json)
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

function Ensure-StudentToken {
  param([string]$Base, $Artifacts)

  # 1) prefer artifacts.studentToken
  if ($Artifacts -and $Artifacts.PSObject.Properties.Name -contains "studentToken") {
    $t = [string]$Artifacts.studentToken
    if (-not [string]::IsNullOrWhiteSpace($t)) { return $t }
  }

  Write-Host "[WARN] Missing studentToken in artifacts. Attempting login fallback..." -ForegroundColor Yellow

  # 2) try credentials from artifacts or env
  $email = $env:STUDENT_EMAIL
  $pass  = $env:STUDENT_PASSWORD

  if ($Artifacts) {
    if ([string]::IsNullOrWhiteSpace($email) -and ($Artifacts.PSObject.Properties.Name -contains "studentEmail")) { $email = [string]$Artifacts.studentEmail }
    if ([string]::IsNullOrWhiteSpace($pass)  -and ($Artifacts.PSObject.Properties.Name -contains "studentPassword")) { $pass  = [string]$Artifacts.studentPassword }
  }

  if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($pass)) {
    throw "No studentToken and no student credentials found. Add studentToken to seed-artifacts.json OR set STUDENT_EMAIL/STUDENT_PASSWORD."
  }

  $routes = @(
    "$Base/auth/login",
    "$Base/auth/signin",
    "$Base/login"
  )

  $bodies = @(
    @{ email=$email; password=$pass },
    @{ username=$email; password=$pass }
  )

  foreach ($r in $routes) {
    foreach ($b in $bodies) {
      $resp = Try-Api -Method "POST" -Url $r -Body $b
      $tok = Extract-Token $resp
      if ($tok) {
        Write-Host "[OK] Login fallback succeeded via $r" -ForegroundColor Green
        return $tok
      }
    }
  }

  throw "Login fallback failed. Your backend auth route may differ."
}

function Extract-QuizIdFromCourse($course) {
  if ($null -eq $course) { return $null }
  foreach ($k in @("quizId","quiz","quizzes","quizIds")) {
    if ($course.PSObject.Properties.Name -contains $k) {
      $v = $course.$k
      if ($v -is [string] -and -not [string]::IsNullOrWhiteSpace($v)) { return $v }
      $id = Get-FirstId $v
      if ($id) { return $id }
      if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string]) -and $v.Count -gt 0) {
        $id = Get-FirstId $v[0]
        if ($id) { return $id }
      }
    }
  }
  return $null
}

function Extract-QuizIdFromPayload($payload) {
  if ($null -eq $payload) { return $null }

  if ($payload -is [System.Collections.IEnumerable] -and -not ($payload -is [string])) {
    foreach ($q in $payload) { $id = Get-FirstId $q; if ($id) { return $id } }
  }

  foreach ($k in @("quiz","quizzes","data","items","results")) {
    if ($payload.PSObject.Properties.Name -contains $k) {
      $v = $payload.$k
      if ($v -is [string]) { return $v }
      $id = Get-FirstId $v
      if ($id) { return $id }
      if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string]) -and $v.Count -gt 0) {
        $id = Get-FirstId $v[0]
        if ($id) { return $id }
      }
    }
  }

  return (Get-FirstId $payload)
}

function Discover-QuizId {
  param([string]$Base, [string]$CourseId, [hashtable]$Headers, $CourseObj)

  # 1) best: the course already “knows” its quiz
  $qid = Extract-QuizIdFromCourse $CourseObj
  if ($qid) {
    Write-Host "[OK] QuizId found inside course payload: $qid" -ForegroundColor Green
    return $qid
  }

  Write-Host "[1b] Discovering quiz via backend routes..." -ForegroundColor Yellow

  # 2) probe course->quiz routes + quiz search routes
  $candidates = @(
    "$Base/quizzes?courseId=$CourseId",
    "$Base/quizzes/course/$CourseId",
    "$Base/quizzes/by-course/$CourseId",
    "$Base/quizzes/for-course/$CourseId",
    "$Base/quizzes/byCourse/$CourseId",
    "$Base/quiz/by-course/$CourseId",
    "$Base/quiz?courseId=$CourseId"
  )

  foreach ($u in $candidates) {
    $resp = Try-Api -Method "GET" -Url $u -Headers $Headers
    if ($resp) {
      $qid = Extract-QuizIdFromPayload $resp
      if ($qid) {
        Write-Host "[OK] Discovered quizId via $u -> $qid" -ForegroundColor Green
        return $qid
      }
      Write-Host "[WARN] $u responded but no quizId detected" -ForegroundColor Yellow
    }
  }
# ===============================
# Quiz discovery (course -> quizzes)
# ===============================
$quizId = $null

try {
  $qResp = Invoke-RestMethod -Method Get -Uri "$API_BASE/courses/$courseId/quizzes" -Headers $headers
} catch {
  $qResp = $null
}

# Normalize to an array of quizzes
$quizList = @()
if ($null -ne $qResp) {
  if ($qResp -is [System.Array]) {
    $quizList = $qResp
  } elseif ($qResp.PSObject.Properties.Name -contains "quizzes") {
    $quizList = @($qResp.quizzes)
  } elseif ($qResp.PSObject.Properties.Name -contains "data" -and $qResp.data -and ($qResp.data.PSObject.Properties.Name -contains "quizzes")) {
    $quizList = @($qResp.data.quizzes)
  }
}

if ($quizList.Count -gt 0) {
  $q0 = $quizList[0]
  foreach ($k in @("id","_id","quizId")) {
    if ($q0.PSObject.Properties.Name -contains $k -and $q0.$k) { $quizId = [string]$q0.$k; break }
  }
}

throw "Could not discover quiz for courseId=$courseId. Add/confirm a quiz-by-course route OR embed quizId on the course response."
}

function Fetch-QuizDetail {
  param([string]$Base, [string]$QuizId, [hashtable]$Headers)

  $candidates = @(
    "$Base/quizzes/$QuizId",
    "$Base/quiz/$QuizId",
    "$Base/quizzes/detail/$QuizId"
  )

  foreach ($u in $candidates) {
    $resp = Try-Api -Method "GET" -Url $u -Headers $Headers
    if ($resp) { return $resp }
  }

  throw "Could not fetch quiz detail for quizId=$QuizId."
}

function Submit-Quiz {
  param([string]$Base, [string]$QuizId, [hashtable]$Headers, $AnswersPayload)

  $candidates = @(
    @{ url="$Base/quizzes/submit";      body=@{ quizId=$QuizId; answers=$AnswersPayload } },
    @{ url="$Base/quizzes/$QuizId/submit"; body=@{ answers=$AnswersPayload } },
    @{ url="$Base/quiz/$QuizId/submit";    body=@{ answers=$AnswersPayload } }
  )

  foreach ($c in $candidates) {
    $resp = Try-Api -Method "POST" -Url $c.url -Headers $Headers -Body $c.body
    if ($resp) {
      Write-Host "[OK] Submitted via $($c.url)" -ForegroundColor Green
      return $resp
    }
  }

  throw "Could not submit quiz (no submit endpoint matched)."
}

# ---------------- MAIN ----------------
Write-Host "=== E2E Student Take Quiz Path ===" -ForegroundColor Cyan

$base = $env:API_BASE
if ([string]::IsNullOrWhiteSpace($base)) { $base = "http://localhost:4000/api" }

# IMPORTANT: use real file locations
$repoRoot = (Resolve-Path ".").Path
$artifactsPath = Join-Path $repoRoot "seed-artifacts.json"
$seedScriptRoot = Join-Path $repoRoot "seed-onboarding.ps1"

Write-Host "API Base:   $base"
Write-Host "Artifacts:  $artifactsPath"
Write-Host "Seed:       $seedScriptRoot"
Write-Host ""

Write-Section "0) Health"
$health = Invoke-Api -Method "GET" -Url "$base/health"
Write-Host "Health OK." -ForegroundColor Green

# Load artifacts; if missing, run seed
$art = Read-JsonFile $artifactsPath
if (-not $art) {
  Write-Host "[WARN] seed-artifacts.json missing/empty. Running seed..." -ForegroundColor Yellow
  if (-not (Test-Path $seedScriptRoot)) { throw "Seed script not found at $seedScriptRoot" }
  powershell -ExecutionPolicy Bypass -File $seedScriptRoot | Out-Null
  $art = Read-JsonFile $artifactsPath
}
if (-not $art) { throw "seed-artifacts.json still missing/empty after running seed." }

$studentToken = Ensure-StudentToken -Base $base -Artifacts $art
$headers = @{ Authorization = "Bearer $studentToken" }

# courseId
$courseId = $null
foreach ($k in @("courseId","course_id","onboardingCourseId","seedCourseId")) {
  if ($art.PSObject.Properties.Name -contains $k) { $courseId = [string]$art.$k; break }
}
if ([string]::IsNullOrWhiteSpace($courseId)) { throw "Missing courseId in seed-artifacts.json. Re-run seed-onboarding.ps1." }

Write-Section "1) Confirm student can see course"
$course = Invoke-Api -Method "GET" -Url "$base/courses/$courseId" -Headers $headers
$courseTitle = $null
foreach ($k in @("title","name")) { if ($course.PSObject.Properties.Name -contains $k) { $courseTitle = [string]$course.$k; break } }
# ===============================
# Course label resolution (ALWAYS SET)
# ===============================
if ($null -eq $courseLabel) { $courseLabel = "" }  # ensure defined even under strict mode

if ($courseTitle -and ([string]$courseTitle).Trim()) {
  $courseLabel = [string]$courseTitle
}
elseif ($courseId -and ([string]$courseId).Trim()) {
  $courseLabel = [string]$courseId
}
else {
  $courseLabel = "<unknown-course>"
}
Write-Host ("Course: {0}" -f $courseLabel) -ForegroundColor Green

# quizId (prefer artifacts, else discover)
$quizId = $null
if ($art.PSObject.Properties.Name -contains "quizId") { $quizId = [string]$art.quizId }
if ([string]::IsNullOrWhiteSpace($quizId)) {
  $quizId = Discover-QuizId -Base $base -CourseId $courseId -Headers $headers -CourseObj $course
} else {
  Write-Host "[OK] Using quizId from artifacts: $quizId" -ForegroundColor Green
}

Write-Section "2) Fetch quiz details"
$quiz = Fetch-QuizDetail -Base $base -QuizId $quizId -Headers $headers

# Find questions array in tolerant way
$questions = $null
foreach ($k in @("questions","items")) {
  if ($quiz.PSObject.Properties.Name -contains $k) { $questions = $quiz.$k; break }
}
if (-not $questions -and $quiz.PSObject.Properties.Name -contains "quiz") {
  if ($quiz.quiz.PSObject.Properties.Name -contains "questions") { $questions = $quiz.quiz.questions }
}

# Build answers
$answers = @()
if ($questions -and ($questions -is [System.Collections.IEnumerable]) -and -not ($questions -is [string])) {
  foreach ($q in $questions) {
    $qid = Get-FirstId $q
    if (-not $qid -and ($q.PSObject.Properties.Name -contains "questionId")) { $qid = [string]$q.questionId }

    $choice = $null
    foreach ($ok in @("options","choices","answers")) {
      if ($q.PSObject.Properties.Name -contains $ok) {
        $opts = $q.$ok
        if ($opts -is [System.Collections.IEnumerable] -and -not ($opts -is [string]) -and $opts.Count -gt 0) {
          $first = $opts[0]
          $choice = Get-FirstId $first
          if (-not $choice -and $first.PSObject.Properties.Name -contains "value") { $choice = $first.value }
          if (-not $choice -and $first.PSObject.Properties.Name -contains "text")  { $choice = $first.text }
        }
      }
      if ($choice) { break }
    }
    if (-not $choice) { $choice = 0 }

    $answers += @{ questionId=$qid; answer=$choice }
  }
} else {
  Write-Host "[WARN] No questions array found; submitting empty answers." -ForegroundColor Yellow
}

Write-Section "3) Submit quiz"
$result = Submit-Quiz -Base $base -QuizId $quizId -Headers $headers -AnswersPayload $answers

Write-Section "4) Verify result payload"
$score = $null
foreach ($k in @("score","percent","percentage","grade")) {
  if ($result.PSObject.Properties.Name -contains $k) { $score = $result.$k; break }
}
if ($null -ne $score) {
  Write-Host "Result score: $score" -ForegroundColor Green
} else {
  Write-Host "[OK] Submit succeeded; result payload returned." -ForegroundColor Green
}

Write-Host ""
Write-Host "[OK] E2E student quiz path complete" -ForegroundColor Green


