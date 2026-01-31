Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "Invoke-Api.ps1")

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$base = $env:BASE_URL
if ([string]::IsNullOrWhiteSpace($base)) { $base = "http://localhost:4000" }

Write-Section "1) Repo + Environment"
Write-Host "Repo:  $root" -ForegroundColor DarkGray
Write-Host "Base:  $base" -ForegroundColor DarkGray
Write-Host "Node:  $((node -v) 2>$null)" -ForegroundColor DarkGray
Write-Host "NPM:   $((npm -v) 2>$null)" -ForegroundColor DarkGray

Write-Section "2) Server Reachability"
try {
  Invoke-Api -Method GET -Url "$base/" | Out-Null
  Write-Host "✅ Server reachable on $base" -ForegroundColor Green
} catch {
  Write-Host "❌ Server not reachable on $base" -ForegroundColor Red
  Write-Host "Run the server in another terminal: npm start" -ForegroundColor Yellow
  exit 1
}

Write-Section "3) Auth Smoke"
& (Join-Path $PSScriptRoot "e2e-auth-smoke.ps1")

Write-Section "4) Student Takes Quiz"
& (Join-Path $PSScriptRoot "e2e-student-take-quiz.ps1")

Write-Section "DONE"
Write-Host "✅ doctor.ps1 complete: auth + quiz E2E verified." -ForegroundColor Green