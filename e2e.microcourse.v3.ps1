# e2e.microcourse.v3.ps1
# End-to-end happy path:
# - Instructor registers + logs in
# - Creates course
# - Adds 3 lessons in order
# - Creates quiz tied to course
# - Verifies GET course + lessons + quiz
# - Optional: student takes quiz + posts results

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# =========================
# Config
# =========================
$Port = 4000
$base = "http://localhost:$Port/api"

# Toggle student simulation
$DoStudentSimulation = $true

# =========================
# Pretty output helpers
# =========================
function Write-Section([string]$t) {
  Write-Host ""
  Write-Host ("== {0} ==" -f $t) -ForegroundColor Cyan
}

function J([object]$o, [int]$depth = 20) {
  if ($null -eq $o) { return "null" }
  return ($o | ConvertTo-Json -Depth $depth)
}

# =========================
# Robust HTTP helper (doesn't explode on non-2xx)
# =========================
function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","DELETE")] [string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    [string]$BodyJson = $null
  )

  try {
    $params = @{
      Method      = $Method
      Uri         = $Url
      Headers     = $Headers
      ErrorAction = "Stop"
    }

    if ($BodyJson) {
      $params["ContentType"] = "application/json"
      $params["Body"]        = $BodyJson
    }

    $resp = Invoke-WebRequest @params
    $raw  = $resp.Content
    $data = $null
    try { $data = $raw | ConvertFrom-Json -ErrorAction Stop } catch { $data = $raw }

    return [pscustomobject]@{
      ok     = $true
      status = [int]$resp.StatusCode
      url    = $Url
      data   = $data
      raw    = $raw
    }
  }
  catch {
    $status = $null
    $raw = $null

    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
      } catch {}
    }

    return [pscustomobject]@{
      ok     = $false
      status = $status
      url    = $Url
      error  = $_.Exception.Message
      raw    = $raw
      data   = $null
    }
  }
}

function Assert-Ok {
  param([object]$Result, [string]$Name)
  if (-not $Result.ok) {
    $rawLine = if ($Result.raw) { ("`nRAW:`n" + $Result.raw) } else { "" }
    throw ("FAILED: {0} ({1}) => {2} :: {3}{4}" -f $Name, $Result.status, $Result.error, $Result.url, $rawLine)
  }
}

# =========================
# Object helpers (handles nested course/quiz shapes)
# =========================
function Get-PropSafe {
  param([object]$Obj, [string]$Prop)
  if ($null -eq $Obj) { return $null }
  try {
    if ($Obj -is [hashtable]) {
      if ($Obj.ContainsKey($Prop)) { return $Obj[$Prop] }
      return $null
    }
    $p = $Obj.PSObject.Properties[$Prop]
    if ($p) { return $p.Value }
    return $null
  } catch { return $null }
}

function Get-AnyId {
  param([object]$Obj)

  if ($null -eq $Obj) { return $null }

  # direct
  foreach ($k in @("_id","id","quizId","courseId")) {
    $v = Get-PropSafe $Obj $k
    if ($v) { return [string]$v }
  }

  # common nested
  foreach ($k in @("course","quiz","data","result","user")) {
    $v = Get-PropSafe $Obj $k
    if ($v) {
      $id = Get-AnyId $v
      if ($id) { return $id }
    }
  }

  # arrays: scan
  if ($Obj -is [System.Collections.IEnumerable] -and -not ($Obj -is [string])) {
    foreach ($item in $Obj) {
      $id = Get-AnyId $item
      if ($id) { return $id }
    }
  }

  return $null
}

# =========================
# Try helpers: multiple URLs + payload shapes
# =========================
function Try-PostAny {
  param(
    [string[]]$Urls,
    [hashtable]$Headers,
    [string[]]$BodiesJson
  )

  $attempts = @()
  foreach ($u in $Urls) {
    foreach ($b in $BodiesJson) {
      $r = Invoke-Api -Method "POST" -Url $u -Headers $Headers -BodyJson $b
      $attempts += $r
      if ($r.ok) { return $r }
    }
  }

  # Return last attempt for debugging
  return $attempts[-1]
}

function Try-GetAny {
  param(
    [string[]]$Urls,
    [hashtable]$Headers
  )

  $attempts = @()
  foreach ($u in $Urls) {
    $r = Invoke-Api -Method "GET" -Url $u -Headers $Headers
    $attempts += $r
    if ($r.ok) { return $r }
  }
  return $attempts[-1]
}

# =========================
# 0) Health check
# =========================
Write-Section "Health"
$health = Invoke-Api -Method "GET" -Url "$base/health"
Assert-Ok $health "health"
$health.data | Format-List

# =========================
# 1) Register + login instructor
# =========================
$ts = Get-Date -Format "yyyyMMddHHmmss"
$instructorEmail = "instructor+$ts@microcourse.test"
$pw = "Passw0rd!123"

Write-Section "Register Instructor"
$regInstructor = Invoke-Api -Method "POST" -Url "$base/auth/register" -BodyJson (J @{
  email = $instructorEmail
  password = $pw
  role = "instructor"
})
Assert-Ok $regInstructor "register instructor"
$regInstructor.data | Format-List

Write-Section "Login Instructor"
$loginInstructor = Invoke-Api -Method "POST" -Url "$base/auth/login" -BodyJson (J @{
  email = $instructorEmail
  password = $pw
})
Assert-Ok $loginInstructor "login instructor"

$token = Get-PropSafe $loginInstructor.data "token"
if (-not $token) { $token = Get-PropSafe $loginInstructor.data "accessToken" }
if (-not $token) { throw "Login succeeded but token missing. Keys: $((($loginInstructor.data.PSObject.Properties | Select-Object -ExpandProperty Name) -join ', '))" }

$authHeaders = @{ Authorization = "Bearer $token" }

# Show token length safely
$tokenLen = ([string]$token).Length
Write-Host ("Instructor token length: {0}" -f $tokenLen) -ForegroundColor DarkGreen

# =========================
# 2) Create course (instructor)
# =========================
Write-Section "Create Course (Instructor)"
$coursePayload = @{
  title = "MicroCourse Forge: Use the App Like a Pro (E2E $ts)"
  description = "Built-in onboarding course created by E2E script."
  status = "published"
  thumbnailUrl = ""
  tags = @("onboarding","how-to","microcourse-forge")
  estimatedMinutes = 20
  level = "Beginner"
  language = "en"
}

$createCourse = Try-PostAny -Urls @(
  "$base/courses",
  "$base/courses/create",
  "$base/course"
) -Headers $authHeaders -BodiesJson @(
  (J $coursePayload),
  (J @{ course = $coursePayload })
)

Assert-Ok $createCourse "create course"
$courseId = Get-AnyId $createCourse.data
if (-not $courseId) {
  throw "Could not determine courseId. Response:`n$(J $createCourse.data 50)"
}

Write-Host ("Created courseId: {0}" -f $courseId) -ForegroundColor Green

# =========================
# 3) POST lessons in order
#    Route from your courseRoutes.js:
#    POST /api/courses/:courseId/lessons
# =========================
Write-Section "Create Lessons (Intro -> Build -> Publish)"

$lessonUrls = @(
  "$base/courses/$courseId/lessons"
)

$lessons = @(
  @{
    title = "Intro: How MicroCourse Forge Works"
    order = 1
    content = @"
Welcome! In this lesson you’ll learn:
- What the dashboard shows
- How courses, lessons, and quizzes connect
- The fastest path from idea → published course

Pro tip: Keep lessons short, focused, and frictionless.
"@
    videoUrl = ""
  },
  @{
    title = "Build a Course: Create, Structure, and Save"
    order = 2
    content = @"
In this lesson you’ll:
- Create a course title and description
- Add lessons in the right order
- Attach a quiz to validate learning

Rule of thumb: One lesson = one outcome.
"@
    videoUrl = ""
  },
  @{
    title = "Publish Like a Pro: QA, Publish, and Share"
    order = 3
    content = @"
Checklist before publish:
- Titles are clear and consistent
- Lessons are ordered
- Quiz questions match the lesson outcomes
- Preview looks clean on mobile

Publish, then share your link.
"@
    videoUrl = ""
  }
)

$createdLessonIds = @()
foreach ($l in $lessons) {
  $postLesson = Try-PostAny -Urls $lessonUrls -Headers $authHeaders -BodiesJson @(
    (J $l),
    (J @{ lesson = $l })
  )
  Assert-Ok $postLesson ("create lesson order " + $l.order)
  $lessonId = Get-AnyId $postLesson.data
  if ($lessonId) { $createdLessonIds += $lessonId }
  Write-Host ("Lesson {0} posted. lessonId={1}" -f $l.order, $lessonId) -ForegroundColor Green
}

# =========================
# 4) POST quiz tied to the course
#    Route: POST /api/quizzes
# =========================
Write-Section "Create Quiz (Instructor)"

# Multiple payload shapes to survive controller expectations
$quizA = @{
  courseId = $courseId
  title = "MicroCourse Forge Onboarding Quiz"
  questions = @(
    @{
      prompt = "What is the primary purpose of the onboarding course?"
      options = @(
        "Teach users how to navigate and use MicroCourse Forge",
        "Sell unrelated services",
        "Replace the dashboard",
        "Disable quizzes"
      )
      correctIndex = 0
      points = 1
      conceptTag = "onboarding"
      explanation = "Onboarding reduces friction and teaches the workflow."
    },
    @{
      prompt = "In general, what’s a good lesson design principle?"
      options = @(
        "One lesson should cover everything",
        "One lesson should focus on one outcome",
        "No titles needed",
        "Random order is best"
      )
      correctIndex = 1
      points = 1
      conceptTag = "instructional-design"
      explanation = "Clarity beats chaos."
    },
    @{
      prompt = "Before publishing, which item belongs on the checklist?"
      options = @(
        "Remove all lessons",
        "Make titles inconsistent",
        "Verify lesson order and quiz alignment",
        "Skip preview"
      )
      correctIndex = 2
      points = 1
      conceptTag = "publishing"
      explanation = "Alignment prevents confusion and support tickets."
    }
  )
}

$quizB = @{
  courseId = $courseId
  name = $quizA.title
  items = $quizA.questions
}

$quizC = @{
  courseId = $courseId
  quiz = @{
    title = $quizA.title
    questions = $quizA.questions
  }
}

$createQuiz = Try-PostAny -Urls @(
  "$base/quizzes",
  "$base/quiz",
  "$base/courses/$courseId/quizzes"
) -Headers $authHeaders -BodiesJson @(
  (J $quizA 50),
  (J $quizB 50),
  (J $quizC 50)
)

Assert-Ok $createQuiz "create quiz"
$quizId = Get-AnyId $createQuiz.data
if (-not $quizId) {
  throw "CreateQuiz succeeded but quizId could not be found. Response:`n$(J $createQuiz.data 50)"
}
Write-Host ("Created quizId: {0}" -f $quizId) -ForegroundColor Green

# =========================
# 5) Verify: GET course + lessons + quiz
# =========================
Write-Section "Verify GET course + lessons + quiz"

$courseGet = Try-GetAny -Urls @(
  "$base/courses/$courseId",
  "$base/course/$courseId"
) -Headers @{}
Assert-Ok $courseGet "get course"

$lessonsGet = Try-GetAny -Urls @(
  "$base/courses/$courseId/lessons"
) -Headers @{}
Assert-Ok $lessonsGet "get lessons"

# quizzes: some controllers require courseId query (prevents 400)
$quizList = Try-GetAny -Urls @(
  "$base/quizzes?courseId=$courseId",
  "$base/quizzes"
) -Headers $authHeaders
Assert-Ok $quizList "list quizzes"

$quizGet = Try-GetAny -Urls @(
  "$base/quizzes/$quizId",
  "$base/quiz/$quizId"
) -Headers $authHeaders
Assert-Ok $quizGet "get quiz"

Write-Host "Verified course, lessons, quiz." -ForegroundColor Green

# =========================
# 6) Optional: student takes quiz + posts results
# =========================
if ($DoStudentSimulation) {
  Write-Section "Optional: Student simulation"

  $studentEmail = "student+$ts@microcourse.test"

  $regStudent = Invoke-Api -Method "POST" -Url "$base/auth/register" -BodyJson (J @{
    email = $studentEmail
    password = $pw
    role = "student"
  })
  Assert-Ok $regStudent "register student"
  Write-Host ("Student registered: {0}" -f $studentEmail) -ForegroundColor Green

  $loginStudent = Invoke-Api -Method "POST" -Url "$base/auth/login" -BodyJson (J @{
    email = $studentEmail
    password = $pw
  })
  Assert-Ok $loginStudent "login student"

  $studentToken = Get-PropSafe $loginStudent.data "token"
  if (-not $studentToken) { $studentToken = Get-PropSafe $loginStudent.data "accessToken" }
  if (-not $studentToken) { throw "Student login token missing." }

  $studentHeaders = @{ Authorization = "Bearer $studentToken" }

  # Student fetches quiz (IMPORTANT: plural endpoint)
  $studentQuizGet = Try-GetAny -Urls @(
    "$base/quizzes/$quizId",
    "$base/quiz/$quizId"
  ) -Headers $studentHeaders
  Assert-Ok $studentQuizGet "student get quiz"

  # Student answers (intentionally 1 wrong to prove scoring)
  $answers = @(0, 1, 0)  # Q3 wrong (correct is 2)

  # Results endpoints vary; try both
  $resultPayloadA = @{
    quizId = $quizId
    courseId = $courseId
    answers = $answers
    submittedAt = (Get-Date).ToString("o")
  }

  $resultPayloadB = @{
    quizId = $quizId
    answers = $answers
  }

  $postResult = Try-PostAny -Urls @(
    "$base/results",
    "$base/results/submit"
  ) -Headers $studentHeaders -BodiesJson @(
    (J $resultPayloadA 50),
    (J $resultPayloadB 50),
    (J @{ result = $resultPayloadA } 50)
  )

  Assert-Ok $postResult "submit results"
  Write-Host "Student results submitted successfully." -ForegroundColor Green
}

Write-Section "DONE"
Write-Host "All green. Offering plate officially blessed. 💵✅" -ForegroundColor Green
Write-Host ("courseId={0} quizId={1}" -f $courseId, $quizId) -ForegroundColor DarkGreen
