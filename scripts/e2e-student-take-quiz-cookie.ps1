$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function NowStamp { (Get-Date).ToString("yyyyMMdd_HHmmss") }

function Dump-Json([string]$Path, $Obj) {
  $dir = Split-Path $Path -Parent
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $json = $Obj | ConvertTo-Json -Depth 30
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    $Body = $null
  )

  $common = @{
    Method     = $Method
    Uri        = $Url
    WebSession = $Session
    TimeoutSec = 30
  }

  if ($null -ne $Body) {
    return Invoke-RestMethod @common -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 30)
  } else {
    return Invoke-RestMethod @common
  }
}

$BaseUrl = if (-not [string]::IsNullOrWhiteSpace($env:MC_BASEURL)) { $env:MC_BASEURL.TrimEnd("/") } else { "http://127.0.0.1:4000" }
$artDir = Join-Path (Get-Location) "scripts\artifacts"
New-Item -ItemType Directory -Force -Path $artDir | Out-Null

Write-Section "CONFIG"
Write-Host "BASE_URL = $BaseUrl"

# Keep cookies here
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Unique student
$stamp = NowStamp
$email = "student_$stamp@example.com"
$pass  = "Passw0rd!$stamp"

try {
  Write-Section "REGISTER"
  $reg = Invoke-Api -Method POST -Url "$BaseUrl/api/auth/register" -Session $session -Body @{
    email = $email
    password = $pass
    role = "student"
  }
  Dump-Json (Join-Path $artDir "register_$stamp.json") $reg
  Write-Host "registered: $email"

  Write-Section "LOGIN"
  $login = Invoke-Api -Method POST -Url "$BaseUrl/api/auth/login" -Session $session -Body @{
    email = $email
    password = $pass
  }
  Dump-Json (Join-Path $artDir "login_$stamp.json") $login
  Write-Host "login ok"

  Write-Section "LIST QUIZZES"
  $q = Invoke-Api -Method GET -Url "$BaseUrl/api/quizzes" -Session $session
  Dump-Json (Join-Path $artDir "quizzes_$stamp.json") $q

  # normalize quiz list shape
  $list = @()
  if ($null -ne $q.items) { $list = @($q.items) }
  elseif ($null -ne $q.quizzes) { $list = @($q.quizzes) }
  elseif ($q -is [System.Collections.IEnumerable] -and -not ($q -is [string])) { $list = @($q) }

  if (@($list).Count -lt 1) { throw "No quizzes returned from GET /api/quizzes" }

  $quiz = $list[0]
  $quizId = $quiz._id
  if ([string]::IsNullOrWhiteSpace($quizId)) { $quizId = $quiz.id }
  if ([string]::IsNullOrWhiteSpace($quizId)) { throw "Quiz is missing id/_id" }

  Write-Host "quizId = $quizId"

  Write-Section "GET QUIZ FOR PLAYER"
  $player = Invoke-Api -Method GET -Url "$BaseUrl/api/quizzes/$quizId/player" -Session $session
  Dump-Json (Join-Path $artDir "quiz_player_$stamp.json") $player

  $items = @()
  if ($null -ne $player.items) { $items = @($player.items) }
  elseif ($null -ne $player.questions) { $items = @($player.questions) }
  elseif ($null -ne $player.quiz -and $null -ne $player.quiz.items) { $items = @($player.quiz.items) }

  if (@($items).Count -lt 1) { throw "Quiz for player contains zero items/questions" }

  # Choose answer 0 for each item
  $answers = @()
  for ($i=0; $i -lt @($items).Count; $i++) { $answers += 0 }

  Write-Section "SUBMIT"
  $submit = Invoke-Api -Method POST -Url "$BaseUrl/api/quizzes/$quizId/submit" -Session $session -Body @{
    answers = $answers
  }
  Dump-Json (Join-Path $artDir "submit_$stamp.json") $submit

  Write-Host ""
  Write-Host "E2E PASSED ✅" -ForegroundColor Green
  Write-Host "Artifacts: $artDir" -ForegroundColor DarkGray
}
catch {
  Write-Host ""
  Write-Host "E2E FAILED ❌" -ForegroundColor Red
  Write-Host $_ -ForegroundColor Red
  exit 1
}