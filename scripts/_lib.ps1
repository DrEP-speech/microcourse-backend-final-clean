Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $dir = Split-Path $Path -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Read-Text([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  return Get-Content -LiteralPath $Path -Raw
}

function Patch-Or-Write([string]$Path, [string]$NewContent) {
  Write-Utf8NoBomFile -Path $Path -Content $NewContent
  Write-Host "✅ Wrote $Path" -ForegroundColor Green
}

function Ensure-LineDumpFunction {
  # Gives you a safe way to print file lines without index errors.
  function Show-Lines([string]$Path, [int]$Start = 1, [int]$End = 200) {
    if (-not (Test-Path $Path)) { throw "File not found: $Path" }
    $lines = Get-Content -LiteralPath $Path
    $count = $lines.Count
    if ($count -eq 0) { Write-Host "(empty file)"; return }
    if ($Start -lt 1) { $Start = 1 }
    if ($End -gt $count) { $End = $count }
    for ($i=$Start; $i -le $End; $i++) {
      "{0,3}: {1}" -f $i, $lines[$i-1]
    }
    Write-Host "---- ($count lines total) ----" -ForegroundColor DarkGray
  }
  Set-Alias -Name slines -Value Show-Lines -Scope Global
}
Ensure-LineDumpFunction
