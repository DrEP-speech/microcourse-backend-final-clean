Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $full = (Resolve-Path -LiteralPath (Split-Path -Parent $Path) -ErrorAction SilentlyContinue)
  if (-not $full) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path -Parent $Path)).Path + "\" + (Split-Path -Leaf $Path), $Content, (New-Object System.Text.UTF8Encoding($false)))
}

# 1) .editorconfig
$editorconfig = @"
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
"@

# 2) .gitattributes (force LF in working tree)
$gitattributes = @"
* text=auto eol=lf

*.js   text eol=lf
*.ts   text eol=lf
*.json text eol=lf
*.ps1  text eol=lf
*.yml  text eol=lf
*.yaml text eol=lf
*.md   text eol=lf
"@

# Write config files at repo root
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".editorconfig"), $editorconfig, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".gitattributes"), $gitattributes, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "✅ Wrote .editorconfig + .gitattributes (UTF-8 no BOM, LF)" -ForegroundColor Green

# 3) Git settings (avoid CRLF resurrection)
git config core.autocrlf false | Out-Null
git config core.eol lf         | Out-Null
Write-Host "✅ Set git core.autocrlf=false and core.eol=lf" -ForegroundColor Green

# 4) Install pre-commit hook (PowerShell hook; no chmod required)
$hookDir = Join-Path (Get-Location) ".git\hooks"
New-Item -ItemType Directory -Force -Path $hookDir | Out-Null

$hookPath = Join-Path $hookDir "pre-commit"
$hook = @"
#!/usr/bin/env pwsh
`$ErrorActionPreference = 'Stop'

# Block commits if _legacy changed (LEGACY FREEZE)
`$changed = git diff --cached --name-only
if (`$changed -match '^(?:_legacy/|_legacy\\)') {
  Write-Host '⛔ LEGACY FREEZE: staged changes include _legacy/. Unstage or revert those files.' -ForegroundColor Red
  exit 1
}

# Enforce repo hygiene (normalize encoding + LF)
pwsh -ExecutionPolicy Bypass -File .\scripts\repo-hygiene.ps1
if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }

Write-Host '✅ pre-commit OK' -ForegroundColor Green
"@

[System.IO.File]::WriteAllText($hookPath, $hook, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "✅ Installed .git\hooks\pre-commit (PowerShell)" -ForegroundColor Green

# 5) Run hygiene now
if (Test-Path .\scripts\repo-hygiene.ps1) {
  pwsh -ExecutionPolicy Bypass -File .\scripts\repo-hygiene.ps1
  Write-Host "✅ Ran scripts\repo-hygiene.ps1" -ForegroundColor Green
} else {
  Write-Host "⚠️ scripts\repo-hygiene.ps1 not found (skipping)" -ForegroundColor Yellow
}

Write-Host "`nDONE ✅" -ForegroundColor Cyan