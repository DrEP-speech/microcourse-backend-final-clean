param(
  [switch]$InstallPreCommitBlock
)

$ErrorActionPreference = "Stop"

Write-Host "== LEGACY FREEZE ==" -ForegroundColor Cyan

$legacyDir = "_legacy"
if (!(Test-Path $legacyDir)) {
  Write-Host "No _legacy/ folder found. Skipping." -ForegroundColor Yellow
  exit 0
}

# Ensure .gitattributes exists (append if missing)
if (!(Test-Path ".gitattributes")) {
  Set-Content -Encoding UTF8 -Path ".gitattributes" -Value ""
}

$attrs = Get-Content ".gitattributes" -Raw
if ($attrs -notmatch "(?m)^\*\.js\s") {
  Add-Content -Encoding UTF8 -Path ".gitattributes" -Value "`n*.js   text eol=lf working-tree-encoding=UTF-8"
  Add-Content -Encoding UTF8 -Path ".gitattributes" -Value "*.ts   text eol=lf working-tree-encoding=UTF-8"
  Add-Content -Encoding UTF8 -Path ".gitattributes" -Value "*.json text eol=lf working-tree-encoding=UTF-8"
  Add-Content -Encoding UTF8 -Path ".gitattributes" -Value "*.ps1  text eol=lf working-tree-encoding=UTF-8"
  Write-Host "Updated .gitattributes for LF + UTF-8." -ForegroundColor Green
}

if ($InstallPreCommitBlock) {
  if (!(Test-Path ".git\hooks")) { throw ".git/hooks not found. Are you in a git repo?" }

  $hookPath = ".git\hooks\pre-commit"
  if (!(Test-Path $hookPath)) { New-Item -ItemType File -Path $hookPath -Force | Out-Null }

  # Add a block that prevents committing changes inside _legacy/*
  $hook = @'
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/repo-hygiene.ps1

# Block commits that modify _legacy/*
$changed = git diff --cached --name-only
if ($changed -match "(?m)^_legacy/") {
  Write-Host "BLOCKED: Commit includes changes inside _legacy/. Keep _legacy frozen; port changes into src/ instead." -ForegroundColor Red
  exit 1
}
