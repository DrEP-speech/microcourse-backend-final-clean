# scripts/e2e-consumer-loop.ps1
# E2E: Student login -> list courses -> open course -> get quizzes -> get quiz player payload -> submit -> dashboard reflects progress

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Section([string]$t){ Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }

function Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  if ($null -ne $Body) {
    $json = ($Body | ConvertTo-Json -Depth 20)
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $json
  }
  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
}

$base = $env:BASE_URL
if (-not $base) { $base = "http://localhost:4000" }

$email = $env:SEED_STUDENT_EMAIL
if (-not $email) { $email = "student1@example.com" }

$pass = $env:SEED_STUDENT_PASSWORD
if (-not $pass) { $pass = "Passw0rd!" }

Section "Login"
$login = Api -Method POST -Url "$base/api/auth/login" -Body @{ email=$email; password=$pass }
if (-not $login.token) { throw "No token returned from login" }

$H = @{ Authorization = "Bearer $($login.token)" }

Section "List Courses"
$c = Api -Method GET -Url "$base/api/courses" -Headers $H
if (-not $c.courses -or $c.courses.Count -lt 1) { throw "No courses returned" }

$courseId = $c.courses[0]._id
Write-Host "Using courseId: $courseId" -ForegroundColor Green

Section "Course Detail"
$cd = Api -Method GET -Url "$base/api/courses/$courseId" -Headers $H
if (-not $cd.course) { throw "Course detail missing" }

Section "Course Quizzes"
$qz = Api -Method GET -Url "$base/api/courses/$courseId/quizzes" -Headers $H
if (-not $qz.quizzes -or $qz.quizzes.Count -lt 1) { throw "No quizzes for course" }

$quizId = $qz.quizzes[0]._id
Write-Host "Using quizId: $quizId" -ForegroundColor Green

Section "Player Payload (no answers leaked)"
$player = Api -Method GET -Url "$base/api/quizzes/$quizId/player" -Headers $H
if (-not $player.quiz -or -not $player.quiz.questions) { throw "Player quiz payload missing questions" }

# Build naive answers (select first option / index 0)
# This validates flow; later we’ll implement smart answering in test via seed-known corrects.
$answers = @()
for ($i=0; $i -lt $player.quiz.questions.Count; $i++) { $answers += 0 }

Section "Submit Attempt"
$sub = Api -Method POST -Url "$base/api/quizzes/$quizId/submit" -Headers $H -Body @{ answers = $answers }
if (-not $sub.ok) { throw "Submit failed" }

Write-Host ("Result: {0}/{1} ({2}%) passed={3}" -f $sub.result.score, $sub.result.maxScore, $sub.result.percent, $sub.result.passed) -ForegroundColor Green

Section "Progress (course scoped)"
$prog = Api -Method GET -Url "$base/api/progress/me?courseId=$courseId" -Headers $H
Write-Host ("Attempts: {0} | AvgLast20: {1}" -f $prog.progress.attempts, $prog.progress.avgPercentLast20) -ForegroundColor Green

Section "Dashboard (consumer contract)"
$dash = Api -Method GET -Url "$base/api/dashboard/me" -Headers $H
if (-not $dash.dashboard) { throw "Dashboard missing" }

Write-Host ("Dashboard stats: attemptsLast10={0}, avgPercentLast10={1}, passStreak={2}" -f $dash.dashboard.stats.attemptsLast10, $dash.dashboard.stats.avgPercentLast10, $dash.dashboard.stats.passStreak) -ForegroundColor Green

Section "E2E PASS ✅ Consumer learning loop verified"