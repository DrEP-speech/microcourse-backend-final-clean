param(
  [switch]$DeleteInsteadOfArchive
)

$ErrorActionPreference = "Stop"
$root = Get-Location
$archive = Join-Path $root "_archive"
New-Item -ItemType Directory -Force -Path $archive | Out-Null

# Patterns to archive/delete
$patterns = @(
  "*.bak","*.bak.*","*.orig","*.tmp","*.log",
  "newman-report*.html","newman-log.txt",
  "server.out.log","server.err.log","build.log","gate.run.log"
)

# Directories to archive/delete (if present)
$dirs = @(
  "logs","test-results","coverage",
  "_quarantine","_routes_UNUSED","_env_archive","_backup_auth_*"
)

function Move-Safe($itemPath) {
  $full = (Resolve-Path $itemPath).Path
  if ($full.StartsWith((Resolve-Path $archive).Path)) { return } # don't move archive into itself

  $name = Split-Path $full -Leaf
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $dest = Join-Path $archive "$name.$stamp"

  if ($DeleteInsteadOfArchive) {
    Remove-Item -Force -Recurse -LiteralPath $full
    Write-Host "[DEL] $full" -ForegroundColor DarkYellow
  } else {
    Move-Item -Force -LiteralPath $full -Destination $dest
    Write-Host "[ARC] $full -> $dest" -ForegroundColor Cyan
  }
}

# Archive/delete matching files (root + subfolders), excluding node_modules and _archive
$files = Get-ChildItem -Recurse -File -Force |
  Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\_archive\\"
  }

foreach ($p in $patterns) {
  $hit = $files | Where-Object { $_.Name -like $p }
  foreach ($f in $hit) { Move-Safe $f.FullName }
}

# Archive/delete whole directories
foreach ($d in $dirs) {
  Get-ChildItem -Path $root -Directory -Force -Filter $d -ErrorAction SilentlyContinue |
    ForEach-Object { Move-Safe $_.FullName }
}

Write-Host "[OK] Repository cleanup complete" -ForegroundColor Green
