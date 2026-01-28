param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

Write-Host "== CI CHECK ==" -ForegroundColor Cyan

if (!(Test-Path "package.json")) { throw "package.json not found. Run from repo root." }

# Ensure hygiene
if (Test-Path "scripts\repo-hygiene.ps1") {
  Write-Host "Running repo hygiene..." -ForegroundColor Cyan
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/repo-hygiene.ps1
} else {
  Write-Host "scripts/repo-hygiene.ps1 not found. Skipping hygiene." -ForegroundColor Yellow
}

# Install deps
if (-not $SkipInstall) {
  if (Test-Path "package-lock.json") {
    Write-Host "npm ci..." -ForegroundColor Cyan
    npm ci
  } else {
    Write-Host "npm install (no package-lock.json found)..." -ForegroundColor Yellow
    npm install
  }
}

# Lint (if defined)
try {
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  if ($pkg.scripts.PSObject.Properties.Name -contains "lint") {
    Write-Host "npm run lint..." -ForegroundColor Cyan
    npm run lint
  } else {
    Write-Host "No lint script found. Skipping." -ForegroundColor Yellow
  }
} catch {
  Write-Host "Could not parse package.json. Skipping lint detection." -ForegroundColor Yellow
}

# Tests (if defined)
try {
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  if ($pkg.scripts.PSObject.Properties.Name -contains "test") {
    Write-Host "npm test..." -ForegroundColor Cyan
    npm test
  } else {
    Write-Host "No test script found. Skipping." -ForegroundColor Yellow
  }
} catch {}

# Type check (if defined)
try {
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  if ($pkg.scripts.PSObject.Properties.Name -contains "typecheck") {
    Write-Host "npm run typecheck..." -ForegroundColor Cyan
    npm run typecheck
  } else {
    Write-Host "No typecheck script found. Skipping." -ForegroundColor Yellow
  }
} catch {}

Write-Host "CI CHECK: OK" -ForegroundColor Green
