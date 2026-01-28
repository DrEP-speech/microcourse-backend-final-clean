$ErrorActionPreference = "Stop"
$base = "http://localhost:4000/api"

function Get-HttpRawBody {
  param($Resp)
  if ($null -eq $Resp) { return $null }

  if ($Resp -is [System.Net.Http.HttpResponseMessage]) {
    try { return $Resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { return $null }
  }

  $m = $Resp.PSObject.Methods.Name
  if ($m -contains "GetResponseStream") {
    try {
      $sr = New-Object System.IO.StreamReader($Resp.GetResponseStream())
      return $sr.ReadToEnd()
    } catch { return $null }
  }
  return $null
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","DELETE")]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $BodyObj = $null
  )

  $result = [ordered]@{ ok=$false; url=$Url; status=$null; data=$null; raw=$null; error=$null }

  try {
    $p = @{ Method=$Method; Uri=$Url; Headers=$Headers }
    if ($null -ne $BodyObj) {
      $p.ContentType = "application/json"
      $p.Body = ($BodyObj | ConvertTo-Json -Depth 50)
    }
    $data = Invoke-RestMethod @p
    $result.ok = $true
    $result.status = 200
    $result.data = $data
    return [pscustomobject]$result
  }
  catch {
    $result.error = $_.Exception.Message
    $resp = $null
    try { $resp = $_.Exception.Response } catch {}

    if ($resp -is [System.Net.Http.HttpResponseMessage]) {
      $result.status = [int]$resp.StatusCode
      $result.raw = Get-HttpRawBody $resp
      if ($result.raw) { try { $result.data = ($result.raw | ConvertFrom-Json) } catch {} }
      return [pscustomobject]$result
    }

    if ($resp) {
      try { $result.status = [int]$resp.StatusCode } catch { $result.status = 0 }
      $result.raw = Get-HttpRawBody $resp
      if ($result.raw) { try { $result.data = ($result.raw | ConvertFrom-Json) } catch {} }
      return [pscustomobject]$result
    }

    $result.status = 0
    return [pscustomobject]$result
  }
}

function Assert-Ok($r, $label) {
  if (-not $r.ok) {
    Write-Host "❌ $label failed" -ForegroundColor Red
    Write-Host "url:    $($r.url)" -ForegroundColor DarkYellow
    Write-Host "status: $($r.status)" -ForegroundColor DarkYellow
    Write-Host "error:  $($r.error)" -ForegroundColor DarkYellow
    if ($r.raw) { Write-Host "raw:    $($r.raw)" -ForegroundColor DarkGray }
    throw "$label failed"
  }
}

function New-RandomEmail($prefix) {
  $stamp = (Get-Date).ToString("yyyyMMddHHmmss")
  return "$prefix+$stamp@microcourse.test"
}

function Ensure-Login {
  param([string]$roleLabel,[string]$email,[string]$password)

  $login = Invoke-ApiJson -Method POST -Url "$base/auth/login" -BodyObj @{ email=$email; password=$password }
  if ($login.ok -and $login.data.token) {
    Write-Host "✅ $roleLabel login OK" -ForegroundColor Green
    return $login.data.token
  }

  Write-Host "ℹ️ $roleLabel login failed; trying register..." -ForegroundColor Yellow
  $null = Invoke-ApiJson -Method POST -Url "$base/auth/register" -BodyObj @{ email=$email; password=$password; role=$roleLabel.ToLower() }

  $login2 = Invoke-ApiJson -Method POST -Url "$base/auth/login" -BodyObj @{ email=$email; password=$password }
  Assert-Ok $login2 "$roleLabel login after register"
  if (-not $login2.data.token) { throw "$roleLabel login returned no token. raw=$($login2.raw)" }

  Write-Host "✅ $roleLabel login OK (post-register)" -ForegroundColor Green
  return $login2.data.token
}

function Try-FirstOk {
  param([string]$label,[string[]]$urls,[hashtable]$headers)

  foreach ($u in $urls) {
    $r = Invoke-ApiJson -Method GET -Url $u -Headers $headers
    if ($r.ok) {
      Write-Host "✅ $label OK via $u" -ForegroundColor Green
      return $r
    }
    Write-Host "… $label attempt failed: status=$($r.status) url=$u" -ForegroundColor DarkYellow
    if ($r.raw) { Write-Host "raw: $($r.raw)" -ForegroundColor DarkGray }
  }

  throw "$label failed on all candidate endpoints."
}

# 1) Health
$health = Invoke-ApiJson -Method GET -Url "$base/health"
Assert-Ok $health "Health"
Write-Host "✅ Health OK: $($health.data.service) @ $($health.data.ts)" -ForegroundColor Green

# 2) Fresh accounts each run
$pass = "Pass123!"
$instructorEmail = New-RandomEmail "instructor"
$studentEmail    = New-RandomEmail "student"

$instructorToken = Ensure-Login -roleLabel "Instructor" -email $instructorEmail -password $pass
$studentToken    = Ensure-Login -roleLabel "Student"    -email $studentEmail    -password $pass

$hInstructor = @{ Authorization="Bearer $instructorToken"; Accept="application/json" }
$hStudent    = @{ Authorization="Bearer $studentToken";    Accept="application/json" }

Write-Host "✅ Tokens acquired. InstructorLen=$($instructorToken.Length) StudentLen=$($studentToken.Length)" -ForegroundColor Green

# 3) Get or create a course (because quizzes are often scoped by courseId)
$coursesCandidates = @(
  "$base/courses",
  "$base/courses/mine",
  "$base/courses/instructor",
  "$base/courses?mine=true"
)

$courseList = $null
foreach ($u in $coursesCandidates) {
  $tmp = Invoke-ApiJson -Method GET -Url $u -Headers $hInstructor
  if ($tmp.ok) { $courseList = $tmp; break }
}

$courseId = $null
if ($courseList -and $courseList.data) {
  $c = $courseList.data.courses
  if (-not $c -and $courseList.data.data -and $courseList.data.data.courses) { $c = $courseList.data.data.courses }
  if (-not $c -and ($courseList.data -is [System.Collections.IEnumerable])) { $c = $courseList.data }

  if ($c -and $c.Count -gt 0) {
    $first = $c | Select-Object -First 1
    $courseId = $first._id
    if (-not $courseId -and $first.courseId) { $courseId = $first.courseId }
  }
}

if (-not $courseId) {
  Write-Host "ℹ️ No course found; creating one..." -ForegroundColor Yellow
  $coursePayloads = @(
    @{ title="How to Use the App"; description="Built-in walkthrough course"; isPublished=$true },
    @{ name="How to Use the App"; description="Built-in walkthrough course"; published=$true }
  )

  $createdCourse = $null
  foreach ($p in $coursePayloads) {
    $try = Invoke-ApiJson -Method POST -Url "$base/courses" -Headers $hInstructor -BodyObj $p
    if ($try.ok) { $createdCourse = $try; break }
    Write-Host "… create course failed: status=$($try.status)" -ForegroundColor DarkYellow
    if ($try.raw) { Write-Host "raw: $($try.raw)" -ForegroundColor DarkGray }
  }
  if (-not $createdCourse) { throw "Could not create course with attempted payloads." }

  $courseId = $createdCourse.data.courseId
  if (-not $courseId -and $createdCourse.data.course -and $createdCourse.data.course._id) { $courseId = $createdCourse.data.course._id }
  if (-not $courseId -and $createdCourse.data._id) { $courseId = $createdCourse.data._id }
  if (-not $courseId) { throw "Created course but could not extract courseId. raw=$($createdCourse.raw)" }

  Write-Host "✅ Created courseId=$courseId" -ForegroundColor Green
} else {
  Write-Host "✅ Using existing courseId=$courseId" -ForegroundColor Green
}

# 4) List quizzes (try common route shapes)
$quizListUrls = @(
  "$base/quizzes",
  "$base/quizzes?courseId=$courseId",
  "$base/quizzes/course/$courseId",
  "$base/courses/$courseId/quizzes"
)

$quizList = $null
try {
  $quizList = Try-FirstOk -label "List quizzes" -urls $quizListUrls -headers $hInstructor
} catch {
  Write-Host "❌ Could not list quizzes via any common endpoint." -ForegroundColor Red
  throw
}

# 5) Pick quizId from whatever shape the API returns
$quizzes = $quizList.data.quizzes
if (-not $quizzes -and $quizList.data.data -and $quizList.data.data.quizzes) { $quizzes = $quizList.data.data.quizzes }
if (-not $quizzes -and ($quizList.data -is [System.Collections.IEnumerable])) { $quizzes = $quizList.data }

$quizId = $null
if ($quizzes -and $quizzes.Count -gt 0) {
  $first = $quizzes | Select-Object -First 1
  $quizId = $first._id
  if (-not $quizId -and $first.quizId) { $quizId = $first.quizId }
}

if (-not $quizId) {
  Write-Host "ℹ️ No quizzes found; creating minimal quiz..." -ForegroundColor Yellow

  $quizPayloads = @(
    @{ title="App Walkthrough Quiz"; courseId=$courseId; questions=@(
        @{ prompt="Where do you click to create a course?"; choices=@("Dashboard","Create Course","Settings"); correctIndex=1 },
        @{ prompt="What does Results show?"; choices=@("Grades","Videos","Passwords"); correctIndex=0 },
        @{ prompt="What must be included in API calls?"; choices=@("A token","A meme","A fax"); correctIndex=0 }
      )
    },
    @{ name="App Walkthrough Quiz"; courseId=$courseId; questions=@(
        @{ question="Where do you click to create a course?"; options=@("Dashboard","Create Course","Settings"); answerIndex=1 },
        @{ question="What does Results show?"; options=@("Grades","Videos","Passwords"); answerIndex=0 },
        @{ question="What must be included in API calls?"; options=@("A token","A meme","A fax"); answerIndex=0 }
      )
    }
  )

  $createdQuiz = $null
  foreach ($p in $quizPayloads) {
    $try = Invoke-ApiJson -Method POST -Url "$base/quizzes" -Headers $hInstructor -BodyObj $p
    if ($try.ok) { $createdQuiz = $try; break }
    Write-Host "… create quiz failed: status=$($try.status)" -ForegroundColor DarkYellow
    if ($try.raw) { Write-Host "raw: $($try.raw)" -ForegroundColor DarkGray }
  }

  if (-not $createdQuiz) { throw "Could not create quiz with attempted payloads." }

  $quizId = $createdQuiz.data.quizId
  if (-not $quizId -and $createdQuiz.data.quiz -and $createdQuiz.data.quiz._id) { $quizId = $createdQuiz.data.quiz._id }
  if (-not $quizId -and $createdQuiz.data._id) { $quizId = $createdQuiz.data._id }
  if (-not $quizId) { throw "Created quiz but could not extract quizId. raw=$($createdQuiz.raw)" }

  Write-Host "✅ Created quizId=$quizId" -ForegroundColor Green
} else {
  Write-Host "✅ Using quizId=$quizId" -ForegroundColor Green
}

# 6) Student fetch quiz and build answers
$quizGet = Invoke-ApiJson -Method GET -Url "$base/quizzes/$quizId" -Headers $hStudent
Assert-Ok $quizGet "Student get quiz"

$q = $quizGet.data
if ($q.quiz) { $q = $q.quiz }
elseif ($q.data -and $q.data.quiz) { $q = $q.data.quiz }

$questions = $q.questions
if (-not $questions -and $q.data -and $q.data.questions) { $questions = $q.data.questions }
if (-not $questions) { throw "Quiz payload missing questions array." }

$answers = @()
for ($i=0; $i -lt $questions.Count; $i++) { $answers += 0 }
Write-Host "✅ Quiz questions=$($questions.Count) => answersCount=$($answers.Count)" -ForegroundColor Green

# 7) Submit results + verify mine
$submit = Invoke-ApiJson -Method POST -Url "$base/results/submit" -Headers $hStudent -BodyObj @{ quizId=$quizId; answers=$answers }
Assert-Ok $submit "Submit results"
Write-Host "✅ Submit OK" -ForegroundColor Green
if ($submit.data) { ($submit.data | ConvertTo-Json -Depth 50) | Write-Host }

$mine = Invoke-ApiJson -Method GET -Url "$base/results/mine" -Headers $hStudent
Assert-Ok $mine "Get results/mine"
Write-Host "✅ results/mine OK" -ForegroundColor Green
($mine.data | ConvertTo-Json -Depth 50) | Write-Host
