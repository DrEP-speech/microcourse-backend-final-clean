param(
  [string]$BaseUrl = "http://localhost:11001",
  [string]$Password = "TestPass123!"
)

$ErrorActionPreference = "Stop"

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [string]$Method = "GET",
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $urls = @("$BaseUrl$Path", ($BaseUrl -replace "localhost","127.0.0.1") + $Path)

  foreach ($u in $urls) {
    try {
      if ($Body -ne $null) {
        return Invoke-RestMethod -Method $Method -Uri $u -ContentType "application/json" -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 25)
      } else {
        return Invoke-RestMethod -Method $Method -Uri $u -Headers $Headers
      }
    } catch { $last = $_; continue }
  }
  throw "All URL attempts failed for $Path`nLastError: $($last.Exception.Message)"
}

Write-Host "`n=== HEALTH ===" -ForegroundColor Cyan
Invoke-Api -Path "/health" | ConvertTo-Json -Depth 10

$rand = Get-Random -Maximum 999999
$reg = @{ name="Test User"; email="test$rand@example.com"; password=$Password; role="instructor" }

Write-Host "`n=== REGISTER ===" -ForegroundColor Cyan
$regRes = Invoke-Api -Path "/api/auth/register" -Method "POST" -Body $reg
$regRes | ConvertTo-Json -Depth 10

Write-Host "`n=== LOGIN ===" -ForegroundColor Cyan
$loginRes = Invoke-Api -Path "/api/auth/login" -Method "POST" -Body @{ email=$reg.email; password=$reg.password }
$loginRes | ConvertTo-Json -Depth 10

$token = $loginRes.token
if (-not $token) { throw "Missing token from login response" }
$h = @{ Authorization = "Bearer $token" }

Write-Host "`n=== CREATE COURSE (protected) ===" -ForegroundColor Cyan
$c = Invoke-Api -Path "/api/courses" -Method "POST" -Headers $h -Body @{
  title="Production Product Course"
  description="Created by test-product.ps1"
  category="Product"
  level="Beginner"
  tags=@("prod","product")
  priceCents=999
  published=$true
}
$c | ConvertTo-Json -Depth 10
$courseId = $c.item._id
if (-not $courseId) { throw "Missing courseId" }

Write-Host "`n=== CREATE QUIZ (protected) ===" -ForegroundColor Cyan
$q = Invoke-Api -Path "/api/quizzes" -Method "POST" -Headers $h -Body @{
  courseId=$courseId
  title="Production Product Quiz"
  status="published"
  published=$true
  timeLimitMinutes=5
  passingScore=70
  items=@(@{
    type="mc"
    prompt="What is a thesis?"
    choices=@("A","B","C","D")
    answer="Central claim of a speech"
    explanation="Anchors the talk."
    points=1
  })
}
$q | ConvertTo-Json -Depth 10

Write-Host "`n=== LIST COURSES (public) ===" -ForegroundColor Cyan
Invoke-Api -Path "/api/courses" | ConvertTo-Json -Depth 6

Write-Host "`n=== LIST QUIZZES (public) ===" -ForegroundColor Cyan
Invoke-Api -Path "/api/quizzes" | ConvertTo-Json -Depth 6

Write-Host "`n✅ Product API tests completed successfully." -ForegroundColor Green

