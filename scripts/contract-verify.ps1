Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

$root = Get-RepoRoot
Set-Location $root

$contracts = Join-Path $PSScriptRoot "_contracts"
if (-not (Test-Path $contracts)) {
  throw "No contracts found. Run: .\scripts\contract-baseline.ps1"
}

Write-Section "Contract Verify (compare current vs golden)"
$e2e = Join-Path $PSScriptRoot "e2e-student-take-quiz.ps1"
if (-not (Test-Path $e2e)) { throw "Missing scripts\e2e-student-take-quiz.ps1." }

# Run E2E to regenerate fresh dumps
& $e2e

$dumpsDir = Join-Path $PSScriptRoot "_dumps"
if (-not (Test-Path $dumpsDir)) { throw "Missing scripts\_dumps." }

function Compare-JsonFile([string]$goldPath, [string]$latestGlob) {
  $gold = Get-Content -Raw -Path $goldPath
  $latest = Get-ChildItem $dumpsDir -Filter $latestGlob -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($null -eq $latest) { throw "Missing latest dump for $latestGlob" }
  $cur = Get-Content -Raw -Path $latest.FullName

  if ($gold -eq $cur) {
    Write-Host ("✅ Match: {0}" -f (Split-Path $goldPath -Leaf)) -ForegroundColor Green
    return $true
  }

  Write-Host ("❌ Drift: {0}" -f (Split-Path $goldPath -Leaf)) -ForegroundColor Red
  Write-Host ("   Golden: {0}" -f $goldPath) -ForegroundColor DarkGray
  Write-Host ("   Current: {0}" -f $latest.FullName) -ForegroundColor DarkGray
  return $false
}

$ok = $true
$map = @{
  "login.golden.json"        = "login-*.json"
  "courses.golden.json"      = "courses-*.json"
  "course-quizzes.golden.json" = "course-quizzes-*.json"
  "player.golden.json"       = "player-*.json"
  "submit.golden.json"       = "submit-*.json"
}

foreach ($k in $map.Keys) {
  $gold = Join-Path $contracts $k
  if (Test-Path $gold) {
    $ok = (Compare-JsonFile $gold $map[$k]) -and $ok
  } else {
    Write-Host ("⚠️ Missing baseline: {0} (skipping)" -f $k) -ForegroundColor Yellow
  }
}

Write-Section "Result"
if (-not $ok) { throw "Contract verification FAILED (backend drift detected). Fix backend or refresh baseline intentionally." }
Write-Host "✅ Contract verification PASSED (responses match baseline)." -ForegroundColor Green