$ErrorActionPreference = "Stop"

function Write-Info($m) { Write-Host ("ℹ️  {0}" -f $m) -ForegroundColor Cyan }
function Write-Pass($m) { Write-Host ("PASS: {0}" -f $m) -ForegroundColor Green }
function Write-Fail($m) { Write-Host ("FAIL: {0}" -f $m) -ForegroundColor Red }
function Assert-Ok($cond, $msg) { if (-not $cond) { throw $msg } }

function Build-Url([string]$Base, [string]$Path, [hashtable]$Query) {
  $ub = [System.UriBuilder]::new(($Base.TrimEnd("/") + "/" + $Path.TrimStart("/")))
  if ($Query -and $Query.Keys.Count -gt 0) {
    $pairs = @()
    foreach ($k in $Query.Keys) {
      $pairs += ("{0}={1}" -f [uri]::EscapeDataString([string]$k), [uri]::EscapeDataString([string]$Query[$k]))
    }
    $ub.Query = ($pairs -join "&")
  }
  return $ub.Uri.AbsoluteUri
}

function Api([string]$method, [string]$url, $headers = $null, $body = $null) {
  $params = @{
    Method = $method
    Uri = $url
    TimeoutSec = 30
  }
  if ($headers) { $params.Headers = $headers }
  if ($body -ne $null) {
    $params.ContentType = "application/json"
    $params.Body = ($body | ConvertTo-Json -Depth 20)
  }
  return Invoke-RestMethod @params
}

$Base = "http://localhost:4000/api"
Write-Info "Base = $Base"

# 1) Migration
Write-Info "Running migration scripts/migrate-quizzes-answerIndex.js"
try {
  node .\scripts\migrate-quizzes-answerIndex.js | Out-Host
  Write-Pass "Migration ran"
} catch {
  Write-Fail "Migration failed"
  throw
}

# 2) Start server (best effort)
Write-Info "Starting server (node server.js)"
if (-not (Test-Path ".\server.js")) {
  Write-Fail "server.js not found in repo root. Start your server manually, then re-run finalize-pack.ps1."
  throw "Missing server.js"
}

# Kill any existing node server.js on 4000 (best-effort)
try {
  $p = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($p) {
    $pid = $p.OwningProcess
    if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
  }
} catch {}

$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden
Write-Pass ("Server PID = {0}" -f $proc.Id)

Start-Sleep -Seconds 2

# 3) Health
$healthUrl = Build-Url $Base "/health" @{}
$h = Api "GET" $healthUrl
Assert-Ok ($h.ok -eq $true) "Health failed"
Write-Pass "Health OK"

# 4) Student login
$loginUrl = Build-Url $Base "/auth/login" @{}
$studentLogin = Api "POST" $loginUrl $null @{ email="student1@demo.local"; password="Password123!" }
Assert-Ok ($studentLogin.token) "Student login missing token"
$studentHeaders = @{ Authorization = "Bearer $($studentLogin.token)" }
Write-Pass ("Student login OK (token len {0})" -f $studentLogin.token.Length)

# 5) Courses (pick a published one)
$coursesUrl = Build-Url $Base "/courses" @{}
$courses = Api "GET" $coursesUrl $null $null
Assert-Ok ($courses.courses -and $courses.courses.Count -gt 0) "No courses returned"
$pub = $courses.courses | Where-Object { $_.status -eq "published" } | Select-Object -First 1
Assert-Ok ($pub -ne $null) "No published course available for student tests"
$courseId = [string]$pub._id
Write-Pass ("Selected published courseId = {0}" -f $courseId)

# 6) Seed enough quizzes to exercise pagination
Write-Info "Seeding quizzes for pagination (ensures >= 6 for this course)"
$env:COURSE_ID = $courseId
if (-not $env:MONGODB_URI -and -not $env:MONGO_URI) {
  Write-Info "NOTE: MONGODB_URI not found in environment for seed script. It will use .env if present."
}
node .\scripts\seed-pagination-quizzes.js | Out-Host
Write-Pass "Seed ran"

# 7) Pagination test (limit=2, expect nextCursor)
$q1Url = Build-Url $Base "/quizzes" @{ courseId=$courseId; limit=2 }
$q1 = Api "GET" $q1Url $studentHeaders $null
Assert-Ok ($q1.ok -eq $true) "List quizzes page1 failed"
Assert-Ok ($q1.quizzes.Count -eq 2) "Expected 2 quizzes on page1"
Assert-Ok ($q1.nextCursor) "Expected nextCursor on page1"
Write-Pass "Pagination page1 OK (nextCursor present)"

$q2Url = Build-Url $Base "/quizzes" @{ courseId=$courseId; limit=2; cursor=$q1.nextCursor }
$q2 = Api "GET" $q2Url $studentHeaders $null
Assert-Ok ($q2.ok -eq $true) "List quizzes page2 failed"
Assert-Ok ($q2.quizzes.Count -ge 1) "Expected at least 1 quiz on page2"
Write-Pass "Pagination page2 OK"

# 8) Fetch quiz as student (answerIndex must be hidden)
$quizId = [string]$q1.quizzes[0]._id
$getQuizUrl = Build-Url $Base ("/quizzes/{0}" -f $quizId) @{}
$quiz = Api "GET" $getQuizUrl $studentHeaders $null
Assert-Ok ($quiz.ok -eq $true) "Student quiz fetch failed"
# validate hidden keys
$leaked = $false
foreach ($qq in $quiz.quiz.questions) {
  if ($null -ne $qq.answerIndex) { $leaked = $true }
}
Assert-Ok (-not $leaked) "Student quiz leaked answerIndex"
Write-Pass "Student quiz fetch OK (answerIndex hidden)"

# 9) Submit result with idempotency (twice should return same result)
$attemptKey = ("attempt-{0}" -f ([Guid]::NewGuid().ToString("N")))
$answers = @()
for ($i=0; $i -lt $quiz.quiz.questions.Count; $i++) { $answers += 0 }

$submitUrl = Build-Url $Base "/results/submit" @{}
$body = @{ courseId=$courseId; quizId=$quizId; answers=$answers; attemptKey=$attemptKey }

$r1 = Api "POST" $submitUrl $studentHeaders $body
Assert-Ok ($r1.ok -eq $true) "Submit attempt #1 failed"
Write-Pass ("Submit #1 OK (score {0}%)" -f $r1.result.score)

$r2 = Api "POST" $submitUrl $studentHeaders $body
Assert-Ok ($r2.ok -eq $true) "Submit attempt #2 failed"
Assert-Ok ($r2.idempotent -eq $true) "Expected idempotent=true on 2nd submit"
Assert-Ok ($r2.result._id -eq $r1.result._id) "Idempotency failed (different result id)"
Write-Pass "Idempotency OK (double submit returns same result)"

# 10) Rate limit test (burst until 429)
Write-Info "Rate limit test (expect 429 at some point)"
$hit429 = $false
for ($i=0; $i -lt 15; $i++) {
  $k = ("attempt-{0}" -f ([Guid]::NewGuid().ToString("N")))
  $b = @{ courseId=$courseId; quizId=$quizId; answers=$answers; attemptKey=$k }
  try {
    $null = Api "POST" $submitUrl $studentHeaders $b
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 429) {
      $hit429 = $true
      break
    }
  }
}
Assert-Ok ($hit429) "Expected to observe 429 rate limit but did not"
Write-Pass "Rate limit OK (429 observed)"

# 11) Results/me
$mineUrl = Build-Url $Base "/results/me" @{}
$mine = Api "GET" $mineUrl $studentHeaders $null
Assert-Ok ($mine.ok -eq $true) "Results/me failed"
Write-Pass ("Results/me OK (returned {0})" -f $mine.results.Count)

Write-Pass "ALL SMOKE TESTS PASSED ✅"
Write-Info ("Server left running (PID {0})" -f $proc.Id)
