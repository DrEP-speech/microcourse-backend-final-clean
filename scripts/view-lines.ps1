Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory=$true)][string]$Path,
  [int]$From = 1,
  [int]$To = 120
)

if (-not (Test-Path $Path)) { throw "File not found: $Path" }

$lines = Get-Content -Path $Path
$max = $lines.Count
if ($max -lt 1) { return }

if ($From -lt 1) { $From = 1 }
if ($To -gt $max) { $To = $max }

for ($i = $From; $i -le $To; $i++) {
  "{0,4}: {1}" -f $i, $lines[$i-1]
}