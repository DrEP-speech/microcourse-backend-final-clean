param(
  [string]$PreferredServerPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERR]  $m" -ForegroundColor Red }

function Find-ServerFile {
  param([string]$Preferred)

  $candidates = @()
  if ($Preferred -and (Test-Path $Preferred)) { $candidates += (Resolve-Path $Preferred).Path }

  $candidates += @(
    (Join-Path (Get-Location) "server.js"),
    (Join-Path (Get-Location) "src\server.js"),
    (Join-Path (Get-Location) "index.js"),
    (Join-Path (Get-Location) "src\index.js"),
    (Join-Path (Get-Location) "app.js"),
    (Join-Path (Get-Location) "src\app.js")
  )

  foreach ($p in $candidates | Select-Object -Unique) {
    if (Test-Path $p) { return (Resolve-Path $p).Path }
  }
  return $null
}

function Find-ResultsRoutesRequirePath {
  # We want: ./src/routes/resultRoutes (or similar)
  $routeCandidates = @(
    ".\src\routes\resultRoutes.js",
    ".\src\routes\resultsRoutes.js",
    ".\src\routes\resultRoute.js",
    ".\src\routes\resultsRoute.js"
  )

  foreach ($rc in $routeCandidates) {
    if (Test-Path $rc) {
      # convert to require-friendly relative path from server.js (assumed repo root):
      # prefer "./src/routes/<fileWithoutExt>"
      $fileName = [System.IO.Path]::GetFileNameWithoutExtension($rc)
      return "./src/routes/$fileName"
    }
  }

  return $null
}

function Backup-File {
  param([string]$Path)
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $bak = "$Path.bak.$stamp"
  Copy-Item -LiteralPath $Path -Destination $bak -Force
  return $bak
}

function Insert-BeforeAppListen {
  param(
    [string]$Content,
    [string]$InsertionBlock
  )

  # Put our block immediately before the first app.listen(...) occurrence.
  $idx = $Content.IndexOf("app.listen")
  if ($idx -lt 0) {
    # fallback: append to end
    return ($Content.TrimEnd() + "`r`n`r`n" + $InsertionBlock + "`r`n")
  }

  $before = $Content.Substring(0, $idx).TrimEnd()
  $after  = $Content.Substring($idx)
  return ($before + "`r`n`r`n" + $InsertionBlock + "`r`n`r`n" + $after)
}

# ---------------------------
# Main
# ---------------------------
$serverPath = Find-ServerFile -Preferred $PreferredServerPath
if (-not $serverPath) {
  Write-Err "Could not find server entry file (server.js / index.js / app.js). Run from repo root or pass -PreferredServerPath."
  exit 1
}

Write-Info "Using server file: $serverPath"
$bak = Backup-File -Path $serverPath
Write-Ok "Backup created: $bak"

$content = Get-Content -LiteralPath $serverPath -Raw

# Quick sanity: avoid patching ES module imports incorrectly
$looksESM = ($content -match "^\s*import\s+.*from\s+['""]" -and $content -notmatch "require\(")
if ($looksESM) {
  Write-Warn "This server file looks like ESM (import/from). This patcher is designed for CommonJS require(). No changes applied."
  Write-Info "If you want, I can generate an ESM-safe patcher too."
  exit 0
}

$requirePath = Find-ResultsRoutesRequirePath
if (-not $requirePath) {
  Write-Warn "No results route file found in .\src\routes\ (expected resultRoutes.js). No changes applied."
  Write-Info "Create one at src/routes/resultRoutes.js (or tell me what you named it), then rerun this patcher."
  exit 0
}

# Already mounted?
if ($content -match "/api/results" -or $content -match "resultRoutes" -or $content -match "resultsRoutes") {
  Write-Ok "Server already appears to mount results routes. No changes needed."
  exit 0
}

# Build insertion block
$insertion = @"
//
// Results routes (auto-patched)
//
const resultRoutes = require('$requirePath');
app.use('/api/results', resultRoutes);
"@.Trim()

# Insert require + mount before app.listen
$newContent = Insert-BeforeAppListen -Content $content -InsertionBlock $insertion

# Write back (UTF8 no BOM preferred by Node)
Set-Content -LiteralPath $serverPath -Value $newContent -Encoding UTF8

Write-Ok "Patched server successfully."
Write-Info "Next: restart backend (Ctrl+C then: node server.js) and test:"
Write-Host '  irm "http://localhost:4000/api/health"' -ForegroundColor Gray
Write-Host '  irm "http://localhost:4000/api/results/me" -Headers @{ Authorization="Bearer <TOKEN>" }' -ForegroundColor Gray
