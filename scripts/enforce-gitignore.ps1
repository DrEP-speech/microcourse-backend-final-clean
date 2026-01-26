# scripts/enforce-gitignore.ps1
# Enforces a sane .gitignore and removes already-tracked artifacts from git index.
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\enforce-gitignore.ps1

$ErrorActionPreference = "Stop"

function Ensure-GitIgnoreLine {
  param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Line
)
  if ([string]::IsNullOrWhiteSpace($Line)) { return }

  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }

  $existing = Get-Content $Path -ErrorAction SilentlyContinue
  if ($existing -notcontains $Line) {
    Add-Content -Path $Path -Value $Line
  }
}

$gitignore = Join-Path $PSScriptRoot "..\.gitignore"
$gitignore = (Resolve-Path $gitignore).Path

# --- REQUIRED ignores (backend repo reality) ---
$lines = @(
  "# ---- Local env/secrets ----",
  ".env",
  ".env.*",
  "!.env.example",
  "seed-artifacts.json",
  "smoke-artifacts.json",
  "seed-artifacts.*.json",
  "smoke-artifacts.*.json",

  "",
  "# ---- Node / build ----",
  "node_modules/",
  "dist/",
  "build/",
  ".next/",
  "out/",
  "coverage/",
  ".cache/",
  ".turbo/",
  "*.tsbuildinfo",

  "",
  "# ---- Logs & runtime ----",
  "logs/",
  "*.log",
  "e2e-*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "pnpm-debug.log*",

  "",
  "# ---- Test/Report artifacts ----",
  "newman/",
  "newman-report.html",
  "newman-report.json",
  "playwright-report/",
  "test-results/",
  "cypress/videos/",
  "cypress/screenshots/",
  "*.xml",
  "*.junit.xml",

  "",
  "# ---- OS/editor cruft ----",
  ".DS_Store",
  "Thumbs.db",
  "*.swp",
  "*.swo",
  ".idea/",
  ".vscode/"
)

foreach ($l in $lines) {
  if ([string]::IsNullOrWhiteSpace($l)) { continue }
  Ensure-GitIgnoreLine -Path $gitignore -Line $l
}

Write-Host "[OK] .gitignore enforced at $gitignore" -ForegroundColor Green

# --- Remove already-tracked artifacts from the git index (but keep local files) ---
# If these were ever committed, this prevents re-adding.
$trackedGlobs = @(
  ".env",
  "seed-artifacts.json",
  "smoke-artifacts.json",
  "newman-report.html",
  "newman-report.json",
  "*.log",
  "e2e-*.log",
  "playwright-report",
  "test-results",
  "coverage",
  "node_modules"
)

foreach ($g in $trackedGlobs) {
  # git rm --cached will error if nothing matches; silence those.
  & git rm -r --cached --ignore-unmatch $g 2>$null | Out-Null
}

Write-Host "[OK] Git index cleaned (cached artifacts removed where applicable)" -ForegroundColor Green

# Show status so you can commit immediately
& git status
