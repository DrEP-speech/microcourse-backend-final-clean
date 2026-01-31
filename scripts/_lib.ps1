Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  param([string]$Start = $PSScriptRoot)
  $dir = (Resolve-Path $Start).Path
  while ($true) {
    $pkg = Join-Path $dir "package.json"
    $srv = Join-Path $dir "server.js"
    if ((Test-Path $pkg) -and (Test-Path $srv)) { return $dir }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) {
      throw "Could not locate repo root (package.json + server.js)."
    }
    $dir = $parent
  }
}

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $full = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-Location).Path $Path }
  $dir = Split-Path $full -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
}

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
}

function Get-JsonStable([object]$Obj) {
  # Stable JSON for contracts (sorted keys where possible)
  return ($Obj | ConvertTo-Json -Depth 50)
}
