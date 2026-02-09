# scripts/route-autoclean.ps1
# Detect duplicate route files, keep the ones actually mounted in server.js, delete the rest safely.
# Usage:
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\route-autoclean.ps1
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\route-autoclean.ps1 -WhatIf   # dry run
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\route-autoclean.ps1 -Force    # no prompt

[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact="High")]
param(
  [string]$Root = ".",
  [switch]$Force,
  [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Respect -WhatIf from CmdletBinding
if ($WhatIf) { $WhatIfPreference = $true }

function Normalize-PathString([string]$p) {
  if ([string]::IsNullOrWhiteSpace($p)) { return $null }
  $p = $p.Trim()
  $p = $p.Trim("'").Trim('"')
  $p = $p -replace "\\","/"
  return $p
}

function Get-MountedRouteBasenames([string]$serverPath) {
  if (!(Test-Path $serverPath)) { throw "server.js not found at: $serverPath" }
  $raw = Get-Content $serverPath -Raw

  # Capture: app.use('/api/x', require('./routes/auth'));
  # Capture the require() argument only.
  $pattern = "app\.use\(\s*['""][^'""]+['""]\s*,\s*require\(\s*['""](?<req>[^'""]+)['""]\s*\)\s*\)"
  $matches = [regex]::Matches($raw, $pattern)

  $basenames = New-Object System.Collections.Generic.HashSet[string]
  foreach ($m in $matches) {
    $req = Normalize-PathString $m.Groups["req"].Value
    if (!$req) { continue }

    # Only consider routes/ requires (./routes/x or ../routes/x etc.)
    if ($req -notmatch "routes/") { continue }

    # Reduce to basename (auth, lessons, etc.)
    $bn = [IO.Path]::GetFileName($req)

    # If require("./routes/auth") => bn = "auth"
    # If require("./routes/auth.js") => bn = "auth.js"
    if ($bn.EndsWith(".js")) { $bn = $bn.Substring(0, $bn.Length - 3) }

    [void]$basenames.Add($bn)
  }
  return $basenames
}

function Get-DuplicateRouteGroups([string]$routesDir) {
  $files = Get-ChildItem -Path $routesDir -File -Filter "*.js" | Select-Object -ExpandProperty FullName

  $map = @{}  # key: canonical base, value: list of files
  foreach ($f in $files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($f)

    # Canonical key removes optional Routes/Route suffix
    # authRoutes -> auth
    # lessonsRoutes -> lessons
    # quizRoutes -> quiz (note: this might be intended; but we'll only delete if server mounts a canonical name)
    $canon = ($name -replace "(Routes|Route)$","")

    if (!$map.ContainsKey($canon)) { $map[$canon] = New-Object System.Collections.Generic.List[string] }
    $map[$canon].Add($f)
  }

  # Only groups with more than one file are duplicates
  $dupes = @{}
  foreach ($k in $map.Keys) {
    if ($map[$k].Count -gt 1) { $dupes[$k] = $map[$k] }
  }
  return $dupes
}

function Choose-KeepFile([string]$canon, [System.Collections.Generic.List[string]]$paths, [System.Collections.Generic.HashSet[string]]$mounted) {
  # We only auto-delete when server.js mounts the canonical name (e.g., auth, lessons, courses)
  if (-not $mounted.Contains($canon)) {
    return $null # do nothing; too risky
  }

  # Prefer exact canonical file: routes/$canon.js
  $preferred = $paths | Where-Object { [IO.Path]::GetFileNameWithoutExtension($_) -ieq $canon } | Select-Object -First 1
  if ($preferred) { return $preferred }

  # Otherwise, keep the file with shortest name (usually the non-*-Routes version)
  return ($paths | Sort-Object { ([IO.Path]::GetFileNameWithoutExtension($_)).Length } | Select-Object -First 1)
}

function Write-PlanRow($rows, $canon, $keep, $delete, $reason) {
  $rows.Add([pscustomobject]@{
    Canonical = $canon
    Keep      = $keep
    Delete    = ($delete -join "; ")
    Reason    = $reason
  }) | Out-Null
}

$rootFull = (Resolve-Path $Root).Path
$server = Join-Path $rootFull "server.js"
$routesDir = Join-Path $rootFull "routes"

if (!(Test-Path $routesDir)) { throw "routes/ folder not found at: $routesDir" }

$mounted = Get-MountedRouteBasenames $server
$dupes = Get-DuplicateRouteGroups $routesDir

$plan = New-Object System.Collections.Generic.List[object]

foreach ($canon in ($dupes.Keys | Sort-Object)) {
  $paths = $dupes[$canon]
  $keep = Choose-KeepFile $canon $paths $mounted

  if (-not $keep) {
    Write-PlanRow $plan $canon $null @() "SKIP: server.js does not mount '$canon' (or cannot safely infer)."
    continue
  }

  $toDelete = $paths | Where-Object { $_ -ne $keep }
  if ($toDelete.Count -eq 0) {
    Write-PlanRow $plan $canon $keep @() "OK: only one candidate."
    continue
  }

  Write-PlanRow $plan $canon $keep $toDelete "DELETE duplicates: keep mounted '$canon' route file."
}

Write-Host "`n=== ROUTE AUTO-CLEAN PLAN ===" -ForegroundColor Cyan
$plan | Format-Table -AutoSize

# Execute deletions
$deletions = $plan | Where-Object { $_.Delete -and $_.Delete.Trim().Length -gt 0 }

if ($deletions.Count -eq 0) {
  Write-Host "`nNo deletions planned. Done." -ForegroundColor Green
  return
}

if (-not $Force) {
  Write-Host "`nAbout to delete duplicate route files listed above." -ForegroundColor Yellow
  $resp = Read-Host "Type DELETE to proceed (or anything else to cancel)"
  if ($resp -ne "DELETE") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    return
  }
}

Write-Host "`n=== DELETING ===" -ForegroundColor Cyan
foreach ($row in $deletions) {
  $delList = $row.Delete -split ";\s*"
  foreach ($p in $delList) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    $file = $p.Trim()
    if (!(Test-Path $file)) {
      Write-Host "SKIP (missing): $file" -ForegroundColor DarkYellow
      continue
    }
    if ($PSCmdlet.ShouldProcess($file, "Remove-Item")) {
      Remove-Item -LiteralPath $file -Force
      Write-Host "DELETED: $file" -ForegroundColor Green
    }
  }
}

Write-Host "`nDone. Recommend restart with fresh require:" -ForegroundColor Cyan
Write-Host '  $env:REQUIRE_FRESH="1"; npm start' -ForegroundColor Cyan
