# scripts\nuke-cleanup.ps1  (PowerShell 5.1 SAFE)
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\nuke-cleanup.ps1

$ErrorActionPreference = "Stop"

function Assert-RepoRoot {
  if (!(Test-Path ".\package.json")) {
    throw "Not in repo root. CD to the folder that contains package.json and re-run."
  }
}

function Ensure-Dir([string]$Path) {
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) {
    New-Item -ItemType Directory -Force $dir | Out-Null
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  Ensure-Dir $Path
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $full = (Resolve-Path (Split-Path -Parent $Path)).Path + "\" + (Split-Path -Leaf $Path)
  [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
}

function Copy-Tree([string]$From, [string]$To) {
  if (!(Test-Path $From)) { throw "Missing source folder: $From" }
  if (!(Test-Path $To))   { New-Item -ItemType Directory -Force $To | Out-Null }

  Get-ChildItem -Path $From -File -Filter "*.js" | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path $To $_.Name)
  }
}

function Timestamp {
  return (Get-Date).ToString("yyyyMMdd-HHmmss")
}

Assert-RepoRoot

Write-Host "=== Nuclear Cleanup starting ===" -ForegroundColor Cyan

# 1) Normalize repo policy files (UTF-8 no BOM, LF)
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

$gitattributes = @"
* text=auto eol=lf
*.js  text eol=lf
*.jsx text eol=lf
*.ts  text eol=lf
*.tsx text eol=lf
*.json text eol=lf
*.md  text eol=lf
"@

Write-Utf8NoBom ".\.editorconfig" $editorconfig
Write-Utf8NoBom ".\.gitattributes" $gitattributes
Write-Host "Wrote .editorconfig + .gitattributes (UTF-8 no BOM, LF)" -ForegroundColor Green

# 2) Pick canonical sources (prefer _legacy/src-* if present)
$srcRoutesA = ".\_legacy\src-routes"
$srcRoutesB = ".\_legacy\routes"
$srcCtrlsA  = ".\_legacy\src-controllers"
$srcCtrlsB  = ".\_legacy\controllers"

$useRoutes = $null
if (Test-Path $srcRoutesA) { $useRoutes = $srcRoutesA }
elseif (Test-Path $srcRoutesB) { $useRoutes = $srcRoutesB }

$useCtrls = $null
if (Test-Path $srcCtrlsA) { $useCtrls = $srcCtrlsA }
elseif (Test-Path $srcCtrlsB) { $useCtrls = $srcCtrlsB }

if (!$useRoutes) { throw "No legacy routes found. Expected one of: $srcRoutesA or $srcRoutesB" }
if (!$useCtrls)  { throw "No legacy controllers found. Expected one of: $srcCtrlsA or $srcCtrlsB" }

Write-Host "Canonical routes source: $useRoutes" -ForegroundColor Yellow
Write-Host "Canonical controllers source: $useCtrls" -ForegroundColor Yellow

# 3) Backup current live folders (if they exist)
$ts = Timestamp
$backupRoot = ".\_legacy\backup-$ts"
New-Item -ItemType Directory -Force $backupRoot | Out-Null

if (Test-Path ".\routes") {
  Copy-Item -Recurse -Force ".\routes" (Join-Path $backupRoot "routes") | Out-Null
  Write-Host "Backed up .\routes -> $backupRoot\routes" -ForegroundColor Green
}

if (Test-Path ".\controllers") {
  Copy-Item -Recurse -Force ".\controllers" (Join-Path $backupRoot "controllers") | Out-Null
  Write-Host "Backed up .\controllers -> $backupRoot\controllers" -ForegroundColor Green
}

# 4) Rebuild live folders from canonical sources
New-Item -ItemType Directory -Force ".\routes" | Out-Null
New-Item -ItemType Directory -Force ".\controllers" | Out-Null

Get-ChildItem ".\routes" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem ".\controllers" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Copy-Tree $useRoutes ".\routes"
Copy-Tree $useCtrls  ".\controllers"

Write-Host "Rebuilt ./routes and ./controllers from canonical legacy sources." -ForegroundColor Green

# 5) Quick sanity: check required files exist
$mustFiles = @(
  ".\routes\authRoutes.js",
  ".\routes\courseRoutes.js",
  ".\controllers\authController.js",
  ".\controllers\courseController.js"
)

$missing = @()
foreach ($f in $mustFiles) { if (!(Test-Path $f)) { $missing += $f } }

if ($missing.Count -gt 0) {
  Write-Host "WARNING: Some expected files are missing:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
  Write-Host "Not fatal, but if server.js requires these, you'll crash." -ForegroundColor Yellow
} else {
  Write-Host "Sanity check OK: core route/controller files exist." -ForegroundColor Green
}

Write-Host "`nLive routes:" -ForegroundColor Cyan
Get-ChildItem ".\routes" -File | Select-Object Name, Length | Format-Table -AutoSize

Write-Host "`nLive controllers:" -ForegroundColor Cyan
Get-ChildItem ".\controllers" -File | Select-Object Name, Length | Format-Table -AutoSize

Write-Host "`n=== Nuclear Cleanup done ===" -ForegroundColor Cyan
