param(
  [string]$ArtifactsPath = ".\smoke-artifacts.json"
)

if (!(Test-Path $ArtifactsPath)) { throw "Missing $ArtifactsPath. Run .\smoke-e2e.ps1 first." }

$a = Get-Content $ArtifactsPath -Raw | ConvertFrom-Json
$base = $a.base.TrimEnd("/")
$quizId = $a.quizId
$studentTok = $a.student.token

if ([string]::IsNullOrWhiteSpace($studentTok)) { throw "Artifacts missing student.token" }
if ($studentTok.Split(".").Count -ne 3) { throw "Student token doesn't look like a JWT (expected 3 dot-separated parts)" }

$h = @{ Authorization = "Bearer $studentTok"; Accept="application/json" }

Write-Host "BASE  : $base" -ForegroundColor Cyan
Write-Host "QuizId : $quizId" -ForegroundColor Cyan

Write-Host "`n[CALL] GET /results/mine" -ForegroundColor Cyan
irm "$base/results/mine" -Headers $h | ConvertTo-Json -Depth 30

Write-Host "`n[CALL] GET /quizzes/:id" -ForegroundColor Cyan
irm "$base/quizzes/$quizId" -Headers $h | ConvertTo-Json -Depth 30
