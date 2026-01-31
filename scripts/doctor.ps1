Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

$root = Get-RepoRoot
Set-Location $root

function Test-ServerUp([string]$Url) {
  try {
    $null = Invoke-RestMethod -Method GET -Uri $Url -TimeoutSec 3
    return $true
  } catch { return $false }
}

Write-Section "Doctor: Backend Integrity Pass"
Write-Host ("Repo: {0}" -f $root) -ForegroundColor Gray

Write-Section "Node + NPM sanity"
node -v
npm -v

Write-Section "Install (if needed)"
if (-not (Test-Path ".\node_modules")) {
  npm ci
} else {
  Write-Host "node_modules exists; skipping npm ci" -ForegroundColor DarkGray
}

Write-Section "Start server (background) + wait"
$baseUrl = if ($env:MC_BASE_URL) { $env:MC_BASE_URL } else { "http://localhost:4000" }

# Start server only if not reachable
if (-not (Test-ServerUp "$baseUrl/")) {
  $p = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 2
  $tries = 0
  while (-not (Test-ServerUp "$baseUrl/")) {
    $tries++
    if ($tries -ge 20) {
      try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
      throw "Server did not become reachable at $baseUrl"
    }
    Start-Sleep -Milliseconds 500
  }
  Write-Host ("✅ Server reachable: {0}" -f $baseUrl) -ForegroundColor Green
} else {
  Write-Host ("✅ Server already reachable: {0}" -f $baseUrl) -ForegroundColor Green
}

Write-Section "Run auth E2E smoke"
$auth = Join-Path $PSScriptRoot "e2e-auth-smoke.ps1"
if (-not (Test-Path $auth)) { throw "Missing scripts\e2e-auth-smoke.ps1" }
& $auth

Write-Section "Run student take quiz E2E"
$quiz = Join-Path $PSScriptRoot "e2e-student-take-quiz.ps1"
if (-not (Test-Path $quiz)) { throw "Missing scripts\e2e-student-take-quiz.ps1" }
& $quiz

Write-Section "Contract check (optional but recommended)"
$cv = Join-Path $PSScriptRoot "contract-verify.ps1"
$cb = Join-Path $PSScriptRoot "contract-baseline.ps1"
if (Test-Path (Join-Path $PSScriptRoot "_contracts")) {
  & $cv
} else {
  Write-Host "⚠️ No baseline yet. Creating baseline now..." -ForegroundColor Yellow
  & $cb
}

Write-Section "DONE"
Write-Host "✅ Doctor passed: auth + quiz E2E + contracts OK" -ForegroundColor Green