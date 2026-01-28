function Resolve-RepoPath {
  param([Parameter(Mandatory)][string]$Path)

  # If already absolute, resolve directly
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  }

  # Anchor relative paths to the current working directory (repo root)
  $anchored = Join-Path -Path (Get-Location).Path -ChildPath $Path
  return (Resolve-Path -LiteralPath $anchored -ErrorAction Stop).Path
}

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir {
  param([Parameter(Mandatory)][string]$Path)
  if (!(Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Convert-ToLf {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$Content)
  # Normalize any CRLF/CR to LF
  return ($Content -replace "`r`n", "`n" -replace "`r", "`n")
}

function Convert-ToCrlf {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$Content)
  # Normalize to LF first, then convert to CRLF
  $lf = Convert-ToLf $Content
  return ($lf -replace "`n", "`r`n")
}

function Write-TextUtf8NoBom {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][AllowEmptyString()][string]$Content,
    [ValidateSet("LF","CRLF")][string]$Newline = "LF"
  )

  $dir = Split-Path -Parent $Path
  if ($dir) { Ensure-Dir $dir }

  $Content = if ($Newline -eq "CRLF") { Convert-ToCrlf $Content } else { Convert-ToLf $Content }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Assert-NoBom {
  param([Parameter(Mandatory)][string]$Path)
  $full = Resolve-RepoPath $Path

  $bytes = [System.IO.File]::ReadAllBytes($full)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    throw "BOM detected: $full"
  }
}

function Get-FileNewlineStyle {
  param([Parameter(Mandatory)][string]$Path)
  $full = Resolve-RepoPath $Path

  $Content = [System.IO.File]::ReadAllText($full)
  if ($Content -match "`r`n") { return "CRLF" }
  if ($Content -match "`n") { return "LF" }
  return "Unknown/SingleLine"
}