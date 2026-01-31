Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "Invoke-Api.ps1")

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

$base = $env:BASE_URL
if ([string]::IsNullOrWhiteSpace($base)) { $base = "http://localhost:4000" }

# Unique user each run
$rand = -join ((97..122) | Get-Random -Count 8 | ForEach-Object {[char]$_})
$email = "student+$rand@example.com"
$pw = "Password123!"
$name = "Seed Student $rand"

Write-Section "REGISTER UNIQUE STUDENT"
try {
  Invoke-Api -Method POST -Url "$base/api/auth/register" -JsonBody @{
    email = $email
    password = $pw
    name = $name
    role = "student"
  } | Out-Null
} catch {
  Write-Host "Register failed (continuing): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Section "LOGIN"
$login = Invoke-Api -Method POST -Url "$base/api/auth/login" -JsonBody @{
  email = $email
  password = $pw
}
$dump = Save-Dump -Name "login" -Object $login
Write-Host "Saved dump: $dump" -ForegroundColor DarkGray

if (-not $login.token) { throw "Login response missing token." }
$token = $login.token
Write-Host ("TOKEN prefix: {0}..." -f $token.Substring(0, [Math]::Min(25,$token.Length))) -ForegroundColor Green
$h = @{ Authorization = "Bearer $token" }

Write-Section "LIST PUBLISHED COURSES"
$courses = Invoke-Api -Method GET -Url "$base/api/courses" -Headers $h
$dump = Save-Dump -Name "courses" -Object $courses
Write-Host "Saved dump: $dump" -ForegroundColor DarkGray

# Choose first course
$courseId = $null
if ($courses -is [System.Array]) {
  $courseId = $courses[0]._id
} elseif ($courses.courses -is [System.Array]) {
  $courseId = $courses.courses[0]._id
}

if (-not $courseId) { throw "Could not find a courseId in /api/courses response." }
Write-Host "Using courseId: $courseId" -ForegroundColor Green

Write-Section "LIST COURSE QUIZZES"
$courseQuizzes = Invoke-Api -Method GET -Url "$base/api/courses/$courseId/quizzes" -Headers $h
$dump = Save-Dump -Name "course-quizzes" -Object $courseQuizzes
Write-Host "Saved dump: $dump" -ForegroundColor DarkGray

$quizId = $null
if ($courseQuizzes -is [System.Array]) {
  $quizId = $courseQuizzes[0]._id
} elseif ($courseQuizzes.quizzes -is [System.Array]) {
  $quizId = $courseQuizzes.quizzes[0]._id
}

if (-not $quizId) { throw "Could not find a quizId in course quizzes response." }
Write-Host "Using quizId: $quizId" -ForegroundColor Green

Write-Section "GET QUIZ PLAYER PAYLOAD"
$player = Invoke-Api -Method GET -Url "$base/api/quizzes/$quizId/player" -Headers $h
$dump = Save-Dump -Name "player" -Object $player
Write-Host "Saved dump: $dump" -ForegroundColor DarkGray

# Find questions array in common shapes
$qArr = $null
if ($player.questions -is [System.Array]) { $qArr = $player.questions }
elseif ($player.quiz -and $player.quiz.questions -is [System.Array]) { $qArr = $player.quiz.questions }

if (-not $qArr) { throw "Could not find questions[] in player payload." }
Write-Host ("Questions found: {0}" -f $qArr.Count) -ForegroundColor Green

Write-Section "BUILD NAIVE ANSWERS (all zeros)"
$answers = @()
for ($i=0; $i -lt $qArr.Count; $i++) {
  $answers += @{
    questionIndex = $i
    choiceIndex   = 0
  }
}

Write-Section "SUBMIT QUIZ (try consumer, then standard, then legacy)"
$submitBody = @{
  answers = $answers
}

$submitResp = $null
$pathsTried = @()

# 1) Consumer endpoint (known-good in your logs)
try {
  $pathsTried += "POST /api/quizzes/$quizId/submit-consumer"
  $submitResp = Invoke-Api -Method POST -Url "$base/api/quizzes/$quizId/submit-consumer" -Headers $h -JsonBody $submitBody
} catch {
  Write-Host "Consumer submit failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2) Standard endpoint
if (-not $submitResp) {
  try {
    $pathsTried += "POST /api/quizzes/$quizId/submit"
    $submitResp = Invoke-Api -Method POST -Url "$base/api/quizzes/$quizId/submit" -Headers $h -JsonBody $submitBody
  } catch {
    Write-Host "Standard submit failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# 3) Legacy (if you have it)
if (-not $submitResp) {
  try {
    $pathsTried += "POST /api/quizzes/$quizId/submit-legacy"
    $submitResp = Invoke-Api -Method POST -Url "$base/api/quizzes/$quizId/submit-legacy" -Headers $h -JsonBody $submitBody
  } catch {
    Write-Host "Legacy submit failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

if (-not $submitResp) {
  throw ("All submit attempts failed. Tried: {0}" -f ($pathsTried -join ", "))
}

$dump = Save-Dump -Name "submit" -Object $submitResp
Write-Host "Saved dump: $dump" -ForegroundColor DarkGray
Write-Host "✅ Submit succeeded." -ForegroundColor Green

Write-Section "DONE"
Write-Host "✅ E2E student take quiz flow complete." -ForegroundColor Green