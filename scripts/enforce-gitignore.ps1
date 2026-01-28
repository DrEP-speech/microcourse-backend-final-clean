# scripts/enforce-gitignore.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-GitIgnoreLine {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [AllowNull()][AllowEmptyString()][string]$Line
  )
  if ([string]::IsNullOrWhiteSpace($Line)) { return }

  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }

  $existing = Get-Content $Path -ErrorAction SilentlyContinue
  if ($existing -contains $Line) { return }

  Add-Content -Path $Path -Value $Line
}

Write-Host "=== Enforce .gitignore ===" -ForegroundColor Cyan

$gitignore = ".\.gitignore"
if (-not (Test-Path $gitignore)) { New-Item -ItemType File -Path $gitignore -Force | Out-Null }

$lines = @(
  "# --- generated artifacts ---",
  "seed-artifacts.json",
  "smoke-artifacts.json",
  "*.log",
  ".env",
  ".env.*",
  "node_modules/",
  "dist/",
  "build/"
)

foreach ($l in $lines) {
  if ([string]::IsNullOrWhiteSpace($l)) { continue }
  Ensure-GitIgnoreLine -Path $gitignore -Line $l
}

Write-Host "[OK] .gitignore enforced" -ForegroundColor Green
