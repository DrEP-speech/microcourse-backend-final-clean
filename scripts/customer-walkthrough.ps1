$ErrorActionPreference = "Stop"

function Assert-Ok($cond, $msg) {
  if (-not $cond) { throw $msg }
}

function Api($method, $uri, $headers=$null, $bodyObj=$null) {
  $params = @{
    Method = $method
    Uri = $uri
  }
  if ($headers) { $params.Headers = $headers }
  if ($bodyObj -ne $null) {
    $params.ContentType = "application/json"
    $params.Body = ($bodyObj | ConvertTo-Json -Depth 30)
  }
  return Invoke-RestMethod @params
}

# --- Base URL (ALWAYS set in THIS session)
$base = "http://localhost:4000/api"
$base = ($base -replace '\s+$','')

Write-Host "Base = $base" -ForegroundColor Cyan

# --- 0) Verify backend is reachable
try {
  $health = Api "GET" "$base/health"
  Assert-Ok ($health.ok -eq $true) "Health check failed."
  Write-Host "✅ Health OK: $($health.service) @ $($health.time)" -ForegroundColor Green
} catch {
  Write-Host "❌ Cannot reach API. Is `npm run dev` running on port 4000?" -ForegroundColor Red
  throw
}

# --- 1) Login as demo student
$loginBody = @{
  email = "student1@demo.local"
  password = "Password123!"
}

$login = Api "POST" "$base/auth/login" $null $loginBody
Assert-Ok ($login.ok -eq $true -and $login.token) "Login failed or token missing."
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "✅ Logged in as student. Token length: $($token.Length)" -ForegroundColor Green

# --- 2) List courses
$coursesRes = Api "GET" "$base/courses" $headers
Assert-Ok ($coursesRes.ok -eq $true) "Courses endpoint failed."
Assert-Ok ($coursesRes.courses.Count -gt 0) "No courses returned."

Write-Host "`nCourses:" -ForegroundColor Cyan
$coursesRes.courses | Select-Object title, slug, status, _id | Format-Table -AutoSize

$courseId = $coursesRes.courses[0]._id
Write-Host "Using courseId = $courseId" -ForegroundColor Yellow

# --- 3) List lessons for chosen course
$lessonsRes = Api "GET" "$base/courses/$courseId/lessons" $headers
Assert-Ok ($lessonsRes.ok -eq $true) "Lessons endpoint failed."

Write-Host "`nLessons:" -ForegroundColor Cyan
$lessonsRes.lessons | Select-Object order, title, videoUrl, _id | Format-Table -AutoSize

# --- 4) List quizzes for chosen course
$quizzesRes = Api "GET" "$base/quizzes?courseId=$courseId" $headers
Assert-Ok ($quizzesRes.ok -eq $true) "Quizzes list endpoint failed."
Assert-Ok ($quizzesRes.quizzes.Count -gt 0) "No quizzes returned for this course."

Write-Host "`nQuizzes:" -ForegroundColor Cyan
$quizzesRes.quizzes | Select-Object title, _id | Format-Table -AutoSize

$quizId = $quizzesRes.quizzes[0]._id
Write-Host "Using quizId = $quizId" -ForegroundColor Yellow

# --- 5) Fetch quiz details (and confirm questions have answerIndex)
$quizRes = Api "GET" "$base/quizzes/$quizId" $headers
Assert-Ok ($quizRes.ok -eq $true) "Quiz detail endpoint failed."
Assert-Ok ($quizRes.quiz -ne $null) "Quiz payload missing 'quiz' property."

$quiz = $quizRes.quiz
Assert-Ok ($quiz.questions.Count -gt 0) "Quiz has no questions."

Write-Host "`nQuiz Detail:" -ForegroundColor Cyan
Write-Host "Title: $($quiz.title)"
Write-Host "Questions: $($quiz.questions.Count)"

# Validate schema: answerIndex present
$missing = @()
for ($i=0; $i -lt $quiz.questions.Count; $i++) {
  if ($null -eq $quiz.questions[$i].answerIndex) { $missing += $i }
}
Assert-Ok ($missing.Count -eq 0) ("Quiz questions missing answerIndex at positions: " + ($missing -join ", "))

# --- 6) Submit intentionally-naive answers (all zeros)
$answers = @()
for ($i=0; $i -lt $quiz.questions.Count; $i++) { $answers += 0 }

$submitBody = @{
  courseId = $courseId
  quizId   = $quizId
  answers  = $answers
}

$resultRes = Api "POST" "$base/results/submit" $headers $submitBody
Assert-Ok ($resultRes.ok -eq $true) "Submit failed."

Write-Host "`n✅ Submitted quiz." -ForegroundColor Green
Write-Host ("Score: {0}% ({1}/{2})" -f $resultRes.result.score, $resultRes.result.correctCount, $resultRes.result.total) -ForegroundColor Green

# --- 7) Get my results
$myRes = Api "GET" "$base/results/me" $headers
Assert-Ok ($myRes.ok -eq $true) "Results/me failed."

Write-Host "`nMy Results (latest first):" -ForegroundColor Cyan
$myRes.results | Select-Object createdAt, score, total, correctCount, quizId | Format-Table -AutoSize

Write-Host "`n✅ Customer walkthrough complete." -ForegroundColor Green
