Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

$root = Get-RepoRoot
Set-Location $root

$baseUrl = if ($env:MC_BASE_URL) { $env:MC_BASE_URL } else { "http://localhost:4000" }
$outDir = Join-Path $PSScriptRoot "_contracts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Section "Contract Baseline (writes golden responses)"
Write-Host ("Base URL: {0}" -f $baseUrl) -ForegroundColor Gray
Write-Host ("Output:   {0}" -f $outDir) -ForegroundColor Gray

# Prefer calling your existing E2E to generate dumps + token.
# This keeps auth logic in one place.
$e2e = Join-Path $PSScriptRoot "e2e-student-take-quiz.ps1"
if (-not (Test-Path $e2e)) { throw "Missing scripts\e2e-student-take-quiz.ps1. (It should exist if Doctor passed.)" }

Write-Section "Run E2E once (to ensure server + flows work)"
& $e2e

# Use the newest dumps created by the E2E harness as baseline artifacts
$dumpsDir = Join-Path $PSScriptRoot "_dumps"
if (-not (Test-Path $dumpsDir)) { throw "Missing scripts\_dumps. E2E should have created it." }

# Copy the most recent known dump types if present
$types = @("login","courses","course-quizzes","player","submit")
foreach ($t in $types) {
  $latest = Get-ChildItem $dumpsDir -Filter "$t-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($null -ne $latest) {
    $dest = Join-Path $outDir ("{0}.golden.json" -f $t)
    Copy-Item -Force $latest.FullName $dest
    Write-Host ("✅ Baseline: {0}" -f $dest) -ForegroundColor Green
  } else {
    Write-Host ("⚠️ No dump found for type: {0}" -f $t) -ForegroundColor Yellow
  }
}

Write-Section "Done"
Write-Host "Baseline captured. Next: run scripts\contract-verify.ps1 to detect drift." -ForegroundColor Green