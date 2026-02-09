Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\Invoke-Api.ps1"

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

$BaseUrl = if ($env:MC_BASEURL) { $env:MC_BASEURL.TrimEnd("/") } else { "http://127.0.0.1:4000" }
$artDir = Join-Path (Get-Location) "scripts\artifacts"
New-Item -ItemType Directory -Force -Path $artDir | Out-Null

Write-Section "CONFIG"
Write-Host "BASE_URL = $BaseUrl"

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$stamp = NowStamp
$email = "student_$stamp@example.com"
$pass  = "Passw0rd!$stamp"

try {
  Write-Section "REGISTER"
  $reg = Invoke-Api -Method POST -Url "$BaseUrl/api/auth/register" -Session $session -Body @{
    email    = $email
    password = $pass
    role     = "student"
  } -AllowNon2xx

  Dump-Json (Join-Path $artDir "register_$stamp.json") $reg

  if ($reg.ok -eq $false) {
    throw "REGISTER_FAILED: $($reg.status) $($reg.message)"
  }

  Write-Host "registered: $email"

  Write-Section "LOGIN"
  $login = Invoke-Api -Method POST -Url "$BaseUrl/api/auth/login" -Session $session -Body @{
    email    = $email
    password = $pass
  } -AllowNon2xx

  Dump-Json (Join-Path $artDir "login_$stamp.json") $login

  if ($login.ok -eq $false) {
    throw "LOGIN_FAILED: $($login.status) $($login.message)"
  }

  # Token may be token/accessToken/jwt depending on your controller
  $token = $login.token
  if ([string]::IsNullOrWhiteSpace($token)) { $token = $login.accessToken }
  if ([string]::IsNullOrWhiteSpace($token)) { $token = $login.jwt }

  if ([string]::IsNullOrWhiteSpace($token)) {
    throw "LOGIN_OK but no token returned. Check login_* artifact JSON to see the field name."
  }

  Write-Host "login ok (token acquired)" -ForegroundColor Green

  Write-Section "LIST QUIZZES (AUTH HEADER)"
  $q = Invoke-Api -Method GET -Url "$BaseUrl/api/quizzes" -Session $session -Token $token -AllowNon2xx
  Dump-Json (Join-Path $artDir "quizzes_$stamp.json") $q

  if ($q.ok -eq $false) {
    throw "LIST_QUIZZES_FAILED: $($q.status) $($q.message)"
  }

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
  $player = Invoke-Api -Method GET -Url "$BaseUrl/api/quizzes/$quizId/player" -Session $session -Token $token -AllowNon2xx
  Dump-Json (Join-Path $artDir "quiz_player_$stamp.json") $player

  if ($player.ok -eq $false) {
    throw "PLAYER_FAILED: $($player.status) $($player.message)"
  }

  $items = @()
  if ($null -ne $player.items) { $items = @($player.items) }
  elseif ($null -ne $player.questions) { $items = @($player.questions) }
  elseif ($null -ne $player.quiz -and $null -ne $player.quiz.items) { $items = @($player.quiz.items) }

  if (@($items).Count -lt 1) { throw "Quiz for player contains zero items/questions" }

  $answers = @()
  for ($i=0; $i -lt @($items).Count; $i++) { $answers += 0 }

  Write-Section "SUBMIT"
  $submit = Invoke-Api -Method POST -Url "$BaseUrl/api/quizzes/$quizId/submit" -Session $session -Token $token -Body @{
    answers = $answers
  } -AllowNon2xx
  Dump-Json (Join-Path $artDir "submit_$stamp.json") $submit

  if ($submit.ok -eq $false) {
    throw "SUBMIT_FAILED: $($submit.status) $($submit.message)"
  }

  Write-Host ""
  Write-Host "E2E PASSED ✅" -ForegroundColor Green
  Write-Host "Artifacts: $artDir" -ForegroundColor DarkGray
}
catch {
  Write-Host ""
  Write-Host "E2E FAILED ❌" -ForegroundColor Red
  Write-Host $_ -ForegroundColor Red
  Write-Host "Artifacts folder: $artDir" -ForegroundColor Yellow
  exit 1
}
