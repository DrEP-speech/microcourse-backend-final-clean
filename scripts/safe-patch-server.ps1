param(
  [string]$EntryFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info([string]$msg) { Write-Host ("INFO: {0}" -f $msg) -ForegroundColor Cyan }
function Write-Warn([string]$msg) { Write-Host ("WARN: {0}" -f $msg) -ForegroundColor Yellow }
function Write-Pass([string]$msg) { Write-Host ("PASS: {0}" -f $msg) -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host ("FAIL: {0}" -f $msg) -ForegroundColor Red }

# Ensure we run from project root (scripts folder is one level below)
try {
  $root = Split-Path -Parent $PSScriptRoot
  Set-Location $root
} catch {}

function Resolve-EntryFile([string]$explicit) {
  if ($explicit -and (Test-Path $explicit)) { return (Resolve-Path $explicit).Path }

  $candidates = @(
    ".\server.js",
    ".\index.js",
    ".\app.js",
    ".\src\server.js",
    ".\src\index.js",
    ".\src\app.js"
  )

  foreach ($c in $candidates) {
    if (Test-Path $c) { return (Resolve-Path $c).Path }
  }

  throw "Could not find an entry file. Looked for: $($candidates -join ', ')"
}

$entry = Resolve-EntryFile $EntryFile
Write-Info ("Using entry file: {0}" -f $entry)

# Read as raw text
$text = Get-Content -Raw -Path $entry

# Basic sanity: must look like an Express server
if ($text -notmatch "express") {
  Write-Warn "Entry file does not mention 'express'. Patching anyway, but verify server structure."
}

# Backup
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bak = "{0}.bak.{1}" -f $entry, $stamp
Copy-Item -Force $entry $bak
Write-Pass ("Backup created: {0}" -f $bak)

# Helpers to detect existing mounts safely
function Has-Mount([string]$route) {
  $pattern = "(?m)app\.use\(\s*['""]{0}['""]" -f [regex]::Escape($route)
  return ($text -match $pattern)
}

# Build mount lines only for missing routes (prevents double-mounting)
$mountLines = New-Object System.Collections.Generic.List[string]

if (-not (Has-Mount "/api/results")) {
  $mountLines.Add("try { app.use('/api/results', require('./src/routes/resultRoutes')); } catch (e) { console.warn('resultsRoutes not mounted: ' + e.message); }")
}
if (-not (Has-Mount "/api/quizzes")) {
  $mountLines.Add("try { app.use('/api/quizzes', require('./src/routes/quizRoutes')); } catch (e) { console.warn('quizRoutes not mounted: ' + e.message); }")
}
if (-not (Has-Mount "/api/courses")) {
  $mountLines.Add("try { app.use('/api/courses', require('./src/routes/courseRoutes')); } catch (e) { console.warn('courseRoutes not mounted: ' + e.message); }")
}
if (-not (Has-Mount "/api/auth")) {
  $mountLines.Add("try { app.use('/api/auth', require('./src/routes/authRoutes')); } catch (e) { /* ignore if not present */ }")
}

if ($mountLines.Count -eq 0) {
  Write-Pass "No missing mounts detected. server.js already mounts expected routes."
  exit 0
}

$blockStart = "// AUTO-PATCH: ROUTE MOUNTS (safe to re-run)"
$blockEnd   = "// END AUTO-PATCH"
$desiredBlock = ($blockStart + "`r`n" + ($mountLines -join "`r`n") + "`r`n" + $blockEnd)

# If a prior AUTO-PATCH block exists, replace it. Otherwise insert before app.listen(...)
if ($text -match [regex]::Escape($blockStart)) {
  $pattern = [regex]::Escape($blockStart) + ".*?" + [regex]::Escape($blockEnd)
  $text = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $desiredBlock }, 1, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  Write-Pass "Updated existing AUTO-PATCH block."
} else {
  $listenPattern = "(?m)^\s*app\.listen\("
  if ($text -match $listenPattern) {
    $text = [regex]::Replace(
      $text,
      $listenPattern,
      [System.Text.RegularExpressions.MatchEvaluator]{ param($m) ($desiredBlock + "`r`n`r`n" + $m.Value) },
      1
    )
    Write-Pass "Inserted AUTO-PATCH block before app.listen()."
  } else {
    # Fallback: append at end
    $text = $text + "`r`n`r`n" + $desiredBlock + "`r`n"
    Write-Warn "app.listen() not found. Appended AUTO-PATCH block at end; verify placement."
  }
}

# Write back
Set-Content -Path $entry -Value $text -Encoding UTF8
Write-Pass "server entry file patched successfully."

Write-Info "Next step: restart server (node server.js) and re-test endpoints."
